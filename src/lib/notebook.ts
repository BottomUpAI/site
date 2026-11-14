// Converts a Jupyter notebook (nbformat 4) into what a notebook page renders:
// the title, each cell's HTML, each output, and the image files those outputs
// and the Markdown cells reference. Anything this doesn't know how to show is an error, not a silent
// gap, so a notebook never ships with an output missing.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import type { Element, Root } from "hast";
import rehypeRaw from "rehype-raw";
import { z } from "astro/zod";
import { rehypeWriteMarkers } from "./rehype-write-markers";
import { SHIKI } from "./shiki";

// ---------- nbformat 4, the subset we read ----------

// nbformat stores multiline strings either whole or as a list of lines.
const multiline = z.union([z.string(), z.array(z.string())]).transform((v) => (Array.isArray(v) ? v.join("") : v));

const WIDGET = "application/vnd.jupyter.widget-view+json";
// Every MIME type holds text, except an ipywidgets view, which holds the
// widget's model reference.
const mimeBundle = z.object({ [WIDGET]: z.object({ model_id: z.string() }).optional() }).catchall(multiline);

const outputSchema = z.discriminatedUnion("output_type", [
  z.object({ output_type: z.literal("stream"), name: z.enum(["stdout", "stderr"]), text: multiline }),
  z.object({ output_type: z.literal("execute_result"), data: mimeBundle }),
  z.object({ output_type: z.literal("display_data"), data: mimeBundle }),
  z.object({
    output_type: z.literal("error"),
    ename: z.string(),
    evalue: z.string(),
    traceback: z.array(z.string()),
  }),
]);

const cellSchema = z.discriminatedUnion("cell_type", [
  z.object({ cell_type: z.literal("markdown"), source: multiline, attachments: z.unknown().optional() }),
  z.object({ cell_type: z.literal("code"), source: multiline, outputs: z.array(outputSchema) }),
  z.object({ cell_type: z.literal("raw"), source: multiline }),
]);

const notebookFileSchema = z.object({
  nbformat: z.literal(4),
  metadata: z.object({ language_info: z.object({ name: z.string() }).optional() }),
  cells: z.array(cellSchema),
});

// ---------- what a page renders ----------

export type Output =
  | { kind: "text"; text: string; stream: "stdout" | "stderr" | "result" | "error" }
  | { kind: "image"; file: string; width: number; height: number }
  | { kind: "widget" };

export type Cell =
  | { kind: "markdown"; html: string }
  | { kind: "code"; number: number; html: string; outputs: Output[] };

export type Image = { file: string; base64: string };

/** `title` is plain text (for <title> and sorting); `titleHtml` keeps the
 *  heading's inline Markdown (code, emphasis) for the page's <h1>. */
export type RenderedNotebook = { title: string; titleHtml: string; cells: Cell[]; images: Image[] };

// ---------- helpers ----------

// Terminal colour codes (uv, pip, tracebacks) and other CSI sequences.
const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]/g;

/** Plain text as a terminal would leave it: no escape codes, and a carriage
 *  return overwrites its line (progress bars keep only their last state). */
export function terminalText(text: string): string {
  return text
    .replace(ANSI, "")
    .split("\n")
    .map((line) => line.slice(line.lastIndexOf("\r") + 1))
    .join("\n")
    .trimEnd();
}

/** Width and height from a PNG's IHDR chunk. */
export function pngSize(png: Buffer): { width: number; height: number } {
  const signature = "89504e470d0a1a0a";
  if (png.length < 24 || png.subarray(0, 8).toString("hex") !== signature || png.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error("image/png output is not a PNG");
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

/** An image's file extension (by its bytes, not its name) and, where the
 *  format records it, its size. */
export function imageInfo(bytes: Buffer): { ext: string; width?: number | undefined; height?: number | undefined } | undefined {
  const ascii = (start: number, end: number) => bytes.toString("ascii", start, end);
  if (ascii(1, 4) === "PNG") return { ext: "png", ...pngSize(bytes) };
  if (ascii(0, 4) === "GIF8") return { ext: "gif", width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    const chunk = ascii(12, 16);
    if (chunk === "VP8X") return { ext: "webp", width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (chunk === "VP8L") {
      const bits = bytes.readUInt32LE(21);
      return { ext: "webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8 ") return { ext: "webp", width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    return { ext: "webp" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    // Walk the segments to the frame header (SOFn, but not DHT, JPG or DAC).
    for (let i = 2; i + 9 < bytes.length; ) {
      if (bytes[i] !== 0xff) break;
      const marker = bytes[i + 1]!;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { ext: "jpg", height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
      }
      i += 2 + bytes.readUInt16BE(i + 2);
    }
    return { ext: "jpg" };
  }
  const svg = /<svg\b[^>]*>/.exec(bytes.toString("utf8", 0, 4096))?.[0];
  if (svg !== undefined) {
    const px = (name: string) => {
      const value = new RegExp(`\\s${name}="(\\d+)(?:px)?"`).exec(svg)?.[1];
      return value === undefined ? undefined : Number(value);
    };
    return { ext: "svg", width: px("width"), height: px("height") };
  }
  return undefined;
}

export type RenderOptions = {
  /** The page's URL directory, which images are served from: "/notebooks/<slug>/". */
  base?: string;
  /** Reads a file by its path relative to the notebook's directory, or undefined if there isn't one. */
  readFile?: (path: string) => Buffer | undefined;
};

/** A `readFile` for RenderOptions: files under `dir`, the notebook's directory. */
export function readFrom(dir: string): (path: string) => Buffer | undefined {
  return (path) => {
    const file = join(dir, path);
    return existsSync(file) && statSync(file).isFile() ? readFileSync(file) : undefined;
  };
}

/** Rehype plugin: points each <img> in a Markdown cell at its file, which
 *  `image` reads from the notebook's directory and stores. The production CSP
 *  allows only same-origin images, so a remote one is an error, not a broken
 *  image on the page. */
function rehypeLocalImages(image: (src: string) => { src: string; width?: number | undefined; height?: number | undefined }) {
  const walk = (node: Root | Element) => {
    for (const child of node.children) {
      if (child.type !== "element") continue;
      if (child.tagName === "img") {
        const { src: found, width, height } = image(String(child.properties.src ?? ""));
        child.properties.src = found;
        if (width !== undefined && height !== undefined) {
          child.properties.width = width;
          child.properties.height = height;
        }
        child.properties.loading = "lazy";
        child.properties.decoding = "async";
      }
      walk(child);
    }
  };
  return () => (tree: Root) => walk(tree);
}

/** A fence longer than any backtick run in the code, so code can't close it. */
function fence(code: string, lang: string): string {
  const longest = Math.max(2, ...[...code.matchAll(/`+/g)].map((m) => m[0].length));
  const ticks = "`".repeat(longest + 1);
  return `${ticks}${lang}\n${code}\n${ticks}\n`;
}

/** The page's <h1> is the notebook title, so any other top-level heading in a
 *  cell becomes an <h2>. */
function rehypeDemoteH1() {
  const walk = (node: Root | Element) => {
    for (const child of node.children) {
      if (child.type !== "element") continue;
      if (child.tagName === "h1") child.tagName = "h2";
      walk(child);
    }
  };
  return (tree: Root) => walk(tree);
}

const TITLE = /^#[ \t]+(.+?)[ \t#]*$/m;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Text content of an HTML fragment: tags dropped, character references decoded. */
export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (ref, name: string) => {
      if (name[0] === "#") {
        const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return String.fromCodePoint(code);
      }
      return ENTITIES[name.toLowerCase()] ?? ref;
    });
}

// ---------- conversion ----------

/**
 * @param json the .ipynb file's text
 * @param where a name for error messages
 */
export async function renderNotebook(json: string, where: string, options: RenderOptions = {}): Promise<RenderedNotebook> {
  const fail = (message: string): never => {
    throw new Error(`${where}: ${message}`);
  };
  const parsed = notebookFileSchema.safeParse(JSON.parse(json));
  if (!parsed.success) fail(`not an nbformat 4 notebook: ${parsed.error.message}`);
  const notebook = parsed.data!;
  const language = notebook.metadata.language_info?.name ?? "python";

  // The title is the first cell's leading "# heading", which the page shows as its <h1>.
  const first = notebook.cells[0];
  const title = first?.cell_type === "markdown" ? TITLE.exec(first.source.trimStart()) : null;
  if (!first || !title?.[1] || first.source.trimStart().indexOf(title[0]) !== 0) {
    fail('the first cell must be Markdown that starts with a "# Title" heading');
  }

  const images = new Map<string, Image>();
  /** Stores an image's bytes under a content-hash name, and says where it's served. */
  const store = (bytes: Buffer, ext: string) => {
    const file = `${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.${ext}`;
    images.set(file, { file, base64: bytes.toString("base64") });
    return file;
  };

  let number = 0; // the cell being rendered, for error messages
  const markdownImage = (src: string) => {
    const path = posix.normalize(decodeURI(src));
    if (/^[a-z][a-z\d+.-]*:|^\/|^\.\.(\/|$)/i.test(path)) {
      fail(`cell ${number}: image ${src} isn't in the notebook's directory; copy it there (the site's CSP blocks other hosts)`);
    }
    const bytes = options.readFile?.(path);
    if (bytes === undefined) fail(`cell ${number}: no image ${path} in the notebook's directory`);
    const info = imageInfo(bytes!);
    if (info === undefined) fail(`cell ${number}: ${path} isn't a PNG, JPEG, GIF, WebP or SVG image`);
    return { src: `${options.base ?? ""}${store(bytes!, info!.ext)}`, width: info!.width, height: info!.height };
  };

  const markdown = await createMarkdownProcessor({
    shikiConfig: SHIKI,
    // rehype-raw first, so HTML written inline in a cell (an <img> tag, say) is
    // elements the plugins after it see, not an opaque string. Astro runs it
    // again last, when there's nothing left for it to do.
    rehypePlugins: [rehypeRaw, rehypeWriteMarkers, rehypeDemoteH1, rehypeLocalImages(markdownImage)],
  });
  const html = async (source: string) => (await markdown.render(source)).code;

  // Rendered as a paragraph (so it isn't demoted or given an id), then unwrapped.
  // A leading "00." or "- " would start a list, so it's escaped.
  const titleHtml = (await html(title![1]!.replace(/^(\d+)([.)])/, "$1\\$2").replace(/^([-+*])(\s)/, "\\$1$2")))
    .trim()
    .replace(/^<p>([\s\S]*)<\/p>$/, "$1");

  const cells: Cell[] = [];
  for (const [index, cell] of notebook.cells.entries()) {
    number = index + 1;
    if (cell.cell_type === "raw") continue;

    if (cell.cell_type === "markdown") {
      if (cell.attachments !== undefined) fail(`cell ${number}: Markdown attachments aren't supported`);
      const source = index === 0 ? cell.source.trimStart().slice(title![0].length) : cell.source;
      if (source.trim() !== "") cells.push({ kind: "markdown", html: await html(source) });
      continue;
    }

    if (cell.source.trim() === "" && cell.outputs.length === 0) continue;
    const outputs: Output[] = [];
    for (const output of cell.outputs) {
      if (output.output_type === "stream") {
        const text = terminalText(output.text);
        if (text !== "") outputs.push({ kind: "text", text, stream: output.name });
      } else if (output.output_type === "error") {
        outputs.push({ kind: "text", text: terminalText(output.traceback.join("\n")), stream: "error" });
      } else {
        const png = output.data["image/png"];
        const plain = output.data["text/plain"];
        if (output.data[WIDGET] !== undefined) {
          // A live widget needs a kernel and JavaScript; the static page notes
          // that it was there rather than showing its text/plain repr.
          outputs.push({ kind: "widget" });
        } else if (png !== undefined) {
          const bytes = Buffer.from(png.replace(/\s/g, ""), "base64");
          outputs.push({ kind: "image", file: store(bytes, "png"), ...pngSize(bytes) });
        } else if (plain !== undefined) {
          const text = terminalText(plain);
          if (text !== "") outputs.push({ kind: "text", text, stream: "result" });
        } else {
          fail(`cell ${number}: no renderer for output types ${Object.keys(output.data).join(", ")}`);
        }
      }
    }
    cells.push({ kind: "code", number, html: await html(fence(cell.source.trimEnd(), language)), outputs });
  }

  // Each cell is rendered on its own, so two headings with the same text would
  // get the same id; that's invalid HTML and an ambiguous link.
  const ids = cells.flatMap((c) => [...c.html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate !== undefined) fail(`two headings would share the id "${duplicate}"`);

  return { title: htmlToText(titleHtml), titleHtml, cells, images: [...images.values()] };
}
