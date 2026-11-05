// Every page the browser tests visit. Stage 2 adds pages here.
export type PageCase = { name: string; path: string; status: number };

export const PAGES: PageCase[] = [
  { name: "home", path: "/", status: 200 },
  { name: "about", path: "/about/", status: 200 },
  { name: "notebooks", path: "/notebooks/", status: 200 },
  { name: "notebook-einops-basics", path: "/notebooks/einops-basics/", status: 200 },
  { name: "404", path: "/definitely-missing/", status: 404 },
];
