"use client";

import type { FileNode, Project } from "@/types/project";
import { AccountMenu } from "./AccountMenu";
import { FileTree } from "./FileTree";

interface LeftSidebarProps {
  project?: Project;
  tree?: FileNode;
  activePath?: string;
  onOpenFile: (path: string) => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onUploadZip: () => void;
  onOpenSettings: () => void;
}

export function LeftSidebar({
  project,
  tree,
  activePath,
  onOpenFile,
  onNewFile,
  onNewFolder,
  onUploadZip,
  onOpenSettings
}: LeftSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-mark">T</span>
          <span>Typforge</span>
        </div>
        <div className="muted small" style={{ marginTop: 8 }}>
          {project?.name ?? "Loading project..."}
        </div>
      </div>

      <div className="sidebar-actions">
        <button className="icon-button" title="New file" onClick={onNewFile}>
          +
        </button>
        <button className="icon-button" title="New folder" onClick={onNewFolder}>
          ⌁
        </button>
        <button className="secondary-button" onClick={onUploadZip}>
          Upload ZIP
        </button>
      </div>

      <div className="sidebar-main">
        <FileTree node={tree} activePath={activePath} onOpenFile={onOpenFile} />
      </div>

      <div className="sidebar-footer">
        <AccountMenu onOpenSettings={onOpenSettings} />
        <button className="secondary-button" disabled title="Collaboration is not in MVP">
          Invite
        </button>
      </div>
    </aside>
  );
}