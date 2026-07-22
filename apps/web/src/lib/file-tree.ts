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

export function joinProjectPath(
  parent: string,
  child: string
): string {
  const cleanParent =
    parent
      .replaceAll("\\", "/")
      .replace(/^\/+|\/+$/g, "");

  const cleanChild =
    child
      .replaceAll("\\", "/")
      .replace(/^\/+|\/+$/g, "");

  if (!cleanParent) {
    return cleanChild;
  }

  return `${cleanParent}/${cleanChild}`;
}

export function isSameOrChildPath(
  candidate: string | undefined,
  parent: string
): boolean {
  if (!candidate) {
    return false;
  }

  return (
    candidate === parent ||
    candidate.startsWith(
      `${parent}/`
    )
  );
}