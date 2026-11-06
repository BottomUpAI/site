import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import { pngSize, renderNotebook, terminalText } from "../../src/lib/notebook";
import { notebookMetaSchema } from "../../src/lib/schemas";

// A 1×1 PNG.
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==";

type CellJson = Record<string, unknown>;
const markdown = (source: string | string[]): CellJson => ({ cell_type: "markdown", metadata: {}, source });
const code = (source: string, outputs: unknown[] = []): CellJson => ({
  cell_type: "code",
  execution_count: 1,
  metadata: {},
  source,
  outputs,
});
const notebook = (...cells: CellJson[]) =>
  JSON.stringify({ nbformat: 4, nbformat_minor: 5, metadata: { language_info: { name: "python" } }, cells });

const render = (...cells: CellJson[]) => renderNotebook(notebook(...cells), "test.ipynb");

describe("terminalText", () => {
  test("strips ANSI colour codes", () => {
    expect(terminalText("\x1b[2mUsing\x1b[0m \x1b[1m3 packages\x1b[0m")).toBe("Using 3 packages");
  });

  test("keeps only what follows the last carriage return on a line", () => {
    expect(terminalText("10%\r50%\r100%\ndone\n")).toBe("100%\ndone");
  });
});

describe("pngSize", () => {
  test("reads width and height", () => {
    expect(pngSize(Buffer.from(PNG, "base64"))).toEqual({ width: 1, height: 1 });
  });

  test("rejects bytes that aren't a PNG", () => {
    expect(() => pngSize(Buffer.from("not a png at all, not at all"))).toThrow(/not a PNG/);
  });
});

describe("renderNotebook", () => {
  test("takes the title from the first cell and drops it from the body", async () => {
    const result = await render(markdown(["# My title\n", "\n", "Intro."]));
    expect(result.title).toBe("My title");
    expect(result.cells).toHaveLength(1);
    expect(result.cells[0]).toMatchObject({ kind: "markdown" });
    expect(JSON.stringify(result.cells)).not.toContain("My title");
  });

  test("a title keeps its inline Markdown in titleHtml and is plain text in title", async () => {
    const result = await render(markdown("# What is `torch.nn` *really*? A & B"));
    expect(result.titleHtml).toBe("What is <code>torch.nn</code> <em>really</em>? A &#x26; B");
    expect(result.title).toBe("What is torch.nn really? A & B");
  });

  test("a title-only first cell leaves no empty cell", async () => {
    const result = await render(markdown("# Title"), code("x = 1"));
    expect(result.cells.map((c) => c.kind)).toEqual(["code"]);
  });

  test("requires the first cell to start with a # heading", async () => {
    await expect(render(markdown("Intro.\n\n# Late title"))).rejects.toThrow(/test.ipynb: the first cell/);
    await expect(render(code("x = 1"))).rejects.toThrow(/the first cell/);
  });

  test("turns later top-level headings into h2, under the page's h1", async () => {
    const result = await render(markdown("# Title"), markdown("# Summary"));
    expect(result.cells[0]).toMatchObject({ html: expect.stringMatching(/^<h2 id="summary">Summary<\/h2>$/) });
  });

  test("highlights code cells, with colours only as custom properties", async () => {
    const result = await render(markdown("# T"), code("import numpy"));
    const cell = result.cells[0];
    expect(cell).toMatchObject({ kind: "code", number: 2 });
    const html = cell?.kind === "code" ? cell.html : "";
    expect(html).toContain('data-language="python"');
    // Every inline style is custom properties only (html-validate's no-inline-style).
    for (const [, style] of html.matchAll(/style="([^"]*)"/g)) {
      for (const declaration of style!.split(";").filter((d) => d.trim() !== "")) {
        expect(declaration.trim()).toMatch(/^--/);
      }
    }
  });

  test("a code cell holding ``` can't close its own fence", async () => {
    const result = await render(markdown("# T"), code('s = """\n```\n"""'));
    const html = result.cells[0]?.kind === "code" ? result.cells[0].html : "";
    expect(html.match(/<pre/g)).toHaveLength(1);
    expect(html).toContain("```");
  });

  test("converts stream, result, error and image outputs, in order", async () => {
    const result = await render(
      markdown("# T"),
      code("run()", [
        { output_type: "stream", name: "stdout", text: ["\x1b[1mhello\x1b[0m\n"] },
        { output_type: "stream", name: "stderr", text: "" },
        { output_type: "execute_result", execution_count: 1, metadata: {}, data: { "text/plain": "(6, 96, 96, 3)" } },
        { output_type: "display_data", metadata: {}, data: { "image/png": `${PNG}\n`, "text/plain": "<Figure>" } },
        { output_type: "error", ename: "ValueError", evalue: "bad", traceback: ["\x1b[31mValueError\x1b[0m: bad"] },
      ]),
    );
    const cell = result.cells[0];
    expect(cell?.kind === "code" && cell.outputs).toEqual([
      { kind: "text", text: "hello", stream: "stdout" },
      { kind: "text", text: "(6, 96, 96, 3)", stream: "result" },
      { kind: "image", file: expect.stringMatching(/^[0-9a-f]{16}\.png$/), width: 1, height: 1 },
      { kind: "text", text: "ValueError: bad", stream: "error" },
    ]);
    expect(result.images).toEqual([{ file: expect.stringMatching(/\.png$/), base64: PNG }]);
  });

  test("the same image twice is stored once", async () => {
    const image = { output_type: "display_data", metadata: {}, data: { "image/png": PNG } };
    const result = await render(markdown("# T"), code("a", [image]), code("b", [image]));
    expect(result.images).toHaveLength(1);
  });

  test("an ipywidgets output becomes a widget placeholder, not its text/plain repr", async () => {
    const widget = {
      output_type: "display_data",
      metadata: {},
      data: {
        "application/vnd.jupyter.widget-view+json": { model_id: "abc", version_major: 2, version_minor: 0 },
        "text/plain": "interactive(children=(IntSlider(value=0, description='f', max=179), Output()))",
      },
    };
    const result = await render(markdown("# T"), code("interact(look)", [widget]));
    const cell = result.cells[0];
    expect(cell?.kind === "code" && cell.outputs).toEqual([{ kind: "widget" }]);
  });

  test("an output with no renderer is an error, not a silent gap", async () => {
    const html = { output_type: "display_data", metadata: {}, data: { "text/html": "<b>x</b>" } };
    await expect(render(markdown("# T"), code("x", [html]))).rejects.toThrow(/cell 2: no renderer for output types text\/html/);
  });

  test("two headings with the same id are an error", async () => {
    await expect(render(markdown("# T"), markdown("## Setup"), markdown("## Setup"))).rejects.toThrow(/"setup"/);
  });

  test("WRITE markers in Markdown cells render as markers", async () => {
    const result = await render(markdown("# T"), markdown("[[WRITE: intro]]"));
    expect(result.cells[0]).toMatchObject({ html: expect.stringContaining('class="write-marker"') });
  });
});

describe("vendored notebooks", () => {
  const dir = new URL("../../src/content/notebooks/einops-basics/", import.meta.url);

  test("einops-basics renders, with every output accounted for", async () => {
    const json = readFileSync(new URL("einops-basics.ipynb", dir), "utf8");
    const result = await renderNotebook(json, "einops-basics.ipynb");
    expect(result.title).toBe("Einops tutorial, part 1: basics");
    expect(result.titleHtml).toBe("Einops tutorial, part 1: basics");
    const images = result.cells.flatMap((c) => (c.kind === "code" ? c.outputs : [])).filter((o) => o.kind === "image");
    expect(images).toHaveLength(45);
    expect(result.images).toHaveLength(41);
  });

  test("einops-basics notebook.yaml parses", () => {
    const meta = notebookMetaSchema.safeParse(parse(readFileSync(new URL("notebook.yaml", dir), "utf8")));
    expect(meta.success).toBe(true);
  });
});
