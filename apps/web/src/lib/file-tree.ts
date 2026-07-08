import type { FileNode } from "@/types/project";

export function flattenFiles(node?: FileNode): FileNode[] {
  if (!node) return [];

  if (node.type === "file") {
    return [node];
  }

  return (node.children ?? []).flatMap(flattenFiles);
}

export function findFirstTypFile(node?: FileNode): FileNode | undefined {
  return flattenFiles(node).find((file) => file.path.endsWith(".typ"));
}