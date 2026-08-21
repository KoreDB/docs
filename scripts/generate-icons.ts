/**
 * Generates the complete KoreDB icon set from a single geometric source of truth.
 *
 * Run with: yarn generate-icons  (requires Node >= 22.18 for native TS type stripping)
 *
 * Outputs to public/icons/ (favicons, app icons, raster sizes) and
 * src/assets/logo/ (the horizontal lockup consumed by Starlight).
 *
 * The wordmark below is Archivo SemiBold (SIL Open Font License 1.1) converted
 * to outlines, so no font file is needed at build or render time.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ICONS_DIR = join(ROOT, "public", "icons");
const LOGO_DIR = join(ROOT, "src", "assets", "logo");

// ---------------------------------------------------------------------------
// Palette — mirrors the site accent defined in src/styles/custom.css
// ---------------------------------------------------------------------------

const INK = "#17181c";
const CHALK = "#edeef3";
const EMBER = "#dc6428";
const EMBER_LIT = "#e0743e";

// ---------------------------------------------------------------------------
// Mark geometry: a "K" whose strokes are graph edges, with a core at the joint
// ---------------------------------------------------------------------------

interface MarkOptions {
  /** Edge stroke width. */
  stroke?: number;
  /** Radius of the four terminal nodes. */
  node?: number;
  /** Radius of the core ring (centreline). */
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
  const spineGap = round(CORE_Y - coreEdge);

  const body = (structure: string, core: string): string =>
    [
      `<g fill="none" stroke="${structure}" stroke-width="${stroke}" stroke-linecap="round">`,
      `<path d="M${SPINE_X} ${TOP_Y}V${spineGap}"/>`,
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

function svgDocument(viewBox: string, width: number, height: number, inner: string, title: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}" ` +
    `role="img" aria-label="${title}">${inner}</svg>\n`
  );
}

// ---------------------------------------------------------------------------
// Wordmark: "KoreDB" in Archivo SemiBold, converted to outlines.
// Ink box x 2.105..97.631, cap height 19, baseline at y=0.
// ---------------------------------------------------------------------------

const WORDMARK_PATH =
  "M5.706 0L2.105 0L2.105-19L5.706-19L5.706-10.192L14.125-19L18.529-19L11.162-11.300L18.668 0L14.402 0L8.724-8.780L5.706-6.121 M26.257 0.332Q23.875 0.332 22.268-0.485Q20.662-1.302 19.859-2.991Q19.055-4.681 19.055-7.284Q19.055-9.915 19.859-11.591Q20.662-13.267 22.268-14.084Q23.875-14.901 26.257-14.901Q28.666-14.901 30.259-14.084Q31.851-13.267 32.655-11.591Q33.458-9.915 33.458-7.284Q33.458-4.681 32.655-2.991Q31.851-1.302 30.259-0.485Q28.666 0.332 26.257 0.332M26.257-2.437Q27.586-2.437 28.403-2.950Q29.220-3.462 29.594-4.501Q29.968-5.539 29.968-7.090L29.968-7.478Q29.968-9.029 29.594-10.068Q29.220-11.106 28.403-11.619Q27.586-12.131 26.257-12.131Q24.927-12.131 24.110-11.619Q23.293-11.106 22.919-10.068Q22.545-9.029 22.545-7.478L22.545-7.090Q22.545-5.539 22.919-4.501Q23.293-3.462 24.110-2.950Q24.927-2.437 26.257-2.437 M39.551 0L36.172 0L36.172-14.569L38.997-14.569L39.274-12.270L39.468-12.270Q39.745-12.962 40.147-13.558Q40.548-14.153 41.185-14.527Q41.822-14.901 42.736-14.901Q43.179-14.901 43.553-14.818Q43.927-14.735 44.121-14.652L44.121-11.466L43.096-11.466Q42.238-11.466 41.573-11.231Q40.908-10.996 40.451-10.497Q39.994-9.999 39.773-9.251Q39.551-8.503 39.551-7.506 M52.015 0.332Q49.688 0.332 48.137-0.485Q46.586-1.302 45.810-2.991Q45.035-4.681 45.035-7.284Q45.035-9.915 45.810-11.591Q46.586-13.267 48.137-14.084Q49.688-14.901 52.015-14.901Q54.120-14.901 55.546-14.112Q56.972-13.322 57.692-11.688Q58.413-10.054 58.413-7.450L58.413-6.453L48.497-6.453Q48.552-5.096 48.913-4.168Q49.273-3.241 50.034-2.784Q50.796-2.327 52.042-2.327Q52.679-2.327 53.233-2.493Q53.787-2.659 54.203-3.005Q54.618-3.351 54.853-3.878Q55.089-4.404 55.089-5.096L58.413-5.096Q58.413-3.711 57.928-2.687Q57.443-1.662 56.571-0.997Q55.698-0.332 54.535 0Q53.372 0.332 52.015 0.332M48.552-8.835L54.895-8.835Q54.895-9.749 54.687-10.386Q54.480-11.023 54.106-11.439Q53.732-11.854 53.206-12.034Q52.679-12.214 52.015-12.214Q50.934-12.214 50.200-11.854Q49.466-11.494 49.079-10.746Q48.691-9.999 48.552-8.835 M69.048 0L61.431 0L61.431-19L69.048-19Q71.929-19 73.978-17.975Q76.028-16.950 77.136-14.859Q78.243-12.768 78.243-9.500Q78.243-6.259 77.136-4.155Q76.028-2.050 73.978-1.025Q71.929 0 69.048 0M65.032-15.926L65.032-3.074L69.048-3.074Q70.378-3.074 71.402-3.462Q72.427-3.850 73.120-4.612Q73.812-5.373 74.172-6.523Q74.532-7.672 74.532-9.195L74.532-9.777Q74.532-11.328 74.172-12.477Q73.812-13.627 73.120-14.388Q72.427-15.150 71.402-15.538Q70.378-15.926 69.048-15.926 M91.787 0L81.429 0L81.429-19L91.787-19Q93.310-19 94.515-18.418Q95.720-17.837 96.413-16.784Q97.105-15.732 97.105-14.319Q97.105-13.239 96.690-12.353Q96.274-11.466 95.568-10.871Q94.862-10.276 93.975-9.971L93.975-9.860Q95.028-9.638 95.859-9.015Q96.690-8.392 97.160-7.437Q97.631-6.481 97.631-5.235Q97.631-3.462 96.842-2.299Q96.052-1.136 94.737-0.568Q93.421 0 91.787 0M85.029-8.226L85.029-3.074L91.316-3.074Q92.452-3.074 93.186-3.698Q93.920-4.321 93.920-5.650Q93.920-6.426 93.615-7.007Q93.310-7.589 92.687-7.907Q92.064-8.226 91.095-8.226L85.029-8.226M85.029-15.926L85.029-11.245L90.845-11.245Q91.676-11.245 92.244-11.550Q92.812-11.854 93.103-12.380Q93.394-12.907 93.394-13.544Q93.394-14.762 92.743-15.344Q92.092-15.926 91.039-15.926";

const WORD_INK_X1 = 2.105;
const WORD_INK_X2 = 97.631;
const WORD_CAP = 19;

// ---------------------------------------------------------------------------
// Lockup: mark + wordmark on one baseline
// ---------------------------------------------------------------------------

const LOCKUP_GAP = 7.6;

function lockup(structure: string, core: string): { svg: (w: number, h: number) => string; ratio: number } {
  const markW = round(MARK.box.x2 - MARK.box.x1);
  const markH = round(MARK.box.y2 - MARK.box.y1);
  const wordX = round(markW + LOCKUP_GAP - WORD_INK_X1);
  const baseline = round(markH / 2 + WORD_CAP / 2);
  const width = round(markW + LOCKUP_GAP + (WORD_INK_X2 - WORD_INK_X1));

  const inner =
    `<g transform="translate(${round(-MARK.box.x1)} ${round(-MARK.box.y1)})">${MARK.body(structure, core)}</g>` +
    `<g transform="translate(${wordX} ${baseline})" fill="${structure}">` +
    `<path d="${WORDMARK_PATH}"/></g>`;

  return {
    ratio: width / markH,
    svg: (w: number, h: number) => svgDocument(`0 0 ${width} ${markH}`, w, h, inner, "KoreDB"),
  };
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
  const light = lockup(INK, EMBER);
  const dark = lockup(CHALK, EMBER_LIT);
  const lockupH = 32;
  const lockupW = Math.round(lockupH * light.ratio);

  write(ICONS_DIR, "koredb-logo.svg", light.svg(lockupW, lockupH));
  write(ICONS_DIR, "koredb-logo-inverse.svg", dark.svg(lockupW, lockupH));
  write(LOGO_DIR, "koredb-logo.svg", light.svg(lockupW, lockupH));
  write(LOGO_DIR, "koredb-logo-inverse.svg", dark.svg(lockupW, lockupH));

  const lockupPngH = 256;
  const lockupPngW = Math.round(lockupPngH * light.ratio);
  write(ICONS_DIR, "koredb-logo.png", await raster(light.svg(lockupPngW, lockupPngH)));
  write(ICONS_DIR, "koredb-logo-inverse.png", await raster(dark.svg(lockupPngW, lockupPngH)));

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
