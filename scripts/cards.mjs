// Stats, streak, languages, trophies, activity and featured-project cards.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { C, LED, MONO, SANS, ROOT, card, day, enter, esc, fmt, ledGradient, measure, r1, tween, wrap } from "./lib.mjs";

const HALF_W = 430;
const HALF_H = 230;

const ICON = {
  star: `<path d="M7 1.2l1.75 3.7 4.05.5-3 2.8.78 4-3.58-2-3.58 2 .78-4-3-2.8 4.05-.5z" stroke-linejoin="round"/>`,
  commit: `<circle cx="7" cy="7" r="2.8"/><path d="M1 7h3.2M9.8 7H13"/>`,
  pr: `<circle cx="3.5" cy="3" r="1.8"/><circle cx="3.5" cy="11.5" r="1.8"/><circle cx="10.5" cy="11.5" r="1.8"/><path d="M3.5 4.8v4.9M10.5 9.7V6.2c0-1.4-1-2.4-2.4-2.4H6.6"/><path d="M8 2.3 6.5 3.8 8 5.3"/>`,
  merge: `<circle cx="3.5" cy="3" r="1.8"/><circle cx="3.5" cy="11.5" r="1.8"/><circle cx="10.5" cy="8" r="1.8"/><path d="M3.5 4.8v4.9M3.6 4.9c.6 2 2.4 3.1 5.1 3.1"/>`,
  issue: `<circle cx="7" cy="7" r="5.6"/><circle cx="7" cy="7" r=".9" fill="currentColor"/>`,
  repo: `<path d="M3 1.6h8.2v10.8H4.2A1.6 1.6 0 0 1 2.6 10.8V2c0-.2.2-.4.4-.4z"/><path d="M2.6 10.6c0-.9.7-1.4 1.6-1.4h7"/>`,
};

const icon = (name, x, y, color) =>
  `<g transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="1.35" stroke-linecap="round" style="color:${color}">${ICON[name]}</g>`;

/** Shrink a font size until the text fits. */
function fit(text, face, size, maxWidth, min = 10) {
  let s = size;
  while (s > min && measure(text, face, s) > maxWidth) s -= 0.5;
  return s;
}

// ---------------------------------------------------------------- stats

export function renderStats(d) {
  const rows = [
    ["star", "Stars earned", fmt(d.stars)],
    ["commit", "Commits", fmt(d.commits)],
    ["pr", "Pull requests", fmt(d.prs)],
    ["merge", "Merged PRs", fmt(d.merged)],
    ["issue", "Issues opened", fmt(d.issues)],
    ["repo", "Contributed to", `${d.contributedTo} ${d.contributedTo === 1 ? "repo" : "repos"}`],
  ];
  const list = rows
    .map(
      ([ic, label, value], i) =>
        `<g ${enter(0.15 + i * 0.07)}>${icon(ic, 24, 64 + i * 25, C.amber)}` +
        `<text x="47" y="75.5" transform="translate(0 ${i * 25})" class="lbl">${esc(label)}</text>` +
        `<text x="250" y="75.5" transform="translate(0 ${i * 25})" class="val" text-anchor="end">${esc(value)}</text></g>`
    )
    .join("");

  const cx = 340;
  const cy = 124;
  const r = 50;
  const pct = Math.max(0.5, Math.min(100, (d.recentActive / d.recentDays) * 100));
  const arc = (extra) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#stats-ring)" stroke-width="7" stroke-linecap="round" pathLength="100" stroke-dasharray="${r1(pct)} 100" transform="rotate(-90 ${cx} ${cy})" ${extra}>` +
    tween("stroke-dasharray", "0 100", `${r1(pct)} 100`, { delay: 0.3, dur: 1.6 }) +
    `</circle>`;
  const ring =
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.track}" stroke-width="7"/>` +
    arc(`filter="url(#stats-bloom)" opacity=".7"`) +
    arc("") +
    `<g ${enter(0.6)}><text x="${cx}" y="${cy + 4}" class="big" text-anchor="middle">${d.recentActive}<tspan class="of">/${d.recentDays}</tspan></text>` +
    `<text x="${cx}" y="${cy + 21}" class="small" text-anchor="middle">active days</text></g>` +
    `<g ${enter(0.9)}><text x="${cx}" y="${cy + r + 28}" class="cap" text-anchor="middle">in the last ${d.recentDays} days</text></g>`;

  return card({
    id: "stats",
    w: HALF_W,
    h: HALF_H,
    title: "GitHub stats",
    caption: "public activity",
    label: `GitHub stats: ${rows.map(([, l, v]) => `${l} ${v}`).join(", ")}. Active on ${d.recentActive} of the last ${d.recentDays} days.`,
    css:
      `.lbl{font:400 13px ${SANS};fill:${C.soft}}` +
      `.val{font:600 13px ${MONO};fill:${C.ink}}` +
      `.big{font:600 22px ${MONO};fill:${C.ink}}` +
      `.of{font-size:13px;font-weight:400;fill:${C.muted}}` +
      `.small{font:400 11px ${SANS};fill:${C.muted}}`,
    defs:
      `<linearGradient id="stats-ring" x1="0" y1="0" x2="1" y2="1">${LED.map((c, i) => `<stop offset="${r1(i / 3)}" stop-color="${c}"/>`).join("")}</linearGradient>` +
      `<filter id="stats-bloom" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>`,
    body: list + ring,
  });
}

// ---------------------------------------------------------------- streak

const FLAME =
  `<path d="M0 0C-6.6 0-10-4.6-10-9.6-10-14.8-6-17.4-4.6-22-2.6-18.6-1.4-17.4 0-16.4.4-19 1.2-21.6 3-23.6 5.2-19.8 10-15.8 10-9.6 10-4.6 6.6 0 0 0Z"/>` +
  `<path d="M0-1C-3.4-1-5.2-3.3-5.2-5.9-5.2-8.7-2.7-10.3-1.2-13.2.9-10.8 5.2-9 5.2-5.9 5.2-3.3 3.4-1 0-1Z" fill="#fff3d6" opacity=".85"/>`;

export function renderStreak(d) {
  const cols = [HALF_W / 6, HALF_W / 2, (HALF_W * 5) / 6].map(r1);
  // Short ranges: drop the year when both ends are in the current one.
  const thisYear = new Date().toISOString().slice(0, 4);
  const range = (a, b) => {
    if (!a) return "no streak yet";
    const yr = a.slice(0, 4) !== thisYear || b.slice(0, 4) !== thisYear;
    return a === b ? day(a, yr) : `${day(a, yr && a.slice(0, 4) !== b.slice(0, 4))} – ${day(b, yr)}`;
  };
  const live = d.current.length > 0;
  const ringColor = live ? C.amber : C.locked;
  const cx = cols[1];
  const cy = 112;
  const side = (x, value, label, sub, delay) =>
    `<g ${enter(delay)}><text x="${x}" y="124" class="num" text-anchor="middle">${esc(value)}</text>` +
    `<text x="${x}" y="150" class="lbl" text-anchor="middle">${esc(label)}</text>` +
    `<text x="${x}" y="170" class="cap" text-anchor="middle">${esc(sub)}</text></g>`;

  const body =
    `<path d="M${r1(HALF_W / 3)} 72V196M${r1((HALF_W * 2) / 3)} 72V196" stroke="${C.line}"/>` +
    side(cols[0], fmt(d.total), "Total contributions", `since ${day(d.since)}`, 0.15) +
    side(cols[2], `${fmt(d.longest.length)} ${d.longest.length === 1 ? "day" : "days"}`, "Longest streak", range(d.longest.start, d.longest.end), 0.35) +
    `<g ${enter(0.25)}>` +
    `<circle cx="${cx}" cy="${cy}" r="40" fill="none" stroke="${ringColor}" stroke-width="7" opacity=".55" filter="url(#streak-bloom)"/>` +
    `<circle cx="${cx}" cy="${cy}" r="40" fill="none" stroke="${ringColor}" stroke-width="4.5"/>` +
    `<circle cx="${cx}" cy="${cy - 40}" r="13" fill="${C.panel}"/>` +
    `<g transform="translate(${cx} ${cy - 29})" fill="${ringColor}">` +
    (live
      ? `<animateTransform attributeName="transform" type="scale" additive="sum" values="1 1;1.05 .95;.96 1.06;1.02 .98;1 1" dur="1.6s" repeatCount="indefinite"/>`
      : "") +
    FLAME +
    `</g>` +
    `<text x="${cx}" y="${cy + 9}" class="num" text-anchor="middle">${fmt(d.current.length)}</text>` +
    `<text x="${cx}" y="178" class="lbl hot" text-anchor="middle">Current streak</text>` +
    `<text x="${cx}" y="197" class="cap" text-anchor="middle">${esc(live ? range(d.current.start, d.current.end) : "starts with the next commit")}</text>` +
    `</g>`;

  return card({
    id: "streak",
    w: HALF_W,
    h: HALF_H,
    title: "Streak",
    caption: "days with a contribution",
    label: `${d.total} contributions since ${day(d.since)}. Current streak ${d.current.length} days, longest ${d.longest.length} days.`,
    css:
      `.num{font:600 24px ${MONO};fill:${C.ink}}` +
      `.lbl{font:400 12.5px ${SANS};fill:${C.soft}}` +
      `.hot{font-weight:600;fill:${live ? C.amber : C.soft}}`,
    defs: `<filter id="streak-bloom" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>`,
    body,
  });
}

// ---------------------------------------------------------------- languages

const LANG_COLORS = [C.amber, C.mint, C.iris, C.rose, C.sky, C.soft];

export function renderLanguages(d) {
  const total = d.languages.reduce((s, l) => s + l.size, 0) || 1;
  let langs = d.languages.map((l) => ({ ...l, share: l.size / total }));
  if (langs.length > 6) {
    const rest = langs.slice(5).reduce((s, l) => s + l.share, 0);
    langs = [...langs.slice(0, 5), { name: "Other", share: rest }];
  }
  const x0 = 24;
  const barW = HALF_W - 48;
  let x = x0;
  const segs = langs
    .map((l, i) => {
      const w = Math.max(2, l.share * barW);
      const seg = `<rect x="${r1(x)}" y="62" width="${r1(Math.max(1, w - (i < langs.length - 1 ? 2 : 0)))}" height="10" fill="${LANG_COLORS[i]}"/>`;
      x += w;
      return seg;
    })
    .join("");
  const pctText = (s) => `${(s * 100).toFixed(1)}%`;
  const list = langs
    .map((l, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const lx = col === 0 ? x0 : x0 + barW / 2 + 12;
      const rx = col === 0 ? x0 + barW / 2 - 12 : x0 + barW;
      const y = 108 + row * 32;
      return (
        `<g ${enter(0.5 + i * 0.07)}><circle cx="${lx + 5}" cy="${y - 4.5}" r="5" fill="${LANG_COLORS[i]}"/>` +
        `<text x="${lx + 18}" y="${y}" class="lbl">${esc(l.name)}</text>` +
        `<text x="${rx}" y="${y}" class="val" text-anchor="end">${pctText(l.share)}</text></g>`
      );
    })
    .join("");

  return card({
    id: "langs",
    w: HALF_W,
    h: HALF_H,
    title: "Languages",
    caption: `${d.repoCount} public ${d.repoCount === 1 ? "repo" : "repos"}, by size`,
    label: `Languages: ${langs.map((l) => `${l.name} ${pctText(l.share)}`).join(", ")}.`,
    css: `.lbl{font:400 13px ${SANS};fill:${C.soft}}.val{font:500 12px ${MONO};fill:${C.ink}}`,
    defs:
      `<clipPath id="langs-bar"><rect x="${x0}" y="62" width="${barW}" height="10" rx="5">` +
      tween("width", 0, barW, { delay: 0.2, dur: 1.3, ease: ".25 .7 .2 1" }) +
      `</rect></clipPath>`,
    body:
      `<rect x="${x0}" y="62" width="${barW}" height="10" rx="5" fill="${C.track}"/>` +
      `<g clip-path="url(#langs-bar)">${segs}</g>` +
      list,
  });
}

// ---------------------------------------------------------------- trophies

const TIERS = [
  { label: "C", color: C.soft },
  { label: "B", color: C.mint },
  { label: "A", color: C.amber },
  { label: "S", color: C.iris },
  { label: "SS", color: "url(#trophy-ss)" },
];

const CUP =
  `<path d="M6 2h16v8c0 6-3.6 10-8 10S6 16 6 10z"/>` +
  `<path d="M12.4 19.6h3.2V25h-3.2z"/>` +
  `<path d="M8 26.5h12a1 1 0 0 1 1 1V31H7v-3.5a1 1 0 0 1 1-1z"/>`;
const HANDLES = `<path d="M6 5H2.6v2.6C2.6 10.6 4.4 12.6 7 12.8M22 5h3.4v2.6c0 3-1.8 5-4.4 5.2" fill="none" stroke-width="1.8" stroke-linecap="round"/>`;

export function tierFor(value, thresholds) {
  let t = -1;
  thresholds.forEach((min, i) => value >= min && (t = i));
  return t;
}

export function renderTrophies(d) {
  const cellW = (HALF_W - 48 - 16) / 3;
  const cellH = 72;
  const cells = d.trophies
    .map((tr, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = r1(24 + col * (cellW + 8));
      const y = 58 + row * (cellH + 8);
      const tier = TIERS[tr.tier];
      const color = tier ? tier.color : C.locked;
      const cupFill = tier ? `fill="${color}"` : `fill="none" stroke="${C.locked}" stroke-width="1.4"`;
      const shine = tier
        ? `<g clip-path="url(#cup-clip)"><rect x="-30" y="0" width="18" height="34" fill="url(#trophy-shine)" transform="skewX(-18)">` +
          `<animate attributeName="x" values="-30;40;40" keyTimes="0;.16;1" dur="7s" begin="${r1(1.2 + i * 0.35)}s" repeatCount="indefinite"/></rect></g>`
        : "";
      return (
        `<g ${enter(0.15 + i * 0.08)}>` +
        `<rect x="${x}" y="${y}" width="${r1(cellW)}" height="${cellH}" rx="10" fill="${C.cell}" stroke="${tier ? (tier.label === "SS" ? C.iris : color) : C.line}" stroke-opacity="${tier ? 0.4 : 1}"/>` +
        `<g transform="translate(${r1(x + 13)} ${y + 19})" stroke="${color}" style="color:${color}">` +
        `<g ${cupFill}>${CUP}</g>${HANDLES.replace("<path ", `<path stroke="${tier ? color : C.locked}" `)}${shine}</g>` +
        `<text x="${r1(x + cellW - 11)}" y="${y + 21}" class="tier" text-anchor="end" fill="${tier ? (tier.label === "SS" ? C.iris : color) : C.locked}">${tier ? tier.label : "–"}</text>` +
        `<text x="${r1(x + 52)}" y="${y + 33}" class="lbl">${esc(tr.label)}</text>` +
        `<text x="${r1(x + 52)}" y="${y + 54}" class="val">${esc(tr.value)}</text>` +
        `</g>`
      );
    })
    .join("");

  return card({
    id: "trophies",
    w: HALF_W,
    h: HALF_H,
    title: "Trophies",
    caption: "tiers C to SS",
    label: `Trophies: ${d.trophies.map((t) => `${t.label} ${t.value} (${TIERS[t.tier]?.label ?? "locked"})`).join(", ")}.`,
    css:
      `.lbl{font:400 11px ${SANS};fill:${C.muted}}` +
      `.val{font:600 14px ${MONO};fill:${C.ink}}` +
      `.tier{font:700 11px ${MONO};letter-spacing:.04em}`,
    defs:
      ledGradient("trophy-ss", 0, 28, 4) +
      `<linearGradient id="trophy-shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
      `<clipPath id="cup-clip">${CUP}</clipPath>`,
    body: cells,
  });
}

// ---------------------------------------------------------------- activity

/** Smooth curve through the points that never overshoots them: each segment stays between its two values. */
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let p = `M${r1(pts[0][0])} ${r1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[Math.min(pts.length - 1, i + 2)];
    const t = 0.18;
    const lo = Math.min(y1, y2);
    const hi = Math.max(y1, y2);
    const clamp = (v) => Math.min(hi, Math.max(lo, v));
    const c1 = [x1 + (x2 - x0) * t, clamp(y1 + (y2 - y0) * t)];
    const c2 = [x2 - (x3 - x1) * t, clamp(y2 - (y3 - y1) * t)];
    p += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(x2)} ${r1(y2)}`;
  }
  return p;
}

function niceMax(v) {
  if (v <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * mag >= v) return m * mag;
  return 10 * mag;
}

export function renderActivity(d) {
  const W = 880;
  const H = 250;
  const x0 = 58;
  const x1 = W - 28;
  const yTop = 92;
  const yBase = 196;
  const days = d.days;
  const max = niceMax(Math.max(...days.map((x) => x.count), 1));
  const step = (x1 - x0) / (days.length - 1);
  const pts = days.map((x, i) => [x0 + i * step, yBase - (x.count / max) * (yBase - yTop)]);
  const line = smoothPath(pts);
  const area = `${line}L${r1(x1)} ${yBase}L${x0} ${yBase}Z`;
  const total = days.reduce((s, x) => s + x.count, 0);

  const grid = [0, 0.5, 1]
    .map((f) => {
      const y = r1(yBase - f * (yBase - yTop));
      return (
        `<path d="M${x0} ${y}H${x1}" stroke="${f === 0 ? C.line : C.track}" ${f === 0 ? "" : `stroke-dasharray="3 5"`}/>` +
        `<text x="${x0 - 12}" y="${y + 3.5}" class="axis" text-anchor="end">${fmt(Math.round(max * f))}</text>`
      );
    })
    .join("");
  const labels = days
    .map((x, i) => ((days.length - 1 - i) % 5 === 0 ? `<text x="${r1(pts[i][0])}" y="${yBase + 24}" class="axis" text-anchor="middle">${day(x.date, false)}</text>` : ""))
    .join("");
  const DRAW = 1.8;
  const dots = pts
    .map(([x, y], i) =>
      days[i].count > 0 ? `<circle cx="${r1(x)}" cy="${r1(y)}" r="2.6" fill="${C.ink}" ${enter(0.3 + (DRAW * i) / pts.length, "fade")}/>` : ""
    )
    .join("");

  // Label the busiest day.
  let peak = "";
  const pi = days.reduce((best, x, i) => (x.count > days[best].count ? i : best), 0);
  if (days[pi].count > 0) {
    const text = `${fmt(days[pi].count)} on ${day(days[pi].date, false)}`;
    const tw = measure(text, "mono", 10.5) + 18;
    const [px, py] = pts[pi];
    const tx = Math.min(x1 - tw, Math.max(x0, px - tw / 2));
    const ty = py - 34;
    peak =
      `<g ${enter(0.4 + DRAW)}>` +
      `<path d="M${r1(px)} ${r1(py - 8)}V${r1(ty + 20)}" stroke="${C.amber}" stroke-opacity=".6"/>` +
      `<rect x="${r1(tx)}" y="${r1(ty)}" width="${r1(tw)}" height="20" rx="10" fill="${C.ground}" stroke="${C.amber}" stroke-opacity=".7"/>` +
      `<text x="${r1(tx + tw / 2)}" y="${r1(ty + 13.6)}" class="peak" text-anchor="middle">${esc(text)}</text>` +
      `<circle cx="${r1(px)}" cy="${r1(py)}" r="4.5" fill="${C.amber}"/>` +
      `</g>`;
  }

  const drawAnim = tween("stroke-dashoffset", 1, 0, { delay: 0.3, dur: DRAW, ease: ".4 .1 .3 1" });
  return card({
    id: "activity",
    w: W,
    h: H,
    title: "Contribution activity",
    caption: `last ${days.length} days · ${fmt(total)} contributions`,
    label: `Contribution activity over the last ${days.length} days: ${total} contributions.`,
    led: { dur: 12 },
    css:
      `.axis{font:400 10px ${MONO};fill:${C.muted}}` +
      `.peak{font:500 10.5px ${MONO};fill:${C.amber}}`,
    defs:
      `<linearGradient id="act-line" gradientUnits="userSpaceOnUse" x1="${x0}" y1="0" x2="${x1}" y2="0">${LED.map((c, i) => `<stop offset="${r1(i / 3)}" stop-color="${c}"/>`).join("")}</linearGradient>` +
      `<linearGradient id="act-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.iris}" stop-opacity=".3"/><stop offset="1" stop-color="${C.iris}" stop-opacity="0"/></linearGradient>` +
      `<filter id="act-bloom" x="-5%" y="-30%" width="110%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>`,
    body:
      grid +
      labels +
      `<path d="${area}" fill="url(#act-area)" ${enter(0.3 + DRAW * 0.6, "fade")}/>` +
      `<path d="${line}" fill="none" stroke="url(#act-line)" stroke-width="5" opacity=".55" filter="url(#act-bloom)" pathLength="1" stroke-dasharray="1" stroke-dashoffset="0">${drawAnim}</path>` +
      `<path d="${line}" fill="none" stroke="url(#act-line)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="0">${drawAnim}</path>` +
      dots +
      peak,
  });
}

// ---------------------------------------------------------------- featured project

export function renderFeatured(d) {
  const W = 880;
  const H = 330;
  const img = readFileSync(join(ROOT, "scripts", "assets", "airglow-rig.webp")).toString("base64");
  const imgW = 300;
  const imgH = r1((imgW * 557) / 600);
  const ix = 30;
  const iy = r1((H - imgH) / 2 + 8);
  const tx = 362;
  const colW = W - tx - 28;

  const desc = wrap(d.description, "sans", 13.5, colW).slice(0, 2);
  const tileW = (colW - 24) / 4;
  const tiles = d.tiles
    .map((t, i) => {
      const x = r1(tx + i * (tileW + 8));
      const size = fit(t.value, "semibold", 19, tileW - 24, 12);
      return (
        `<g ${enter(0.55 + i * 0.07)}><rect x="${x}" y="214" width="${r1(tileW)}" height="58" rx="10" fill="${C.cell}" stroke="${C.line}"/>` +
        `<text x="${r1(x + 12)}" y="234" class="tl">${esc(t.label)}</text>` +
        `<text x="${r1(x + 12)}" y="259" class="tv" style="font-size:${size}px">${esc(t.value)}</text></g>`
      );
    })
    .join("");

  let cx = tx;
  const chips = [];
  for (const chip of d.chips) {
    const w = measure(chip, "mono", 10.5) + 20;
    if (cx + w > tx + colW) break;
    chips.push(
      `<rect x="${r1(cx)}" y="286" width="${r1(w)}" height="22" rx="11" fill="none" stroke="${C.line}"/>` +
        `<text x="${r1(cx + w / 2)}" y="300.5" class="chip" text-anchor="middle">${esc(chip)}</text>`
    );
    cx += w + 8;
  }

  return card({
    id: "featured",
    w: W,
    h: H,
    title: "",
    label: `${d.name}: ${d.tagline} ${d.tiles.map((t) => `${t.label} ${t.value}`).join(", ")}.`,
    fonts: {},
    led: { dur: 9 },
    css:
      `.eye{font:500 11px ${MONO};fill:${C.amber};letter-spacing:.16em}` +
      `.name{font:600 44px ${SANS};fill:${C.ink};letter-spacing:-.01em}` +
      `.tag{font:400 17px ${SANS};fill:${C.soft}}` +
      `.desc{font:400 13.5px ${SANS};fill:${C.muted}}` +
      `.tl{font:400 9.5px ${MONO};fill:${C.muted};letter-spacing:.1em}` +
      `.tv{font:600 19px ${SANS};fill:${C.ink}}` +
      `.chip{font:400 10.5px ${MONO};fill:${C.soft}}`,
    defs:
      `<radialGradient id="rig-glow" cx="${ix + imgW / 2}" cy="${iy + imgH * 0.55}" r="200" gradientUnits="userSpaceOnUse">` +
      `<stop offset="0" stop-color="${C.mint}" stop-opacity=".26"/><stop offset=".45" stop-color="${C.iris}" stop-opacity=".12"/><stop offset="1" stop-color="${C.iris}" stop-opacity="0"/></radialGradient>`,
    body:
      `<rect width="${tx}" height="${H}" fill="url(#rig-glow)" rx="14"><animate attributeName="opacity" values=".7;1;.7" dur="7s" repeatCount="indefinite"/></rect>` +
      `<image ${enter(0.1)} href="data:image/webp;base64,${img}" x="${ix}" y="${iy}" width="${imgW}" height="${imgH}"/>` +
      `<g ${enter(0.2)}><text x="${tx}" y="66" class="eye">FEATURED PROJECT</text></g>` +
      `<g ${enter(0.28)}><text x="${tx - 2}" y="114" class="name">${esc(d.name)}</text></g>` +
      `<g ${enter(0.36)}><text x="${tx}" y="146" class="tag">${esc(d.tagline)}</text></g>` +
      `<g ${enter(0.44)}>${desc.map((l, i) => `<text x="${tx}" y="${174 + i * 19}" class="desc">${esc(l)}</text>`).join("")}</g>` +
      tiles +
      `<g ${enter(0.85)}>${chips.join("")}</g>`,
  });
}
