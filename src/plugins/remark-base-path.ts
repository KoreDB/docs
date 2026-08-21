/**
 * Remark plugin that prefixes the site's `base` path onto root-absolute URLs
 * in Markdown and MDX content.
 *
 * Docs content links internal pages as `/get-started` and images as
 * `/img/foo.png`. Astro does not rewrite those when a `base` is configured, so
 * the built HTML would point outside the deployed subpath.
 *
 * This runs at the *remark* stage rather than rehype on purpose:
 * `starlight-links-validator` collects links from the mdast via its own remark
 * plugin, which Astro appends after the ones declared in `markdown.remarkPlugins`.
 * Rewriting here means the validator sees the same based URLs the browser will,
 * so the build output and the link check agree.
 *
 * Node kinds carrying URLs:
 *   - `link` / `image` / `definition` — Markdown syntax, `.url`
 *   - `html`                         — inline HTML in `.md`, an unparsed string
 *   - `mdxJsx(Flow|Text)Element`     — component props such as
 *                                      `<LinkCard href="/client-apis/python" />`
 *
 * The rewrite is idempotent: values already under `base` are left untouched, so
 * it composes safely with the runtime fallback in `public/fix-base.js`.
 */

type UrlAttribute = "href" | "src";

const URL_ATTRIBUTES: readonly UrlAttribute[] = ["href", "src"];

/** Protocol-absolute, scheme-qualified, or fragment-only URLs are external. */
const EXTERNAL_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/** Matches `href="/…"` / `src='/…'` inside an unparsed HTML string. */
const RAW_URL_ATTRIBUTE = /\b(href|src)=("|')(\/[^"']*)\2/gi;

export interface RemarkBasePathOptions {
  /** Astro's configured `base`, e.g. `/docs`. A bare `/` disables the plugin. */
  base: string;
}

interface Node {
  type: string;
  url?: unknown;
  value?: unknown;
  attributes?: MdxJsxAttribute[];
  children?: Node[];
}

interface MdxJsxAttribute {
  type: string;
  name?: string;
  value?: unknown;
}

/** Strip any trailing slash so `/docs/` and `/docs` behave identically. */
function normalizeBase(base: string): string {
  return base.replace(/\/+$/, "");
}

function prefix(value: string, base: string): string {
  if (!value.startsWith("/") || EXTERNAL_URL.test(value)) return value;
  if (value === base || value.startsWith(`${base}/`)) return value;
  return base + value;
}

function visitUrl(node: Node, base: string): void {
  if (typeof node.url === "string") {
    node.url = prefix(node.url, base);
  }
}

function visitHtml(node: Node, base: string): void {
  if (typeof node.value !== "string") return;

  node.value = node.value.replace(
    RAW_URL_ATTRIBUTE,
    (match, attribute: string, quote: string, url: string) => {
      const prefixed = prefix(url, base);
      return prefixed === url ? match : `${attribute}=${quote}${prefixed}${quote}`;
    }
  );
}

function visitMdxJsxElement(node: Node, base: string): void {
  if (!Array.isArray(node.attributes)) return;

  for (const attribute of node.attributes) {
    // Skip spread attributes and expression values — only plain string
    // literals can be rewritten statically.
    if (attribute.type !== "mdxJsxAttribute") continue;
    if (typeof attribute.value !== "string") continue;
    if (!URL_ATTRIBUTES.includes(attribute.name as UrlAttribute)) continue;

    attribute.value = prefix(attribute.value, base);
  }
}

function walk(node: Node, base: string): void {
  switch (node.type) {
    case "link":
    case "image":
    case "definition":
      visitUrl(node, base);
      break;
    case "html":
      visitHtml(node, base);
      break;
    case "mdxJsxFlowElement":
    case "mdxJsxTextElement":
      visitMdxJsxElement(node, base);
      break;
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      walk(child, base);
    }
  }
}

export default function remarkBasePath(options: RemarkBasePathOptions) {
  const base = normalizeBase(options.base);

  return (tree: Node): void => {
    if (!base) return;
    walk(tree, base);
  };
}
