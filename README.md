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
optional licence file). The notebook is shown as saved, outputs included, so run
it, then commit and push it in the notebooks repo. Then, from here:

```sh
npm run notebook -- ../notebooks/arena-preparation/einops-basics                 # slug einops-basics
npm run notebook -- ../notebooks/nes-and-interpretability/nes/00-meet-mario.ipynb  # slug nes-00-meet-mario
```

That copies the notebook in, builds, and opens (or updates) a PR on
`notebook/<slug>` with fresh visual baselines. The first time, it scaffolds
`notebook.yaml` and stops so you can replace the `[[WRITE: …]]` description;
run it again afterwards. The notebook's top-level folder in the notebooks repo
is its section on the Notebooks index; section titles are in
`src/content/notebook-groups.yaml`, and a new folder gets a `[[WRITE: …]]` title
there. Browser tests and Lighthouse pick up new notebook
pages on their own.

`npm run baselines` re-renders the visual baselines for the current (pushed) PR
branch in CI's Playwright container and commits them.
