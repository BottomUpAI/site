// Serves each notebook's output images as files next to its page
// (/notebooks/<slug>/<hash>.png), so the page HTML stays small.
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

export const GET: APIRoute<{ base64: string }> = ({ props }) =>
  new Response(Buffer.from(props.base64, "base64"), { headers: { "content-type": "image/png" } });
