// The World Today — Friday 20 November 2026.
// A newspaper front page drawn entirely in code: own PNG encoder (CRC32 +
// zlib), own 5x7 bitmap font, fixed-seed layout. Node 22, stdlib only,
// no network, no randomness, no clock: two runs write identical bytes.

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const W = 1024;
const H = 1024;

// ---- palette -------------------------------------------------------------
const PAPER = [245, 239, 224]; // warm newsprint
const INK = [20, 20, 20]; // near-black text
const RED = [176, 30, 30]; // kicker red
const BAND = [17, 17, 17]; // black date band

// ---- framebuffer ---------------------------------------------------------
const px = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = PAPER[0];
  px[i * 3 + 1] = PAPER[1];
  px[i * 3 + 2] = PAPER[2];
}

function setPixel(x, y, c) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  px[o] = c[0];
  px[o + 1] = c[1];
  px[o + 2] = c[2];
}

function fillRect(x, y, w, h, c) {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const o = (yy * W + xx) * 3;
      px[o] = c[0];
      px[o + 1] = c[1];
      px[o + 2] = c[2];
    }
  }
}

function fillCircle(cx, cy, r, c) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPixel(x, y, c);
    }
  }
}

// ---- CRC32 (PNG chunk checksums) ------------------------------------------
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePng() {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 5x7 bitmap font (uppercase, digits, punctuation) ----------------------
const FONT = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "*": ["00000", "00100", "10101", "01110", "10101", "00100", "00000"],
  "\u2022": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"],
};

function textWidth(text, scale) {
  if (!text.length) return 0;
  return text.length * 6 * scale - scale;
}

function drawText(text, x, y, scale, color) {
  let cx = x;
  for (const ch of text) {
    const g = FONT[ch] || FONT[" "];
    for (let r = 0; r < 7; r++) {
      const row = g[r];
      for (let c = 0; c < 5; c++) {
        if (row[c] === "1") {
          fillRect(cx + c * scale, y + r * scale, scale, scale, color);
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentered(text, y, scale, color) {
  drawText(text, Math.round((W - textWidth(text, scale)) / 2), y, scale, color);
}

// Greedy word wrap: returns lines that fit maxW pixels at the given scale.
function wrapText(text, maxW, scale) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, scale) <= maxW || !cur) {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawLines(lines, x, y, scale, color, lineH) {
  for (let i = 0; i < lines.length; i++) {
    drawText(lines[i], x, y + i * lineH, scale, color);
  }
  return y + lines.length * lineH;
}

// Fixed-seed LCG (deterministic; no Math.random, no clock).
let lcgState = 20261120;
function lcgNext() {
  lcgState = (1103515245 * lcgState + 12345) & 0x7fffffff;
  return lcgState / 0x7fffffff;
}

// ---- Vice City dusk skyline -------------------------------------------------
// Panel x=36..988, y=306..446. Layered sunset bands, a low sun, dark
// tower silhouettes with lit windows, and a strip of water at the bottom.
function drawSkyline() {
  const x0 = 36;
  const y0 = 306;
  const w = 952;
  const h = 140;
  const bands = [
    [36, 22, 64],
    [61, 31, 99],
    [138, 47, 110],
    [214, 84, 127],
    [242, 140, 60],
    [245, 196, 107],
  ];
  const bandH = Math.floor(h / bands.length);
  for (let i = 0; i < bands.length; i++) {
    const bh = i === bands.length - 1 ? h - bandH * i : bandH;
    fillRect(x0, y0 + bandH * i, w, bh, bands[i]);
  }
  // Sun, low over the bay.
  fillCircle(800, 368, 30, [251, 224, 138]);
  fillCircle(800, 368, 22, [253, 236, 176]);
  // "VICE CITY" in neon pink across the sky.
  drawText("VICE CITY", 66, 332, 4, [122, 30, 78]);
  drawText("VICE CITY", 64, 330, 4, [255, 179, 209]);
  // Towers: dark slabs with lit windows, standing in the water line.
  const ground = 418;
  const heights = [20, 42, 12, 35, 48, 8, 28, 40, 16, 32, 45, 10, 26, 38, 18, 30, 44, 14, 24, 36];
  const bw = 46;
  const gap = 2;
  for (let i = 0; i < heights.length; i++) {
    const bx = x0 + i * (bw + gap);
    const top = ground - 8 - heights[i];
    fillRect(bx, top, bw, ground - top, [23, 16, 46]);
    // Lit windows on a fixed 10x12 grid, LCG decides which are lit.
    for (let wy = top + 6; wy < ground - 6; wy += 12) {
      for (let wx = bx + 5; wx < bx + bw - 5; wx += 10) {
        if (lcgNext() < 0.28) fillRect(wx, wy, 4, 6, [255, 215, 106]);
      }
    }
  }
  // Water at the foot of the towers, with sunset streaks.
  fillRect(x0, ground, w, y0 + h - ground, [27, 42, 82]);
  fillRect(x0 + 60, ground + 6, 180, 2, [245, 196, 107]);
  fillRect(x0 + 420, ground + 12, 260, 2, [214, 84, 127]);
  fillRect(x0 + 700, ground + 18, 150, 2, [251, 224, 138]);
  fillRect(x0 + 120, ground + 20, 120, 2, [138, 47, 110]);
}

// ---- content: Friday 20 November 2026 ---------------------------------------
const LEAD_BODY =
  "SENSOR TOWER ESTIMATES THE GAME TOOK IN $2.36 BILLION IN UNDER 24 HOURS, " +
  "WITH ABOUT 24.6 MILLION COPIES SOLD, THREE QUARTERS ON PLAYSTATION. " +
  "VIEWERS WATCHED MORE THAN 132 MILLION HOURS ON TWITCH, YOUTUBE AND KICK.";
const COL1_BODY =
  "TAIWAN'S INDEX FELL MORE THAN 2,200 POINTS IN A DAY, DROPPING BELOW 37,000 " +
  "FOR THE FIRST TIME SINCE MID-APRIL. JAPAN'S NIKKEI AND KOREA'S KOSPI EACH " +
  "FELL 4.8 PERCENT, AND SOFTBANK LOST MORE THAN 16 PERCENT, AS INVESTORS " +
  "LOST FAITH IN AI STOCKS. THE S&P 500 FELL 2 PERCENT ON THURSDAY, ITS " +
  "FIFTH STRAIGHT DAILY DROP.";
const COL2_BODY =
  "PRESIDENT PRABOWO MET PRESIDENT XI IN SHENZHEN ON FRIDAY TO TALK TRADE, " +
  "INVESTMENT AND THE SOUTH CHINA SEA. REUTERS CALLED THE SUMMIT A FAILURE " +
  "OF PERSONAL DIPLOMACY: THE PEACE DECLARATION WAS SIGNED, BUT WITH NO " +
  "ARMS-CONTROL TALKS AND NO PROGRESS ON IRAN, UKRAINE, TAIWAN, TRADE OR AI. " +
  "TRUMP CALLED IT '12 OUT OF 10'.";
const BRIEF = [
  "KYIV HIT AGAIN FRIDAY - BALLISTIC MISSILES STRIKE BRIDGES",
  "UK PLEDGES 1,000+ DRONES FOR UKRAINE, 260M POUND PACKAGE",
  "TRUMP PARDONS BASEBALL LEGEND PETE ROSE, POSTHUMOUSLY",
  "TAIWAN FLAGS 2,700 CHINA-LINKED ACCOUNTS TO META",
  "INDONESIA ASKS GOOGLE ABOUT 19,000+ YOUTUBE CHANNELS REMOVED",
  "COP31: FOSSIL FUELS CUT FROM DRAFT DEAL AMID PROTESTS",
];

// ---- layout -----------------------------------------------------------------
function drawPage() {
  // Masthead.
  drawTextCentered("THE WORLD TODAY", 30, 8, INK);
  fillRect(36, 98, 952, 3, INK);
  fillRect(36, 104, 952, 1, INK);

  // Date band.
  fillRect(36, 114, 952, 40, BAND);
  drawTextCentered("FRIDAY 20 NOVEMBER 2026", 124, 3, [255, 255, 255]);

  // Lead story.
  drawText("VICE CITY - VIDEO GAMES", 36, 166, 2, RED);
  drawText("GTA VI: $2.36 BILLION", 36, 188, 5, INK);
  drawText("IN ONE DAY", 36, 228, 5, INK);
  drawText("24.6M COPIES, 132M HOURS WATCHED - VICE CITY TAKES OVER THE WORLD", 36, 272, 2, INK);
  fillRect(36, 296, 952, 1, INK);

  drawSkyline();

  drawLines(wrapText(LEAD_BODY, 952, 2), 36, 458, 2, INK, 18);
  fillRect(36, 524, 952, 1, INK);

  // Two columns: markets (left) and diplomacy (right).
  drawText("MARKETS - TECHNOLOGY", 36, 536, 2, RED);
  drawText("ASIAN MARKETS", 36, 558, 3, INK);
  drawText("TUMBLE ON FRIDAY", 36, 582, 3, INK);
  drawLines(wrapText(COL1_BODY, 456, 2), 36, 612, 2, INK, 18);

  drawText("SHENZHEN - DIPLOMACY", 532, 536, 2, RED);
  drawText("PRABOWO MEETS XI;", 532, 558, 3, INK);
  drawText("SUMMIT JUDGED", 532, 582, 3, INK);
  drawText("A FAILURE", 532, 606, 3, INK);
  drawLines(wrapText(COL2_BODY, 456, 2), 532, 636, 2, INK, 18);

  fillRect(36, 810, 952, 1, INK);

  // IN BRIEF strip: two columns x three rows.
  drawText("IN BRIEF", 36, 822, 3, INK);
  const rowY = [852, 888, 924];
  for (let i = 0; i < BRIEF.length; i++) {
    const col = i < 3 ? 0 : 1;
    const row = i % 3;
    const x = col === 0 ? 36 : 532;
    const y = rowY[row];
    drawText("\u2022", x, y, 2, RED);
    drawLines(wrapText(BRIEF[i], 456 - 24, 2), x + 24, y, 2, INK, 17);
  }

  // Footer.
  fillRect(36, 972, 952, 1, INK);
  drawTextCentered("THE WORLD TODAY - FRIDAY 20 NOVEMBER 2026", 982, 2, INK);
}

function main() {
  drawPage();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "entry.png");
  const png = encodePng();
  fs.writeFileSync(outPath, png);
  console.log("wrote " + outPath + " (" + png.length + " bytes)");
}

main();
