// Renders README.md through GitHub's own Markdown API into .preview/index.html,
// styled like a profile README, so the page can be checked before pushing.
//
//   GITHUB_TOKEN=... node tools/preview.mjs
//   then serve the repo root and open /.preview/?theme=dark (or light)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const res = await fetch("https://api.github.com/markdown", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "Content-Type": "application/json", "User-Agent": "profile-preview" },
  body: JSON.stringify({ text: readFileSync(join(root, "README.md"), "utf8"), mode: "gfm", context: "Heavenlystorm/Heavenlystorm" }),
});
if (!res.ok) throw new Error(`markdown API ${res.status}: ${await res.text()}`);
const body = await res.text();

const page = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<base href="/"><title>Profile preview</title>
<script>
  const theme = new URLSearchParams(location.search).get("theme") || "dark";
  document.write('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/github-markdown-css@5.8.1/github-markdown-' + theme + '.css">');
  document.documentElement.dataset.theme = theme;
</script>
<style>
  html[data-theme=dark] body { background:#0d1117 } html[data-theme=light] body { background:#fff }
  body { margin:0; padding:24px 16px }
  .box { max-width: 896px; margin: 0 auto; border: 1px solid #3d444d; border-radius: 6px; padding: 24px; box-sizing: border-box }
  html[data-theme=light] .box { border-color:#d1d9e0 }
  .crumb { font: 12px ui-monospace, monospace; opacity:.7; margin-bottom: 16px }
</style></head>
<body><div class="box"><div class="crumb">Heavenlystorm / README.md</div><article class="markdown-body">${body}</article></div></body></html>`;

mkdirSync(join(root, ".preview"), { recursive: true });
writeFileSync(join(root, ".preview", "index.html"), page);
console.log("wrote .preview/index.html");
