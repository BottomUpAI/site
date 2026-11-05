# site

Source for [bottomuplabs.ai](https://bottomuplabs.ai): an [Astro](https://astro.build) static site.

```sh
npm ci
npm run dev        # local server
npm run check      # astro check + tsc
npm run test:unit  # vitest
npm run build      # static build into dist/
npm run verify     # post-build checks on dist/
```

## Notebooks

`/notebooks/<slug>/` pages are built from Jupyter notebooks copied in from
[BottomUpAI/notebooks](https://github.com/BottomUpAI/notebooks). Each lives in
`src/content/notebooks/<slug>/` with a `notebook.yaml` (description, source URL,
optional licence file). To update one after changing it in the notebooks repo:

```sh
scripts/sync-notebook.sh ../notebooks/einops-basics
```

The notebook is shown as saved, outputs included, so run it before syncing.
