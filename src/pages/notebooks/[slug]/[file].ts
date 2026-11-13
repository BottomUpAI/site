// Serves each notebook's images (its outputs and those its Markdown cells
// show) as files next to its page (/notebooks/<slug>/<hash>.<ext>), so the
// page HTML stays small.
import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";

export const getStaticPaths = (async () => {
  const notebooks = await getCollection("notebooks");
  return notebooks.flatMap((notebook) =>
    notebook.data.images.map((image) => ({
      params: { slug: notebook.id, file: image.file },
      props: { base64: image.base64 },
    })),
  );
}) satisfies GetStaticPaths;

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export const GET: APIRoute<{ base64: string }> = ({ params, props }) => {
  const type = TYPES[String(params.file).split(".").pop()!];
  if (type === undefined) throw new Error(`no content type for ${params.file}`);
  return new Response(Buffer.from(props.base64, "base64"), { headers: { "content-type": type } });
};
