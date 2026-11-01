import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { splitMarkers } from "./markers";

/** The element a marker renders as, shared with <Text>. */
export function markerElement(label: string): Element {
  return {
    type: "element",
    tagName: "mark",
    properties: { className: ["write-marker"], dataLabel: label },
    children: [{ type: "text", value: `[[WRITE: ${label}]]` }],
  };
}

function expand(node: Text): ElementContent[] {
  return splitMarkers(node.value).map((segment) =>
    segment.kind === "text" ? { type: "text", value: segment.value } : markerElement(segment.label),
  );
}

function walk(parent: Root | Element): void {
  const children: (RootContent | ElementContent)[] = [];
  for (const child of parent.children) {
    if (child.type === "text") {
      children.push(...expand(child));
    } else {
      if (child.type === "element") {
        walk(child);
      }
      children.push(child);
    }
  }
  parent.children = children as typeof parent.children;
}

/** Rehype plugin: wraps every [[WRITE: …]] in Markdown bodies in <mark class="write-marker">. */
export function rehypeWriteMarkers() {
  return (tree: Root) => walk(tree);
}
