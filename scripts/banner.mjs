// The header banner and the footer.
import { C, LED, MONO, SANS, ENTER_CSS, enter, esc, fontFaces, ledStrip, measure, r1 } from "./lib.mjs";

const W = 880;
const H = 280;

// Airglow's own mark (from airglowrgb.com/assets/icon.svg), drawn on the fan hub.
const MARK =
  `<path d="M7.85 37.53A25 25 0 0 1 56.15 37.53" fill="none" stroke="${C.mint}" stroke-width="4.5" stroke-linecap="round"/>` +
  `<path d="M6 44H58" stroke="${C.ink}" stroke-width="4.5" stroke-linecap="round"/>` +
  `<path d="M18 44a14 14 0 0 1 28 0z" fill="${C.ink}"/>`;

/** An ARGB case fan: square frame, spinning blades, a rotating LED ring that lights the panel. */
function fan(cx, cy) {
  const ringR = 74;
  const circumference = 2 * Math.PI * ringR;
  // Swept blades: narrow at the hub, wide at the rim, tips cut along the frame's circle.
  const P = (r, deg) => `${r1(r * Math.cos((deg * Math.PI) / 180))} ${r1(r * Math.sin((deg * Math.PI) / 180))}`;
  const blade =
    `M${P(17, -12)}C${P(36, -16)} ${P(54, -36)} ${P(67, -50)}` +
    `A67 67 0 0 1 ${P(67, -16)}` +
    `C${P(52, -4)} ${P(32, 12)} ${P(17, 16)}A17 17 0 0 0 ${P(17, -12)}Z`;
  const blades = Array.from({ length: 7 }, (_, i) =>
    `<path transform="rotate(${r1((360 / 7) * i)})" d="${blade}" fill="url(#blade)" stroke="#fff" stroke-opacity=".22" stroke-width=".6"/>`
  ).join("");
  const screws = [
    [-74, -74],
    [74, -74],
    [-74, 74],
    [74, 74],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#120e18" stroke="${C.line}"/>`)
    .join("");
  const defs =
    `<radialGradient id="cast" cx="${cx}" cy="${cy}" r="300" gradientUnits="userSpaceOnUse">` +
    `<stop offset="0" stop-color="${C.iris}" stop-opacity=".34"/>` +
    `<stop offset=".35" stop-color="${C.rose}" stop-opacity=".12"/>` +
    `<stop offset="1" stop-color="${C.ground}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">` +
    LED.map((c, i) => `<stop offset="${r1(i / (LED.length - 1))}" stop-color="${c}"/>`).join("") +
    `</linearGradient>` +
    `<radialGradient id="blade" cx="0" cy="0" r="67" gradientUnits="userSpaceOnUse"><stop offset=".2" stop-color="#7d6f93" stop-opacity=".9"/><stop offset="1" stop-color="#e9e1f2" stop-opacity=".92"/></radialGradient>` +
    `<radialGradient id="tint"><stop offset=".55" stop-color="${C.iris}" stop-opacity="0"/><stop offset="1" stop-color="${C.iris}" stop-opacity=".35"/></radialGradient>` +
    `<filter id="bloom" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>`;
  const body =
    // Light the ring throws on the panel, breathing slowly (Airglow's "breathing" effect).
    `<rect width="${W}" height="${H}" fill="url(#cast)"><animate attributeName="opacity" values=".75;1;.75" dur="7s" repeatCount="indefinite"/></rect>` +
    `<g transform="translate(${cx} ${cy})">` +
    `<rect x="-90" y="-90" width="180" height="180" rx="22" fill="#1d1727" stroke="${C.line}"/>` +
    screws +
    `<circle r="81" fill="#120e18"/>` +
    `<g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2.4s" repeatCount="indefinite"/>${blades}</g>` +
    `<circle r="70" fill="url(#tint)"/>` +
    `<g><animateTransform attributeName="transform" type="rotate" from="0" to="-360" dur="12s" repeatCount="indefinite"/>` +
    `<circle r="${ringR}" fill="none" stroke="url(#ring)" stroke-width="9" filter="url(#bloom)" opacity=".9"/>` +
    `<circle r="${ringR}" fill="none" stroke="url(#ring)" stroke-width="6"/>` +
    `<circle r="${ringR}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="0.01 ${r1(circumference / 40)}"/>` +
    `</g>` +
    `<circle r="19" fill="#2a2236" stroke="${C.locked}"/>` +
    `<g transform="translate(-13 -14.5) scale(.41)">${MARK}</g>` +
    `</g>`;
  return { defs, body };
}

/** Fireflies: a few slow drifters that blink like the real thing. */
function fireflies() {
  const flies = [
    { x: 612, y: 52, path: "m0 0c14-10 30-4 26 10s-24 14-26-10", dur: 11, blink: 0.1 },
    { x: 846, y: 70, path: "m0 0c-10 12-4 28 8 24s10-22-8-24", dur: 13, blink: 0.45 },
    { x: 836, y: 214, path: "m0 0c-16 4-18 20-4 24s20-12 4-24", dur: 12, blink: 0.7 },
    { x: 598, y: 214, path: "m0 0c10 10 26 8 26-6s-18-16-26 6", dur: 14, blink: 0.25 },
    { x: 500, y: 40, path: "m0 0c16 2 24 14 12 20s-22-4-12-20", dur: 15, blink: 0.85 },
  ];
  return flies
    .map(({ x, y, path, dur, blink }) => {
      // Mostly dark, a soft on-off pulse once per cycle.
      const k = (v) => r1(Math.min(0.99, Math.max(0.01, blink + v)) * 1000) / 1000;
      const keys = `0;${k(-0.04)};${k(0)};${k(0.08)};${k(0.13)};1`;
      return (
        `<g transform="translate(${x} ${y})"><g opacity="0">` +
        `<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="${keys}" dur="${dur / 2}s" repeatCount="indefinite"/>` +
        `<animateMotion path="${path}" dur="${dur}s" repeatCount="indefinite"/>` +
        `<circle r="7" fill="${C.amber}" opacity=".35" filter="url(#bloom)"/>` +
        `<circle r="1.9" fill="#fff3d6"/>` +
        `</g></g>`
      );
    })
    .join("");
}

/**
 * A shell line that types each message, holds it, deletes it, moves on.
 * Discrete SMIL keyframes, so it needs no script and loops forever.
 */
function typing(lines, x, y, size) {
  const cw = 0.7 * size; // Martian Mono advance, pinned to width 100
  const TYPE = 0.055;
  const HOLD = 2.4;
  const DEL = 0.022;
  const GAP = 0.45;
  const LEAD = 0.9;
  const textX = x + cw * 2;

  let t = LEAD;
  const slots = lines.map((text) => {
    const n = [...text].length;
    const slot = { text, n, start: t };
    t += n * TYPE + HOLD + n * DEL + GAP;
    return slot;
  });
  const total = t;
  const key = (time) => (Math.round((time / total) * 10000) / 10000).toFixed(4);

  const cursor = [[0, textX]];
  const rows = slots.map((s, i) => {
    const ev = [[0, 0]];
    for (let k = 1; k <= s.n; k++) ev.push([s.start + k * TYPE, k]);
    const delStart = s.start + s.n * TYPE + HOLD;
    for (let k = 1; k <= s.n; k++) ev.push([delStart + k * DEL, s.n - k]);
    ev.forEach(([time, chars]) => time > 0 && cursor.push([time, textX + chars * cw]));
    const values = ev.map(([, c]) => r1(c * cw)).join(";");
    const keyTimes = ev.map(([time]) => key(time)).join(";");
    const full = r1(s.n * cw + 2);
    return (
      `<clipPath id="type${i}"><rect x="${textX - 1}" y="${y - size}" width="${i === 0 ? full : 0}" height="${size * 1.6}">` +
      `<animate attributeName="width" values="${values}" keyTimes="${keyTimes}" calcMode="discrete" dur="${r1(total)}s" repeatCount="indefinite"/>` +
      `</rect></clipPath>` +
      `<text x="${textX}" y="${y}" class="type" clip-path="url(#type${i})">${esc(s.text)}</text>`
    );
  });
  cursor.sort((a, b) => a[0] - b[0]);
  const cursorSvg =
    `<rect x="${textX + slots[0].n * cw}" y="${y - size * 0.86}" width="${r1(cw * 0.62)}" height="${r1(size * 1.08)}" fill="${C.amber}">` +
    `<animate attributeName="x" values="${cursor.map(([, cx]) => r1(cx)).join(";")}" keyTimes="${cursor.map(([time]) => key(time)).join(";")}" calcMode="discrete" dur="${r1(total)}s" repeatCount="indefinite"/>` +
    `<animate attributeName="opacity" values="1;.15" dur="1.05s" calcMode="discrete" repeatCount="indefinite"/>` +
    `</rect>`;
  return `<text x="${x}" y="${y}" class="prompt">&gt;</text>` + rows.join("") + cursorSvg;
}

export function renderBanner({ name, tagline, lines }) {
  const f = fan(722, 132);
  const strip = ledStrip({ id: "base", x: 0, y: 263, w: W, h: 5, cast: "up", castSize: 120, castOpacity: 0.2, dur: 10 });
  let titleSize = 56;
  while (measure(name, "semibold", titleSize) > 560) titleSize -= 2;

  const css =
    fontFaces() +
    ENTER_CSS +
    `.hi{font:400 13px ${MONO};fill:${C.amber};letter-spacing:.08em}` +
    `.name{font:600 ${titleSize}px ${SANS};fill:${C.ink};letter-spacing:-.01em}` +
    `.tag{font:400 18px ${SANS};fill:${C.soft}}` +
    `.type{font:400 13.5px ${MONO};fill:${C.ink}}` +
    `.prompt{font:600 13.5px ${MONO};fill:${C.amber}}`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">` +
    `<title id="t">${esc(name)}</title><desc id="d">${esc(tagline)} ${esc(lines.join(". "))}.</desc>` +
    `<defs><style>${css}</style><clipPath id="frame"><rect width="${W}" height="${H}" rx="18"/></clipPath>${f.defs}${strip.defs}</defs>` +
    `<g clip-path="url(#frame)">` +
    `<rect width="${W}" height="${H}" fill="${C.ground}"/>` +
    f.body +
    strip.body +
    fireflies() +
    `</g>` +
    `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="17.5" fill="none" stroke="${C.line}"/>` +
    `<g ${enter(0.1)}><text x="40" y="82" class="hi">hi, i'm</text></g>` +
    `<g ${enter(0.2)}><text x="38" y="136" class="name">${esc(name)}</text></g>` +
    `<g ${enter(0.35)}><text x="40" y="172" class="tag">${esc(tagline)}</text></g>` +
    `<g ${enter(0.5, "fade")}>${typing(lines, 40, 224, 13.5)}</g>` +
    `</svg>`
  );
}

export function renderFooter({ left, right }) {
  const w = W;
  const h = 64;
  const strip = ledStrip({ id: "foot", x: 0, y: h - 6, w, h: 4, cast: "up", castSize: 50, castOpacity: 0.16, dur: 10 });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(left)}">` +
    `<defs><style>${fontFaces({ regular: false, semibold: false })}` +
    `.l{font:400 11.5px ${MONO};fill:${C.muted};letter-spacing:.02em}.r{font:500 11.5px ${MONO};fill:${C.amber};letter-spacing:.02em}</style>` +
    `<clipPath id="fc"><rect width="${w}" height="${h}" rx="14"/></clipPath>${strip.defs}</defs>` +
    `<g clip-path="url(#fc)"><rect width="${w}" height="${h}" fill="${C.ground}"/>${strip.body}</g>` +
    `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="13.5" fill="none" stroke="${C.line}"/>` +
    `<text x="28" y="34" class="l">${esc(left)}</text>` +
    `<text x="${w - 28}" y="34" class="r" text-anchor="end">${esc(right)}</text>` +
    `</svg>`
  );
}
