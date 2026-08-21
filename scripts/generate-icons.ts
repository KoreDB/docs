/**
 * Generates the KoreDB brand assets from a single geometric source of truth.
 *
 * Run with: yarn generate-icons  (needs Node >= 22.18 for native TS type stripping)
 *
 * Outputs:
 *   public/icons/       favicons, app icons, vector marks, lockups
 *   src/assets/logo/    the lockup Starlight renders in the site header
 *   public/img/og.png   social preview card
 *
 * Type is drawn from scripts/outlines.json — Archivo glyphs already converted to
 * outlines, so nothing here depends on a font being installed.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ICONS_DIR = join(ROOT, "public", "icons");
const LOGO_DIR = join(ROOT, "src", "assets", "logo");
const IMG_DIR = join(ROOT, "public", "img");

// ---------------------------------------------------------------------------
// Palette — mirrors the site accent defined in src/styles/custom.css
// ---------------------------------------------------------------------------

const INK = "#17181c";
const CHALK = "#edeef3";
const EMBER = "#dc6428";
const EMBER_LIT = "#e0743e";
const MIST = "#8d919b";

// ---------------------------------------------------------------------------
// Type: pre-converted glyph outlines, baseline at y=0
// ---------------------------------------------------------------------------

interface Outline {
  text: string;
  /** Cap height the outline was generated at. */
  cap: number;
  /** Ink bounds. y is negative above the baseline. */
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  d: string;
}

interface Outlines {
  wordmark: Outline;
  tagline: Outline;
}

const OUTLINES = JSON.parse(
  readFileSync(join(ROOT, "scripts", "outlines.json"), "utf8"),
) as Outlines;

const WORDMARK = OUTLINES.wordmark;
const TAGLINE = OUTLINES.tagline;

// ---------------------------------------------------------------------------
// Mark geometry: a "K" whose strokes are graph edges, with a core at the joint
// ---------------------------------------------------------------------------

interface MarkOptions {
  /** Edge stroke width. */
  stroke?: number;
  /** Radius of the four terminal nodes. */
  node?: number;
  /** Radius of the core ring (centreline), or of the disc when solidCore is set. */
  coreRing?: number;
  /** Stroke width of the core ring. */
  coreStroke?: number;
  /** Radius of the solid nucleus inside the core. */
  coreDot?: number;
  /**
   * Draw the core as a solid disc rather than ring + nucleus. Below ~24px the
   * ring stroke lands on barely one pixel and the core turns to mush, so the
   * smallest rasters use this simplified cut.
   */
  solidCore?: boolean;
}

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Mark {
  /** SVG fragment, drawn on a nominal 32x32 grid. */
  body: (structure: string, core: string) => string;
  /** Tight ink bounding box of the fragment. */
  box: Box;
}

/** Axis of the K, on the 32x32 grid. */
const SPINE_X = 9.5;
const CORE_Y = 16;
const TOP_Y = 5.6;
const BOTTOM_Y = 26.4;
const ARM_X = 22.5;
const ARM_TOP_Y = 6.4;
const ARM_BOTTOM_Y = 25.6;

const round = (n: number): number => Math.round(n * 1000) / 1000;

function buildMark(options: MarkOptions = {}): Mark {
  const stroke = options.stroke ?? 2.6;
  const node = options.node ?? 3.2;
  const coreRing = options.coreRing ?? 4.3;
  const coreStroke = options.coreStroke ?? 2.4;
  const coreDot = options.coreDot ?? 1.5;
  const solidCore = options.solidCore ?? false;

  // Edges start at the outer edge of the core so the ring reads as a solid object.
  const coreEdge = solidCore ? coreRing : coreRing + coreStroke / 2;
  const dx = ARM_X - SPINE_X;
  const dy = ARM_TOP_Y - CORE_Y;
  const len = Math.hypot(dx, dy);
  const ax = round(SPINE_X + (coreEdge * dx) / len);
  const ay = round(CORE_Y + (coreEdge * dy) / len);

  const body = (structure: string, core: string): string =>
    [
      `<g fill="none" stroke="${structure}" stroke-width="${stroke}" stroke-linecap="round">`,
      `<path d="M${SPINE_X} ${TOP_Y}V${round(CORE_Y - coreEdge)}"/>`,
      `<path d="M${SPINE_X} ${round(CORE_Y + coreEdge)}V${BOTTOM_Y}"/>`,
      `<path d="M${ax} ${ay}L${ARM_X} ${ARM_TOP_Y}"/>`,
      `<path d="M${ax} ${round(2 * CORE_Y - ay)}L${ARM_X} ${ARM_BOTTOM_Y}"/>`,
      `</g>`,
      `<g fill="${structure}">`,
      `<circle cx="${SPINE_X}" cy="${TOP_Y}" r="${node}"/>`,
      `<circle cx="${SPINE_X}" cy="${BOTTOM_Y}" r="${node}"/>`,
      `<circle cx="${ARM_X}" cy="${ARM_TOP_Y}" r="${node}"/>`,
      `<circle cx="${ARM_X}" cy="${ARM_BOTTOM_Y}" r="${node}"/>`,
      `</g>`,
      solidCore
        ? `<circle cx="${SPINE_X}" cy="${CORE_Y}" r="${coreRing}" fill="${core}"/>`
        : `<circle cx="${SPINE_X}" cy="${CORE_Y}" r="${coreRing}" fill="none" stroke="${core}" stroke-width="${coreStroke}"/>` +
          `<circle cx="${SPINE_X}" cy="${CORE_Y}" r="${coreDot}" fill="${core}"/>`,
    ].join("");

  const box: Box = {
    x1: round(Math.min(SPINE_X - coreEdge, SPINE_X - node)),
    y1: round(Math.min(TOP_Y - node, ARM_TOP_Y - node)),
    x2: round(ARM_X + node),
    y2: round(BOTTOM_Y + node),
  };

  return { body, box };
}

/** Three cuts of the same mark, one per size band. */
const MARK = buildMark();
/** 32px: heavier strokes, core detail retained. */
const MARK_SMALL = buildMark({
  stroke: 3,
  node: 3.4,
  coreRing: 4.2,
  coreStroke: 2.8,
  coreDot: 1.7,
});
/** 16px: solid core, and the longer spine that frees up makes the K read better. */
const MARK_TINY = buildMark({
  stroke: 3.2,
  node: 3.5,
  coreRing: 4.2,
  solidCore: true,
});

/**
 * Wraps a mark in a square viewBox, optically centred (the raw geometry sits
 * slightly left of centre because the core hangs off the spine).
 */
function squareMark(mark: Mark, structure: string, core: string, pad = 0): string {
  const shiftX = round(16 - (mark.box.x1 + mark.box.x2) / 2);
  const shiftY = round(16 - (mark.box.y1 + mark.box.y2) / 2);
  const inner = `<g transform="translate(${shiftX} ${shiftY})">${mark.body(structure, core)}</g>`;
  if (pad === 0) return inner;
  const scale = round((32 - pad * 2) / 32);
  const offset = round((32 - 32 * scale) / 2);
  return `<g transform="translate(${offset} ${offset}) scale(${scale})">${inner}</g>`;
}

function svgDocument(
  viewBox: string,
  width: number,
  height: number,
  inner: string,
  title: string,
): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}" ` +
    `role="img" aria-label="${title}">${inner}</svg>\n`
  );
}

// ---------------------------------------------------------------------------
// Lockup: mark + wordmark sharing one optical centre line
// ---------------------------------------------------------------------------

/** Space between the mark's ink edge and the wordmark's, on the 32-unit grid. */
const LOCKUP_GAP = 7.6;

const MARK_W = round(MARK.box.x2 - MARK.box.x1);
const MARK_H = round(MARK.box.y2 - MARK.box.y1);
const LOCKUP_W = round(MARK_W + LOCKUP_GAP + (WORDMARK.x2 - WORDMARK.x1));

/** Lockup contents, top-left aligned to (0,0), sized LOCKUP_W x MARK_H. */
function lockupInner(structure: string, core: string): string {
  const wordX = round(MARK_W + LOCKUP_GAP - WORDMARK.x1);
  const baseline = round(MARK_H / 2 + WORDMARK.cap / 2);
  return (
    `<g transform="translate(${round(-MARK.box.x1)} ${round(-MARK.box.y1)})">` +
    `${MARK.body(structure, core)}</g>` +
    `<g transform="translate(${wordX} ${baseline})" fill="${structure}">` +
    `<path d="${WORDMARK.d}"/></g>`
  );
}

function lockupSvg(structure: string, core: string, height: number): string {
  const width = Math.round(height * (LOCKUP_W / MARK_H));
  return svgDocument(`0 0 ${LOCKUP_W} ${MARK_H}`, width, height, lockupInner(structure, core), "KoreDB");
}

// ---------------------------------------------------------------------------
// Social card
// ---------------------------------------------------------------------------

const OG_W = 1200;
const OG_H = 630;

function ogCard(): string {
  const margin = 96;
  const lockupH = 96;
  const lockupScale = round(lockupH / MARK_H);
  const tagScale = round(24 / TAGLINE.cap);
  const gap = 34;

  const tagInkTop = round(-TAGLINE.y1 * tagScale);
  const tagInkBottom = round(TAGLINE.y2 * tagScale);
  const blockH = round(lockupH + gap + tagInkTop + tagInkBottom);
  const blockTop = round((OG_H - blockH) / 2);
  const tagBaseline = round(blockTop + lockupH + gap + tagInkTop);

  // Outsized mark holding the right half, barely there, just kissing the edge.
  const wmScale = 19;
  const wmX = round(1010 - ((MARK.box.x1 + MARK.box.x2) / 2) * wmScale);
  const wmY = round(OG_H / 2 - CORE_Y * wmScale);

  const inner =
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#1c1f26"/><stop offset="1" stop-color="${INK}"/>` +
    `</linearGradient></defs>` +
    `<rect width="${OG_W}" height="${OG_H}" fill="url(#g)"/>` +
    `<g opacity="0.06" transform="translate(${wmX} ${wmY}) scale(${wmScale})">` +
    `${MARK.body(CHALK, CHALK)}</g>` +
    `<g transform="translate(${margin} ${blockTop}) scale(${lockupScale})">` +
    `${lockupInner(CHALK, EMBER_LIT)}</g>` +
    `<g transform="translate(${round(margin - TAGLINE.x1 * tagScale)} ${tagBaseline}) scale(${tagScale})" ` +
    `fill="${MIST}"><path d="${TAGLINE.d}"/></g>`;

  return svgDocument(`0 0 ${OG_W} ${OG_H}`, OG_W, OG_H, inner, "KoreDB — embedded graph database");
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

interface Written {
  file: string;
  bytes: number;
}

const written: Written[] = [];

function write(dir: string, name: string, data: string | Buffer): void {
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  writeFileSync(join(dir, name), buf);
  written.push({ file: name, bytes: buf.length });
}

/** Rasterises an SVG string at its declared pixel size. */
async function raster(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg, "utf8")).png({ compressionLevel: 9 }).toBuffer();
}

/** Packs PNG payloads into a multi-resolution .ico container. */
function buildIco(images: { size: number; buf: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = Buffer.alloc(16 * images.length);
  let offset = 6 + 16 * images.length;

  images.forEach((image, index) => {
    const at = index * 16;
    const dim = image.size >= 256 ? 0 : image.size;
    entries.writeUInt8(dim, at);
    entries.writeUInt8(dim, at + 1);
    entries.writeUInt8(0, at + 2);
    entries.writeUInt8(0, at + 3);
    entries.writeUInt16LE(1, at + 4);
    entries.writeUInt16LE(32, at + 6);
    entries.writeUInt32LE(image.buf.length, at + 8);
    entries.writeUInt32LE(offset, at + 12);
    offset += image.buf.length;
  });

  return Buffer.concat([header, entries, ...images.map((image) => image.buf)]);
}

async function main(): Promise<void> {
  mkdirSync(ICONS_DIR, { recursive: true });
  mkdirSync(LOGO_DIR, { recursive: true });
  mkdirSync(IMG_DIR, { recursive: true });

  const square = (structure: string, core: string, size = 32, mark: Mark = MARK): string =>
    svgDocument("0 0 32 32", size, size, squareMark(mark, structure, core), "KoreDB");

  // --- vector masters -------------------------------------------------------
  write(ICONS_DIR, "koredb-mark.svg", square(INK, EMBER));
  write(ICONS_DIR, "koredb-mark-inverse.svg", square(CHALK, EMBER_LIT));
  write(ICONS_DIR, "koredb-mark-mono.svg", square("currentColor", "currentColor"));

  // Theme-aware favicon: CSS custom properties let one file follow the OS scheme.
  const themed =
    `<style>svg{--k:${INK};--c:${EMBER}}` +
    `@media(prefers-color-scheme:dark){svg{--k:${CHALK};--c:${EMBER_LIT}}}</style>` +
    squareMark(MARK, "var(--k)", "var(--c)");
  write(ICONS_DIR, "favicon.svg", svgDocument("0 0 32 32", 32, 32, themed, "KoreDB"));

  // --- lockups --------------------------------------------------------------
  for (const dir of [ICONS_DIR, LOGO_DIR]) {
    write(dir, "koredb-logo.svg", lockupSvg(INK, EMBER, 32));
    write(dir, "koredb-logo-inverse.svg", lockupSvg(CHALK, EMBER_LIT, 32));
  }
  write(ICONS_DIR, "koredb-logo.png", await raster(lockupSvg(INK, EMBER, 256)));
  write(ICONS_DIR, "koredb-logo-inverse.png", await raster(lockupSvg(CHALK, EMBER_LIT, 256)));

  // --- favicon rasters ------------------------------------------------------
  // Each size band gets the cut that survives its pixel budget.
  const ico: { size: number; buf: Buffer }[] = [];
  for (const size of [16, 32, 48]) {
    const mark = size === 16 ? MARK_TINY : size === 32 ? MARK_SMALL : MARK;
    const buf = await raster(square(INK, EMBER, size, mark));
    write(ICONS_DIR, `favicon-${size}x${size}.png`, buf);
    ico.push({ size, buf });
  }
  write(ICONS_DIR, "favicon.ico", buildIco(ico));

  // --- app icons ------------------------------------------------------------
  for (const size of [64, 128, 192, 256, 512]) {
    write(ICONS_DIR, `icon-${size}.png`, await raster(square(INK, EMBER, size)));
  }
  for (const size of [192, 512]) {
    write(ICONS_DIR, `icon-${size}-inverse.png`, await raster(square(CHALK, EMBER_LIT, size)));
  }

  // iOS masks the corners and composites on black if the icon is transparent,
  // so this one ships opaque with generous padding.
  const appleInner =
    `<rect width="32" height="32" fill="${INK}"/>` + squareMark(MARK, CHALK, EMBER_LIT, 4.5);
  write(
    ICONS_DIR,
    "apple-touch-icon.png",
    await raster(svgDocument("0 0 32 32", 180, 180, appleInner, "KoreDB")),
  );

  // Android maskable: everything outside the centre 80% circle may be cropped.
  const maskableInner =
    `<rect width="32" height="32" fill="${INK}"/>` + squareMark(MARK, CHALK, EMBER_LIT, 5.5);
  write(
    ICONS_DIR,
    "icon-maskable-512.png",
    await raster(svgDocument("0 0 32 32", 512, 512, maskableInner, "KoreDB")),
  );

  // --- social card ----------------------------------------------------------
  write(IMG_DIR, "og.png", await raster(ogCard()));

  const total = written.reduce((sum, entry) => sum + entry.bytes, 0);
  for (const entry of written) {
    console.log(`  ${entry.file.padEnd(28)} ${(entry.bytes / 1024).toFixed(1)} KB`);
  }
  console.log(`\n${written.length} files, ${(total / 1024).toFixed(1)} KB total`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
