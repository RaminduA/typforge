"use client";

import type { FileNode } from "@/types/project";

interface FileTreeProps {
  node?: FileNode;
  activePath?: string;
  onOpenFile: (path: string) => void;
}

export function FileTree({ node, activePath, onOpenFile }: FileTreeProps) {
  if (!node) {
    return <div className="muted small">No files yet.</div>;
  }

  return (
    <div className="file-tree">
      {(node.children ?? []).map((child) => (
        <FileTreeNode
          key={child.path || child.name}
          node={child}
          activePath={activePath}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  );
}

function FileTreeNode({
  node,
  activePath,
  onOpenFile
}: {
  node: FileNode;
  activePath?: string;
  onOpenFile: (path: string) => void;
}) {
  if (node.type === "folder") {
    return (
      <div>
        <div className="file-row">
          <span>▾</span>
          <span>📁</span>
          <span>{node.name}</span>
        </div>
        <div className="file-children">
          {(node.children ?? []).map((child) => (
            <FileTreeNode
              key={child.path || child.name}
              node={child}
              activePath={activePath}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <button
      className={`file-row ${activePath === node.path ? "active" : ""}`}
      onClick={() => onOpenFile(node.path)}
    >
      <span>📄</span>
      <span>{node.name}</span>
    </button>
  );
}