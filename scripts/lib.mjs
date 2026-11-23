// Shared pieces for every SVG on the profile: palette, embedded fonts,
// text measuring, the LED strip and the card frame.
//
// Art direction: the profile is a lit PC case. Light only comes from things
// that emit it (LED strips, fan rings, fireflies). Cards animate in once;
// each keeps a single slow LED strip running.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, "..");

export const C = {
  ground: "#17131f",
  panel: "#211a2c",
  panelLow: "#1b1524",
  cell: "#1c1626",
  line: "#3b3247",
  track: "#2e2639",
  locked: "#4a3f56",
  ink: "#f7ede1",
  soft: "#cfc2d3",
  muted: "#a395ad",
  amber: "#ffc38b",
  rose: "#f5a3c7",
  iris: "#b99dff",
  mint: "#a4dec6",
  sky: "#8fc7ff",
};

// The order an Airglow "spectrum" wave runs through.
export const LED = [C.amber, C.rose, C.iris, C.mint];

export const SANS = "Plex, 'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif";
export const MONO = "Martian, 'Martian Mono', ui-monospace, 'Cascadia Mono', monospace";

const metrics = JSON.parse(readFileSync(join(here, "fonts", "metrics.json"), "utf8"));
const fontCache = new Map();
function fontData(name) {
  if (!fontCache.has(name)) {
    fontCache.set(name, readFileSync(join(here, "fonts", `${name}.woff2`)).toString("base64"));
  }
  return fontCache.get(name);
}

/** @font-face rules for the faces a drawing uses. */
export function fontFaces({ regular = true, semibold = true, mono = true } = {}) {
  const face = (family, weight, name) =>
    `@font-face{font-family:${family};font-weight:${weight};font-display:block;` +
    `src:url(data:font/woff2;base64,${fontData(name)}) format("woff2")}`;
  return [
    regular && face("Plex", 400, "plex-regular"),
    semibold && face("Plex", 600, "plex-semibold"),
    mono && face("Martian", "100 800", "martian-mono"),
  ]
    .filter(Boolean)
    .join("");
}

const FACE_KEY = { sans: "plex-regular", semibold: "plex-semibold", mono: "martian-mono" };

/** Width of a string in px, from the subset fonts' advance widths. */
export function measure(text, face, size, letterSpacing = 0) {
  const table = metrics[FACE_KEY[face]];
  let em = 0;
  for (const ch of String(text)) em += table[ch] ?? 0.6;
  return em * size + letterSpacing * size * Math.max(0, [...String(text)].length - 1);
}

/** Split text into lines no wider than maxWidth. */
export function wrap(text, face, size, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, face, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const fmt = (n) => Number(n).toLocaleString("en-US");

export function compact(n) {
  if (n < 10000) return fmt(n);
  if (n < 1e6) return `${(n / 1000).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-11-22" -> "Nov 22, 2026" (or "Nov 22" with year=false). */
export function day(iso, year = true) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return year ? `${MONTHS[m - 1]} ${d}, ${y}` : `${MONTHS[m - 1]} ${d}`;
}

export const r1 = (n) => Math.round(n * 10) / 10;

/**
 * Gradient that runs the LED wave along x, seamlessly, forever.
 * Use with fill="url(#id)".
 */
export function ledGradient(id, x, w, dur = 8, { reverse = false, colors = LED } = {}) {
  const loop = [...colors, colors[0]];
  const stops = loop
    .map((c, i) => `<stop offset="${r1((i / (loop.length - 1)) * 100)}%" stop-color="${c}"/>`)
    .join("");
  const [from, to] = reverse ? [`${w} 0`, "0 0"] : ["0 0", `${w} 0`];
  return (
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x}" y1="0" x2="${x + w}" y2="0" spreadMethod="repeat">` +
    stops +
    `<animateTransform attributeName="gradientTransform" type="translate" from="${from}" to="${to}" dur="${dur}s" repeatCount="indefinite"/>` +
    `</linearGradient>`
  );
}

/**
 * An addressable LED strip: individual LEDs, the wave running through them,
 * a bloom, and the light it throws onto the surface beside it.
 * cast: "up" | "down" | null.
 */
export function ledStrip({ id, x, y, w, h = 4, dur = 8, cast = "up", castSize = 70, castOpacity = 0.2, pitch = 7 }) {
  const grad = `${id}-g`;
  const castY = cast === "up" ? y - castSize : y + h;
  const fade = cast === "up" ? ["0", "1"] : ["1", "0"];
  const defs =
    ledGradient(grad, x, w, dur) +
    `<pattern id="${id}-p" x="${x}" y="${y}" width="${pitch}" height="${h}" patternUnits="userSpaceOnUse">` +
    `<rect x="0.6" y="0" width="${r1(pitch - 1.6)}" height="${h}" rx="${r1(h / 3)}" fill="#fff"/></pattern>` +
    `<mask id="${id}-m"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}-p)"/></mask>` +
    (cast
      ? `<linearGradient id="${id}-cf" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#fff" stop-opacity="${fade[0]}"/>` +
        `<stop offset="1" stop-color="#fff" stop-opacity="${fade[1]}"/></linearGradient>` +
        `<mask id="${id}-cm"><rect x="${x}" y="${castY}" width="${w}" height="${castSize}" fill="url(#${id}-cf)"/></mask>`
      : "") +
    `<filter id="${id}-b" x="-5%" y="-400%" width="110%" height="900%"><feGaussianBlur stdDeviation="${r1(h * 1.4)}"/></filter>`;
  const body =
    (cast
      ? `<rect x="${x}" y="${castY}" width="${w}" height="${castSize}" fill="url(#${grad})" opacity="${castOpacity}" mask="url(#${id}-cm)"/>`
      : "") +
    `<rect x="${x}" y="${y - h * 0.5}" width="${w}" height="${h * 2}" fill="url(#${grad})" opacity="0.75" filter="url(#${id}-b)"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#120e18"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${grad})" mask="url(#${id}-m)"/>`;
  return { defs, body };
}

/** Entrance animation: elements with class "in" rise and fade in once. */
export const ENTER_CSS =
  ".in{animation:rise .7s cubic-bezier(.2,.7,.2,1) both}" +
  "@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}" +
  ".fade{animation:fade .9s ease-out both}@keyframes fade{from{opacity:0}to{opacity:1}}" +
  "@media (prefers-reduced-motion:reduce){.in,.fade{animation:none}}";

/**
 * One-shot SMIL tween that starts at t=0 and holds `from` through the delay,
 * so nothing flashes its final state before the animation begins. Without SMIL
 * the element keeps its static attribute, which should be the final value.
 */
export function tween(attr, from, to, { delay = 0, dur = 1.4, ease = ".2 .7 .2 1" } = {}) {
  if (delay <= 0) {
    return `<animate attributeName="${attr}" values="${from};${to}" keyTimes="0;1" calcMode="spline" keySplines="${ease}" dur="${dur}s" fill="freeze"/>`;
  }
  const total = delay + dur;
  return (
    `<animate attributeName="${attr}" values="${from};${from};${to}" keyTimes="0;${(delay / total).toFixed(3)};1" ` +
    `calcMode="spline" keySplines="0 0 1 1;${ease}" dur="${total.toFixed(2)}s" fill="freeze"/>`
  );
}

/** `class="in" style="animation-delay:…"` */
export const enter = (delay, cls = "in") => `class="${cls}" style="animation-delay:${r1(delay)}s"`;

/**
 * A dark anodised panel with an LED strip along its top edge.
 * Returns a complete SVG document.
 */
export function card({ id, w, h, title, caption = "", body, defs = "", css = "", fonts = {}, led = {}, label }) {
  // Full width: the card's rounded clip ends the strip, so its light has no hard sides.
  const strip = ledStrip({
    id: `${id}-led`,
    x: 0,
    y: 0,
    w,
    h: 3,
    cast: "down",
    castSize: 46,
    castOpacity: 0.12,
    dur: led.dur ?? 9,
  });
  const style =
    fontFaces(fonts) +
    ENTER_CSS +
    `.title{font:600 16px ${SANS};fill:${C.ink}}` +
    `.cap{font:400 10.5px ${MONO};fill:${C.muted};letter-spacing:.02em}` +
    css;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}-t">` +
    `<title id="${id}-t">${esc(label ?? title)}</title>` +
    `<defs><style>${style}</style>` +
    `<clipPath id="${id}-clip"><rect width="${w}" height="${h}" rx="14"/></clipPath>` +
    `<linearGradient id="${id}-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.panel}"/><stop offset="1" stop-color="${C.panelLow}"/></linearGradient>` +
    strip.defs +
    defs +
    `</defs>` +
    `<g clip-path="url(#${id}-clip)"><rect width="${w}" height="${h}" fill="url(#${id}-bg)"/>${strip.body}</g>` +
    `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="13.5" fill="none" stroke="${C.line}"/>` +
    (title ? `<text x="24" y="40" class="title">${esc(title)}</text>` : "") +
    (caption ? `<text x="${w - 24}" y="40" class="cap" text-anchor="end">${esc(caption)}</text>` : "") +
    body +
    `</svg>`
  );
}
