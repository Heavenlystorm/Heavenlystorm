// Fetches public GitHub data and regenerates every SVG in cards/ plus the
// open-source section of README.md. Runs daily in .github/workflows/profile.yml.
//
//   GITHUB_TOKEN=... node scripts/generate.mjs
//
// No dependencies. If any request fails it exits non-zero and writes nothing,
// so the last good cards stay up.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderBanner, renderFooter } from "./banner.mjs";
import { renderActivity, renderFeatured, renderLanguages, renderStats, renderStreak, renderTrophies, tierFor } from "./cards.mjs";
import { ROOT, compact, fmt, day } from "./lib.mjs";

// ---------------------------------------------------------------- settings

const LOGIN = process.env.PROFILE_LOGIN || "Heavenlystorm";
const DISPLAY_NAME = "HeavenLyStorm";
const TAGLINE = "I build open-source tools that make PCs glow.";
const FEATURED = "airglow";
const FEATURED_CHIPS = ["Windows 10 & 11", "NZXT", "ASUS Aura", "OpenRGB", "Scoop", "No account"];
// Packaging submissions, not code contributions.
const EXCLUDE_UPSTREAM = new Set(["microsoft/winget-pkgs"]);
// Short descriptions for the banner's typing line.
const BLURBS = { "akinware/gameport": "Windows games on Apple Silicon" };
const FOOTER = { left: "made with too many LEDs", right: "airglowrgb.com" };

// ---------------------------------------------------------------- GitHub API

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("GITHUB_TOKEN is not set.");
  process.exit(1);
}
const headers = {
  Authorization: `Bearer ${token}`,
  "User-Agent": "profile-cards",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function gql(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors) throw new Error(`GraphQL ${res.status}: ${JSON.stringify(json.errors ?? json).slice(0, 500)}`);
  return json.data;
}

async function rest(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers: { ...headers, Accept: "application/vnd.github+json" } });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function restAll(path) {
  const out = [];
  for (let page = 1; ; page++) {
    const batch = await rest(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) return out;
  }
}

// ---------------------------------------------------------------- data

async function fetchProfile() {
  const data = await gql(
    `query($login:String!){ user(login:$login){
      login createdAt
      issues { totalCount }
      repositories(ownerAffiliations:OWNER, privacy:PUBLIC, isFork:false, first:100){
        nodes { name nameWithOwner stargazerCount releases { totalCount }
          languages(first:20, orderBy:{field:SIZE, direction:DESC}){ edges { size node { name } } } } } } }`,
    { login: LOGIN }
  );
  if (!data.user) throw new Error(`User ${LOGIN} not found`);
  return data.user;
}

async function fetchPullRequests() {
  const prs = [];
  let after = null;
  for (;;) {
    const data = await gql(
      `query($login:String!,$after:String){ user(login:$login){
        pullRequests(first:100, after:$after, orderBy:{field:CREATED_AT, direction:DESC}){
          pageInfo { hasNextPage endCursor }
          nodes { title url state merged createdAt mergedAt
            repository { nameWithOwner url description isPrivate owner { login } } } } } }`,
      { login: LOGIN, after }
    );
    const page = data.user.pullRequests;
    prs.push(...page.nodes.filter((p) => p.repository && !p.repository.isPrivate));
    if (!page.pageInfo.hasNextPage) return prs;
    after = page.pageInfo.endCursor;
  }
}

/** Every contribution day since the account was created (the API allows one year per query). */
async function fetchCalendar(createdAt) {
  const days = new Map();
  let commits = 0;
  const now = new Date();
  for (let from = new Date(createdAt); from < now; ) {
    const to = new Date(Math.min(now.getTime(), new Date(from).setUTCFullYear(from.getUTCFullYear() + 1) - 1000));
    const data = await gql(
      `query($login:String!,$from:DateTime!,$to:DateTime!){ user(login:$login){
        contributionsCollection(from:$from, to:$to){ totalCommitContributions
          contributionCalendar { weeks { contributionDays { date contributionCount } } } } } }`,
      { login: LOGIN, from: from.toISOString(), to: to.toISOString() }
    );
    const cc = data.user.contributionsCollection;
    commits += cc.totalCommitContributions;
    for (const w of cc.contributionCalendar.weeks) for (const d of w.contributionDays) days.set(d.date, d.contributionCount);
    from = new Date(to.getTime() + 1000);
  }
  const today = now.toISOString().slice(0, 10);
  const since = createdAt.slice(0, 10);
  const list = [...days.entries()]
    .filter(([date]) => date >= since && date <= today)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
  return { days: list, commits, since };
}

/** Release downloads across all public repos, plus the featured repo's own count and latest release. */
async function fetchReleases(repos) {
  let downloads = 0;
  let featuredDownloads = 0;
  let latest = null;
  for (const repo of repos.filter((r) => r.releases.totalCount > 0)) {
    const releases = await restAll(`/repos/${repo.nameWithOwner}/releases`);
    const count = releases.reduce((s, r) => s + r.assets.reduce((t, a) => t + a.download_count, 0), 0);
    downloads += count;
    if (repo.name === FEATURED) {
      featuredDownloads = count;
      const published = releases.filter((r) => !r.draft && !r.prerelease && r.published_at);
      published.sort((a, b) => b.published_at.localeCompare(a.published_at));
      latest = published[0] ?? null;
    }
  }
  return { downloads, featuredDownloads, latest };
}

// ---------------------------------------------------------------- derived numbers

function streaks(days) {
  let longest = { length: 0, start: null, end: null };
  let run = { length: 0, start: null, end: null };
  for (const d of days) {
    if (d.count > 0) {
      run = run.length ? { ...run, length: run.length + 1, end: d.date } : { length: 1, start: d.date, end: d.date };
      if (run.length > longest.length) longest = { ...run };
    } else {
      run = { length: 0, start: null, end: null };
    }
  }
  // A quiet today doesn't break the streak until the day is over.
  let i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i--;
  let current = { length: 0, start: null, end: null };
  for (let j = i; j >= 0 && days[j].count > 0; j--) {
    current = { length: current.length + 1, start: days[j].date, end: days[i].date };
  }
  return { current, longest };
}

function upstreamGroups(prs) {
  const groups = new Map();
  for (const pr of prs) {
    const repo = pr.repository;
    if (repo.owner.login.toLowerCase() === LOGIN.toLowerCase()) continue;
    if (EXCLUDE_UPSTREAM.has(repo.nameWithOwner)) continue;
    if (!pr.merged && pr.state !== "OPEN") continue;
    if (!groups.has(repo.nameWithOwner)) groups.set(repo.nameWithOwner, { repo, merged: [], open: [] });
    groups.get(repo.nameWithOwner)[pr.merged ? "merged" : "open"].push(pr);
  }
  const latest = (g) => [...g.merged, ...g.open].map((p) => p.mergedAt ?? p.createdAt).sort().at(-1);
  return [...groups.values()].sort((a, b) => b.merged.length - a.merged.length || latest(b).localeCompare(latest(a)));
}

const roundDown = (n) => (n < 100 ? `${n}` : `${fmt(Math.floor(n / (n < 1000 ? 10 : 100)) * (n < 1000 ? 10 : 100))}+`);

function contributionsMarkdown(groups) {
  if (!groups.length) return "_Nothing upstream yet._";
  const short = (s, n) => (s && s.length > n ? `${s.slice(0, s.lastIndexOf(" ", n)).replace(/[,:;.]$/, "")}…` : s || "");
  return groups
    .map((g) => {
      const pills = [g.merged.length && `\`${g.merged.length} merged\``, g.open.length && `\`${g.open.length} open\``].filter(Boolean).join(" ");
      const shown = [...g.merged, ...g.open].slice(0, 3);
      const more = g.merged.length + g.open.length - shown.length;
      const search = `${g.repo.url}/pulls?q=${encodeURIComponent(`is:pr author:${LOGIN}`)}`;
      const lines = shown.map((p) => `- ${p.merged ? "" : "_open:_ "}[${p.title.replace(/[[\]]/g, "")}](${p.url})`);
      if (more > 0) lines.push(`- [and ${more} more](${search})`);
      const head = `**[${g.repo.nameWithOwner}](${g.repo.url})** &nbsp;${pills}`;
      const desc = g.repo.description ? [`${head}  `, `<sub>${short(g.repo.description, 110)}</sub>`] : [head];
      return [...desc, "", ...lines].join("\n");
    })
    .join("\n\n");
}

// ---------------------------------------------------------------- main

async function main() {
  const user = await fetchProfile();
  const [prs, calendar, rel, featuredRepo] = await Promise.all([
    fetchPullRequests(),
    fetchCalendar(user.createdAt),
    fetchReleases(user.repositories.nodes),
    rest(`/repos/${LOGIN}/${FEATURED}`),
  ]);
  const { featuredDownloads } = rel;

  const repos = user.repositories.nodes;
  const stars = repos.reduce((s, r) => s + r.stargazerCount, 0);
  const releases = repos.reduce((s, r) => s + r.releases.totalCount, 0);
  const merged = prs.filter((p) => p.merged).length;
  const groups = upstreamGroups(prs);
  const contributedTo = groups.filter((g) => g.merged.length > 0).length;

  const langSizes = new Map();
  for (const r of repos) for (const e of r.languages.edges) langSizes.set(e.node.name, (langSizes.get(e.node.name) ?? 0) + e.size);
  const languages = [...langSizes.entries()].map(([name, size]) => ({ name, size })).sort((a, b) => b.size - a.size);
  const langRepos = repos.filter((r) => r.languages.edges.length > 0).length;

  const days = calendar.days;
  const total = days.reduce((s, d) => s + d.count, 0);
  const { current, longest } = streaks(days);

  // The busiest upstream project gets a line in the banner.
  const top = groups.find((g) => g.merged.length > 0);
  const lines = [
    `building ${featuredRepo.name[0].toUpperCase()}${featuredRepo.name.slice(1)}: RGB, fans and sensors for Windows`,
    `${roundDown(featuredDownloads)} downloads, no account, no telemetry`,
    top &&
      `${top.merged.length} merged ${top.merged.length === 1 ? "PR" : "PRs"} in ${top.repo.nameWithOwner.split("/")[1]}${BLURBS[top.repo.nameWithOwner] ? `: ${BLURBS[top.repo.nameWithOwner]}` : ""}`,
    "JavaScript, Python, Rust, Swift: whatever the job needs",
    "probably tuning a fan curve right now",
  ].filter(Boolean);

  const description = featuredRepo.description ?? "";
  const firstStop = description.indexOf(". ");
  const tagline = firstStop > 0 ? description.slice(0, firstStop + 1) : description;
  const rest_ = firstStop > 0 ? description.slice(firstStop + 2) : "";

  const files = {
    "banner.svg": renderBanner({ name: DISPLAY_NAME, tagline: TAGLINE, lines }),
    "featured.svg": renderFeatured({
      name: featuredRepo.name[0].toUpperCase() + featuredRepo.name.slice(1),
      tagline,
      description: rest_,
      tiles: [
        { label: "STARS", value: fmt(featuredRepo.stargazers_count) },
        { label: "DOWNLOADS", value: compact(featuredDownloads) },
        { label: "LATEST", value: rel.latest?.tag_name ?? "–" },
        { label: "RELEASED", value: rel.latest ? day(rel.latest.published_at) : "–" },
      ],
      chips: FEATURED_CHIPS,
    }),
    "stats.svg": renderStats({
      stars,
      commits: calendar.commits,
      prs: prs.length,
      merged,
      issues: user.issues.totalCount,
      contributedTo,
      recentActive: days.slice(-30).filter((d) => d.count > 0).length,
      recentDays: Math.min(30, days.length),
    }),
    "streak.svg": renderStreak({ total, since: calendar.since, current, longest }),
    "activity.svg": renderActivity({ days: days.slice(-31) }),
    "languages.svg": renderLanguages({ languages, repoCount: langRepos }),
    "trophies.svg": renderTrophies({
      trophies: [
        { label: "Stars", value: fmt(stars), tier: tierFor(stars, [1, 10, 50, 250, 1000]) },
        { label: "Commits", value: fmt(calendar.commits), tier: tierFor(calendar.commits, [10, 100, 500, 1000, 5000]) },
        { label: "Merged PRs", value: fmt(merged), tier: tierFor(merged, [1, 10, 30, 100, 300]) },
        { label: "Downloads", value: compact(rel.downloads), tier: tierFor(rel.downloads, [10, 100, 1000, 10000, 100000]) },
        { label: "Releases", value: fmt(releases), tier: tierFor(releases, [1, 5, 20, 50, 100]) },
        { label: "Contributed", value: `${contributedTo} ${contributedTo === 1 ? "repo" : "repos"}`, tier: tierFor(contributedTo, [1, 3, 10, 25, 50]) },
      ],
    }),
    "footer.svg": renderFooter(FOOTER),
  };

  const readmePath = join(ROOT, "README.md");
  const readme = readFileSync(readmePath, "utf8");
  const START = "<!-- contributions:start -->";
  const END = "<!-- contributions:end -->";
  const a = readme.indexOf(START);
  const b = readme.indexOf(END);
  if (a < 0 || b < a) throw new Error("README.md is missing the contributions markers");
  const nextReadme = `${readme.slice(0, a + START.length)}\n${contributionsMarkdown(groups)}\n${readme.slice(b)}`;

  // Everything rendered: now write.
  const outDir = join(ROOT, "cards");
  if (!existsSync(outDir)) mkdirSync(outDir);
  let changed = 0;
  for (const [name, svg] of Object.entries(files)) {
    const path = join(outDir, name);
    if (existsSync(path) && readFileSync(path, "utf8") === svg) continue;
    writeFileSync(path, svg);
    changed++;
  }
  if (nextReadme !== readme) {
    writeFileSync(readmePath, nextReadme);
    changed++;
  }
  console.log(
    `${changed} file(s) updated. stars=${stars} commits=${calendar.commits} prs=${prs.length} merged=${merged} ` +
      `contributions=${total} streak=${current.length}/${longest.length} downloads=${rel.downloads} upstream=${groups.length}`
  );
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
