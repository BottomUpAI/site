import { parse } from "yaml";
import groupsYaml from "../content/notebook-groups.yaml?raw";
import { type NotebookGroup, notebookGroupsSchema } from "./schemas";

export const GROUPS: NotebookGroup[] = notebookGroupsSchema.parse(parse(groupsYaml));

/** The Notebooks index's sections, in order, each with its notebooks; a
 *  notebook whose group isn't listed is an error, and an empty group is left out. */
export function groupNotebooks<T extends { data: { group: string } }>(
  notebooks: T[],
  groups: NotebookGroup[] = GROUPS,
): { group: NotebookGroup; notebooks: T[] }[] {
  const ids = new Set(groups.map((g) => g.id));
  for (const notebook of notebooks) {
    if (!ids.has(notebook.data.group)) {
      throw new Error(`notebook group "${notebook.data.group}" isn't in src/content/notebook-groups.yaml`);
    }
  }
  return groups
    .map((group) => ({ group, notebooks: notebooks.filter((n) => n.data.group === group.id) }))
    .filter((section) => section.notebooks.length > 0);
}
