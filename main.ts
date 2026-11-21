// The World Today v2 — Friday 20 November 2026 (make.fun news-image-20261120).
// Node 22, standard library only. Draws a 1024x1024 newspaper front page
// entirely in code — own PNG encoder (CRC32 + zlib), own 5x7 bitmap font,
// fixed-seed layout — and writes it to /output/entry.png. Deterministic:
// two runs produce identical bytes. No network, no Math.random, no Date.now.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- font: 5x7
// Each glyph is 7 rows of 5 bits, top to bottom, leftmost column first.
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  '•': ['00000', '00000', '01110', '01110', '01110', '00000', '00000'],
};

// ---------------------------------------------------------------- canvas
const PAPER: [number, number, number] = [244, 236, 220];
const INK: [number, number, number] = [16, 16, 16];
const RED: [number, number, number] = [178, 34, 34];
const WHITE: [number, number, number] = [255, 255, 255];

const img = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  img[i * 3] = PAPER[0];
  img[i * 3 + 1] = PAPER[1];
  img[i * 3 + 2] = PAPER[2];
}

function px(x: number, y: number, c: [number, number, number]): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  img[o] = c[0];
  img[o + 1] = c[1];
  img[o + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: [number, number, number]): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c);
}

function hline(y: number, x0: number, x1: number, c: [number, number, number], t = 1): void {
  rect(x0, y, x1 - x0, t, c);
}

function vline(x: number, y0: number, y1: number, c: [number, number, number], t = 1): void {
  rect(x, y0, t, y1 - y0, c);
}

// Fixed-seed LCG (deterministic; seed 20261120).
let seed = 20261120;
function rnd(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawText(s: string, x: number, y: number, scale: number, c: [number, number, number]): void {
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] ?? FONT['?'];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === '1') {
          rect(x + i * 6 * scale + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
  }
}

function drawTextCentered(s: string, cx: number, y: number, scale: number, c: [number, number, number]): void {
  drawText(s, Math.round(cx - textWidth(s, scale) / 2), y, scale, c);
}

// Word-wrap plain text to lines that fit maxWidth px at the given scale.
function wrap(s: string, maxWidth: number, scale: number): string[] {
  const maxChars = Math.max(1, Math.floor((maxWidth + scale) / (6 * scale)));
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur === '' ? w : `${cur} ${w}`;
    if (next.length <= maxChars) {
      cur = next;
    } else {
      if (cur !== '') lines.push(cur);
      // A single over-long word is split hard (none of our words are).
      cur = w.length > maxChars ? w.slice(0, maxChars) : w;
      if (w.length > maxChars) lines.push(cur), (cur = w.slice(maxChars));
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

function drawPara(s: string, x: number, y: number, maxWidth: number, scale: number, c: [number, number, number], lineH: number): number {
  const lines = wrap(s, maxWidth, scale);
  lines.forEach((ln, i) => drawText(ln, x, y + i * lineH, scale, c));
  return y + lines.length * lineH;
}

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    img.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- layout
const M = 40; // margin
const R = W - M; // right edge of text area

// Masthead
drawTextCentered('THE WORLD TODAY', W / 2, 30, 9, INK);
hline(100, M, R, INK, 2);
hline(105, M, R, INK, 1);

// Black date band
rect(M, 112, R - M, 38, INK);
drawTextCentered('FRIDAY 20 NOVEMBER 2026', W / 2, 120, 4, WHITE);

// Lead kicker + headline + deck
drawText('VICE CITY - VIDEO GAMES', M, 164, 2, RED);
drawText('GTA VI: $3.79 BILLION', M, 184, 6, INK);
drawText('IN ONE DAY', M, 228, 6, INK);
drawText('32.5M COPIES PRE-RELEASE - BIGGEST LAUNCH EVER', M, 278, 2, INK);
hline(298, M, R, INK, 1);

// Vice City dusk skyline, y 306..436
const SKY_TOP = 306;
const SKY_BOT = 436;
const SKY_H = SKY_BOT - SKY_TOP;
for (let y = 0; y < SKY_H; y++) {
  const t = y / SKY_H;
  // deep purple -> magenta -> orange horizon
  let c: [number, number, number];
  if (t < 0.45) {
    const u = t / 0.45;
    c = [Math.round(38 + (88 - 38) * u), Math.round(22 + (28 - 22) * u), Math.round(84 + (96 - 84) * u)];
  } else if (t < 0.8) {
    const u = (t - 0.45) / 0.35;
    c = [Math.round(88 + (214 - 88) * u), Math.round(28 + (84 - 28) * u), Math.round(96 + (120 - 96) * u)];
  } else {
    const u = (t - 0.8) / 0.2;
    c = [Math.round(214 + (250 - 214) * u), Math.round(84 + (170 - 84) * u), Math.round(120 + (110 - 120) * u)];
  }
  hline(SKY_TOP + y, M, R, c, 1);
}
// Sun
const SUN: [number, number, number] = [247, 215, 116];
for (let dy = -26; dy <= 26; dy++) {
  for (let dx = -26; dx <= 26; dx++) {
    if (dx * dx + dy * dy <= 26 * 26) px(812 + dx, 362 + dy, SUN);
  }
}
// Buildings (dark silhouettes, fixed LCG windows)
const BLD: [number, number, number] = [26, 30, 60];
let bx = M;
while (bx < R) {
  const bw = 34 + Math.floor(rnd() * 44);
  const bh = 34 + Math.floor(rnd() * 62);
  const top = SKY_BOT - 14 - bh;
  rect(bx, top, bw, bh + 14, BLD);
  // lit windows
  for (let wy = top + 6; wy < SKY_BOT - 18; wy += 11) {
    for (let wx = bx + 5; wx < bx + bw - 4; wx += 10) {
      if (rnd() < 0.45) rect(wx, wy, 4, 5, [255, 214, 110]);
    }
  }
  bx += bw + 4;
}
// Water strip with reflection streaks
rect(M, SKY_BOT - 14, R - M, 14, [22, 34, 74]);
for (let i = 0; i < 5; i++) {
  const y = SKY_BOT - 11 + i * 3;
  const x0 = M + 30 + Math.floor(rnd() * 300);
  hline(y, x0, Math.min(R - 30, x0 + 120 + Math.floor(rnd() * 220)), [255, 122, 184], 1);
}
// "VICE CITY" over the skyline, painted last so no building covers it
drawText('VICE CITY', 58, 330, 4, [255, 122, 184]);

// Lead body
drawPara(
  'TAKE-TWO SAYS THE GAME TOOK IN $3.79 BILLION IN RETAIL SALES ON ITS FIRST DAY, THE BIGGEST ENTERTAINMENT LAUNCH IN HISTORY. A RECORD 32.5 MILLION COPIES WERE SOLD BEFORE RELEASE, AND REVIEWERS GAVE IT A 99 ON METACRITIC.',
  M,
  450,
  R - M,
  2,
  INK,
  16,
);
hline(506, M, R, INK, 1);

// Three columns, y 520..800
const COL_Y = 520;
const COL_W = 304;
const COLS = [M, 360, 680];
vline(352, COL_Y, 798, INK, 1);
vline(672, COL_Y, 798, INK, 1);

// Column A — markets
drawText('MARKETS - TECHNOLOGY', COLS[0], COL_Y, 2, RED);
drawText("WALL STREET'S", COLS[0], COL_Y + 18, 3, INK);
drawText('BLACK FRIDAY', COLS[0], COL_Y + 42, 3, INK);
drawPara(
  'THE S&P 500 FELL 3.7 PERCENT ON FRIDAY, ITS SEVENTH STRAIGHT LOSS, AND INTO CORRECTION. THE NASDAQ FELL 5.28 PERCENT, WIPING OUT ALL OF ITS 2026 GAINS. NVIDIA DROPPED 14 PERCENT AFTER REUTERS REPORTED THE SEC IS PROBING ITS ACCOUNTING. ASIA FELL FIRST: NIKKEI AND KOSPI EACH DOWN 4.8 PERCENT.',
  COLS[0],
  COL_Y + 72,
  COL_W,
  2,
  INK,
  16,
);

// Column B — Poland
drawText('POLAND - SECURITY', COLS[1], COL_Y, 2, RED);
drawText('MISSILES LAND', COLS[1], COL_Y + 18, 3, INK);
drawText('IN POLAND', COLS[1], COL_Y + 42, 3, INK);
drawPara(
  "TWO RUSSIAN MISSILES AND A DRONE CRASHED IN SOUTH-EASTERN POLAND ON FRIDAY DURING RUSSIA'S BIGGEST NOVEMBER STRIKE ON UKRAINE. A KH-101 WAS CONFIRMED NEAR NOWY LIPOWIEC. NATO CONDEMNED 'GRAVE VIOLATIONS' OF POLISH AIRSPACE AND SCRAMBLED JETS. PM TUSK CALLED IT A DELIBERATE PROVOCATION.",
  COLS[1],
  COL_Y + 72,
  COL_W,
  2,
  INK,
  16,
);

// Column C — Prabowo / Xi
drawText('SHENZHEN - DIPLOMACY', COLS[2], COL_Y, 2, RED);
drawText('PRABOWO MEETS XI', COLS[2], COL_Y + 18, 3, INK);
drawText('SUMMIT JUDGED', COLS[2], COL_Y + 42, 3, INK);
drawText('A FAILURE', COLS[2], COL_Y + 66, 3, INK);
drawPara(
  "PRESIDENT PRABOWO MET PRESIDENT XI IN SHENZHEN ON FRIDAY TO TALK TRADE, INVESTMENT AND THE SOUTH CHINA SEA. REUTERS CALLED THE SUMMIT A FAILURE OF PERSONAL DIPLOMACY. TRUMP CALLED IT '12 OUT OF 10'.",
  COLS[2],
  COL_Y + 96,
  COL_W,
  2,
  INK,
  16,
);

// IN BRIEF
hline(810, M, R, INK, 1);
drawText('IN BRIEF', M, 822, 3, INK);
const BRIEF_LEFT = [
  'TRUMP THREATENS BIG TAXES ON FIRMS BUILDING AI DATA CENTERS ABROAD',
  'UK PLEDGES 1,000+ DRONES FOR UKRAINE, 260M POUND PACKAGE',
  'TRUMP PARDONS BASEBALL LEGEND PETE ROSE, POSTHUMOUSLY',
];
const BRIEF_RIGHT = [
  'TAIWAN FLAGS 2,700 CHINA-LINKED ACCOUNTS TO META',
  'INDONESIA ASKS GOOGLE ABOUT 19,000+ CHANNELS REMOVED',
  'COP31: FOSSIL FUELS CUT FROM DRAFT DEAL AMID PROTESTS',
];
function drawBrief(items: string[], x: number, y0: number): void {
  let y = y0;
  for (const item of items) {
    rect(x, y + 3, 8, 8, RED);
    y = drawPara(item, x + 16, y, 440, 2, INK, 16) + 6;
  }
}
drawBrief(BRIEF_LEFT, M, 852);
drawBrief(BRIEF_RIGHT, 540, 852);

// Footer
hline(966, M, R, INK, 1);
drawTextCentered('THE WORLD TODAY - FRIDAY 20 NOVEMBER 2026', W / 2, 978, 2, INK);

// ---------------------------------------------------------------- write
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), encodePNG());
