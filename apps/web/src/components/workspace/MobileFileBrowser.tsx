"use client";

import {
  ChevronDown,
  FilePlus2,
  FileText,
  FileUp,
  FolderPlus,
  FolderUp,
  MoreHorizontal,
  Plus
} from "lucide-react";
import {
  type ChangeEvent,
  type InputHTMLAttributes,
  type MouseEvent,
  useRef,
  useState
} from "react";

import { PopupMenu, type PopupMenuItem } from "@/components/ui/PopupMenu";
import type { FileNode, Project } from "@/types/project";

import { AccountMenu } from "./AccountMenu";
import { FileTree } from "./FileTree";

interface MobileFileBrowserProps {
  variant: "page" | "sheet";
  project?: Project;
  tree?: FileNode;
  activePath?: string;
  onOpenFile: (path: string) => void;
  onCreateFile: (parentPath: string) => void;
  onCreateFolder: (parentPath: string) => void;
  onUploadFiles: (parentPath: string, files: File[]) => Promise<void>;
  onUploadFolder: (parentPath: string, files: File[]) => Promise<void>;
  onRenameEntry: (node: FileNode) => void;
  onDeleteEntry: (node: FileNode) => void;
  onDownloadFile: (path: string) => void;
  onOpenSettings?: () => void;
  onCloseSheet?: () => void;
  onOpenFileActions?: () => void;
}

interface MenuPosition {
  x: number;
  y: number;
}

interface DirectoryInputProps extends InputHTMLAttributes<HTMLInputElement> {
  webkitdirectory?: string;
  directory?: string;
}

const directoryInputProps: DirectoryInputProps = {
  webkitdirectory: "",
  directory: ""
};

function getFileName(path?: string) {
  if (!path) {
    return "No file open";
  }

  return path.split("/").pop() ?? path;
}

export function MobileFileBrowser({
  variant,
  project,
  tree,
  activePath,
  onOpenFile,
  onCreateFile,
  onCreateFolder,
  onUploadFiles,
  onUploadFolder,
  onRenameEntry,
  onDeleteEntry,
  onDownloadFile,
  onOpenSettings,
  onCloseSheet,
  onOpenFileActions
}: MobileFileBrowserProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState("");
  const [rootMenu, setRootMenu] = useState<MenuPosition | null>(null);

  function openRootMenu(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    const bounds = event.currentTarget.getBoundingClientRect();
    const menuWidth = 220;
    const x = Math.min(
      Math.max(12, bounds.right - menuWidth),
      window.innerWidth - menuWidth - 12
    );

    setRootMenu({ x, y: bounds.bottom + 6 });
  }

  function requestFileUpload(parentPath: string) {
    setUploadTarget(parentPath);
    fileInputRef.current?.click();
  }

  function requestFolderUpload(parentPath: string) {
    setUploadTarget(parentPath);
    folderInputRef.current?.click();
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length > 0) {
      await onUploadFiles(uploadTarget, files);
    }
  }

  async function handleFolderSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length > 0) {
      await onUploadFolder(uploadTarget, files);
    }
  }

  function handleOpenFile(path: string) {
    onOpenFile(path);

    if (variant === "sheet") {
      onCloseSheet?.();
    }
  }

  const rootMenuItems: PopupMenuItem[] = [
    {
      id: "mobile-root-create-file",
      label: "Create File",
      icon: <FilePlus2 size={16} />,
      onSelect: () => onCreateFile("")
    },
    {
      id: "mobile-root-create-folder",
      label: "Create Folder",
      icon: <FolderPlus size={16} />,
      onSelect: () => onCreateFolder("")
    },
    {
      id: "mobile-root-upload-file",
      label: "Upload File",
      separatorBefore: true,
      icon: <FileUp size={16} />,
      onSelect: () => requestFileUpload("")
    },
    {
      id: "mobile-root-upload-folder",
      label: "Upload Folder",
      icon: <FolderUp size={16} />,
      onSelect: () => requestFolderUpload("")
    }
  ];

  return (
    <section
      className={
        variant === "sheet"
          ? "mobile-file-browser mobile-file-browser-sheet"
          : "mobile-file-browser mobile-file-browser-page"
      }
    >
      {variant === "sheet" ? (
        <header className="mobile-file-sheet-heading">
          <button
            type="button"
            className="mobile-file-sheet-current"
            aria-label="Close file list"
            onClick={onCloseSheet}
          >
            <FileText size={16} />
            <span>{getFileName(activePath)}</span>
            <ChevronDown size={16} />
          </button>

          <button
            type="button"
            className="mobile-file-sheet-more"
            aria-label="Open file actions"
            disabled={!activePath}
            onClick={() => {
              onCloseSheet?.();
              onOpenFileActions?.();
            }}
          >
            <MoreHorizontal size={20} />
          </button>
        </header>
      ) : null}

      <div className="mobile-file-browser-heading">
        <span>Project Files</span>

        <button
          type="button"
          className="mobile-file-browser-add"
          aria-label="Create or upload"
          onClick={openRootMenu}
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="mobile-file-browser-tree">
        <FileTree
          node={tree}
          activePath={activePath}
          toggleFolderOnRowClick
          onOpenFile={handleOpenFile}
          onCreateFile={onCreateFile}
          onCreateFolder={onCreateFolder}
          onRequestUploadFile={requestFileUpload}
          onRequestUploadFolder={requestFolderUpload}
          onRenameEntry={onRenameEntry}
          onDeleteEntry={onDeleteEntry}
          onDownloadFile={onDownloadFile}
        />
      </div>

      {variant === "page" ? (
        <footer className="mobile-file-browser-account">
          <AccountMenu onOpenSettings={onOpenSettings ?? (() => undefined)} />
        </footer>
      ) : null}

      <input
        ref={fileInputRef}
        className="visually-hidden-file-input"
        type="file"
        multiple
        onChange={handleFileSelection}
      />

      <input
        {...directoryInputProps}
        ref={folderInputRef}
        className="visually-hidden-file-input"
        type="file"
        multiple
        onChange={handleFolderSelection}
      />

      <PopupMenu
        open={rootMenu !== null}
        x={rootMenu?.x ?? 0}
        y={rootMenu?.y ?? 0}
        items={rootMenuItems}
        onClose={() => setRootMenu(null)}
      />
    </section>
  );
}
