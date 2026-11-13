// Content loader for notebooks. Each directory under `base` is one notebook:
//
//   <slug>/<anything>.ipynb   the notebook (exactly one)
//   <slug>/notebook.yaml      description, source URL, optional licence file
//   <slug>/<images>           any images its Markdown cells show, by relative path
//
// The entry id is the directory name, which is also the page's URL slug.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { Loader } from "astro/loaders";
import { parse } from "yaml";
import { readFrom, renderNotebook } from "./notebook";
import { notebookMetaSchema } from "./schemas";

export function notebookLoader({ base }: { base: string }): Loader {
  return {
    name: "notebook-loader",
    load: async ({ config, store, parseData, generateDigest, watcher, logger }) => {
      const root = fileURLToPath(new URL(base.replace(/\/?$/, "/"), config.root));

      async function loadAll() {
        store.clear();
        if (!existsSync(root)) return;
        for (const dir of readdirSync(root, { withFileTypes: true })) {
          if (!dir.isDirectory()) continue;
          const id = dir.name;
          const path = join(root, id);
          const where = relative(fileURLToPath(config.root), path);

          const ipynbs = readdirSync(path).filter((f) => f.endsWith(".ipynb"));
          if (ipynbs.length !== 1) throw new Error(`${where}: expected one .ipynb, found ${ipynbs.length}`);
          const ipynb = join(path, ipynbs[0]!);
          const metaPath = join(path, "notebook.yaml");
          if (!existsSync(metaPath)) throw new Error(`${where}: notebook.yaml is missing`);

          const meta = notebookMetaSchema.safeParse(parse(readFileSync(metaPath, "utf8")));
          if (!meta.success) throw new Error(`${where}/notebook.yaml: ${meta.error.message}`);
          const { licence, ...rest } = meta.data;
          const licenceText = licence === undefined ? undefined : readFileSync(join(path, licence), "utf8").trim();

          const json = readFileSync(ipynb, "utf8");
          const rendered = await renderNotebook(json, relative(fileURLToPath(config.root), ipynb), {
            base: `/notebooks/${id}/`,
            readFile: readFrom(path),
          });
          const data = await parseData({
            id,
            data: { ...rest, ...(licenceText === undefined ? {} : { licenceText }), ...rendered },
            filePath: relative(fileURLToPath(config.root), ipynb),
          });
          // Image file names are content hashes, so they stand in for the images' bytes.
          const imageFiles = rendered.images.map((image) => image.file).join();
          store.set({ id, data, digest: generateDigest(json + JSON.stringify(meta.data) + (licenceText ?? "") + imageFiles) });
        }
      }

      await loadAll();

      watcher?.add(root);
      const reload = (changed: string) => {
        if (!changed.startsWith(root)) return;
        loadAll().catch((error: unknown) => logger.error(String(error)));
      };
      watcher?.on("change", reload);
      watcher?.on("add", reload);
      watcher?.on("unlink", reload);
    },
  };
}
