"use client";

import {
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FilePlus2,
  FileUp,
  FolderPlus,
  FolderUp,
  Pencil,
  Plus,
  Share2,
  Trash2
} from "lucide-react";

import {
  type ChangeEvent,
  type InputHTMLAttributes,
  type MouseEvent,
  useRef,
  useState
} from "react";

import {
  PopupMenu,
  type PopupMenuItem
} from "@/components/ui/PopupMenu";

import type {
  FileNode,
  Project
} from "@/types/project";

import {
  AccountMenu
} from "./AccountMenu";

import {
  FileTree
} from "./FileTree";

interface LeftSidebarProps {
  project?: Project;
  tree?: FileNode;
  activePath?: string;

  onOpenFile:
    (path: string) => void;

  onCreateFile:
    (parentPath: string) => void;

  onCreateFolder:
    (parentPath: string) => void;

  onUploadFiles:
    (
      parentPath: string,
      files: File[]
    ) => Promise<void>;

  onUploadFolder:
    (
      parentPath: string,
      files: File[]
    ) => Promise<void>;

  onRenameEntry:
    (node: FileNode) => void;

  onDeleteEntry:
    (node: FileNode) => void;

  onDownloadFile:
    (path: string) => void;

  onShareProject:
    () => void;

  onRenameProject:
    () => void;

  onDeleteProject:
    () => void;

  onDuplicateProject:
    () => void;

  onExportProject:
    () => void;

  onOpenSettings:
    () => void;
}

interface MenuPosition {
  x: number;
  y: number;
}

interface DirectoryInputProps
  extends
    InputHTMLAttributes<HTMLInputElement> {
  webkitdirectory?: string;
  directory?: string;
}

const directoryInputProps:
  DirectoryInputProps = {
    webkitdirectory: "",
    directory: ""
  };

export function LeftSidebar({
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
  onShareProject,
  onRenameProject,
  onDeleteProject,
  onDuplicateProject,
  onExportProject,
  onOpenSettings
}: LeftSidebarProps) {
  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    );

  const folderInputRef =
    useRef<HTMLInputElement>(
      null
    );

  const [
    uploadTarget,
    setUploadTarget
  ] = useState("");

  const [
    projectMenu,
    setProjectMenu
  ] = useState<
    MenuPosition | null
  >(null);

  const [
    rootMenu,
    setRootMenu
  ] = useState<
    MenuPosition | null
  >(null);

  function openProjectMenu(
    event:
      MouseEvent<HTMLButtonElement>
  ) {
    event.stopPropagation();

    if (projectMenu) {
      setProjectMenu(null);
      return;
    }

    const bounds =
      event.currentTarget
        .getBoundingClientRect();

    setProjectMenu({
      x: bounds.left,
      y: bounds.bottom + 6
    });
  }

  function openRootMenu(
    event:
      MouseEvent<HTMLButtonElement>
  ) {
    event.stopPropagation();

    const bounds =
      event.currentTarget
        .getBoundingClientRect();

    setRootMenu({
      x: bounds.right - 4,
      y: bounds.bottom + 5
    });
  }

  function requestFileUpload(
    parentPath: string
  ) {
    setUploadTarget(
      parentPath
    );

    fileInputRef.current
      ?.click();
  }

  function requestFolderUpload(
    parentPath: string
  ) {
    setUploadTarget(
      parentPath
    );

    folderInputRef.current
      ?.click();
  }

  async function handleFileSelection(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const files =
      Array.from(
        event.target.files ?? []
      );

    event.target.value = "";

    if (
      files.length === 0
    ) {
      return;
    }

    await onUploadFiles(
      uploadTarget,
      files
    );
  }

  async function handleFolderSelection(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const files =
      Array.from(
        event.target.files ?? []
      );

    event.target.value = "";

    if (
      files.length === 0
    ) {
      return;
    }

    await onUploadFolder(
      uploadTarget,
      files
    );
  }

  const rootMenuItems:
    PopupMenuItem[] = [
      {
        id: "root-create-file",
        label: "Create File",
        icon: (
          <FilePlus2 size={15} />
        ),
        onSelect: () =>
          onCreateFile("")
      },
      {
        id: "root-create-folder",
        label: "Create Folder",
        icon: (
          <FolderPlus size={15} />
        ),
        onSelect: () =>
          onCreateFolder("")
      },
      {
        id: "root-upload-file",
        label: "Upload File",
        separatorBefore: true,
        icon: (
          <FileUp size={15} />
        ),
        onSelect: () =>
          requestFileUpload("")
      },
      {
        id: "root-upload-folder",
        label: "Upload Folder",
        icon: (
          <FolderUp size={15} />
        ),
        onSelect: () =>
          requestFolderUpload("")
      }
    ];

  const projectMenuItems:
    PopupMenuItem[] = [
      {
        id: "share-project",
        label:
          "Share and collaborate",
        icon: (
          <Share2 size={15} />
        ),
        onSelect:
          onShareProject
      },
      {
        id: "rename-project",
        label: "Rename",
        separatorBefore: true,
        icon: (
          <Pencil size={15} />
        ),
        onSelect:
          onRenameProject
      },
      {
        id: "duplicate-project",
        label: "Duplicate",
        icon: (
          <Copy size={15} />
        ),
        onSelect:
          onDuplicateProject
      },
      {
        id: "export-project",
        label: "Export (zip)",
        icon: (
          <Download size={15} />
        ),
        onSelect:
          onExportProject
      },
      {
        id: "delete-project",
        label: "Delete",
        danger: true,
        separatorBefore: true,
        icon: (
          <Trash2 size={15} />
        ),
        onSelect:
          onDeleteProject
      }
    ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand-row">
        <div className="brand">
          <span className="brand-mark">
            T
          </span>

          <span>
            Typforge
          </span>
        </div>
      </div>

      <div className="project-name-row">
        <button
          type="button"
          className="project-menu-trigger"
          onClick={
            openProjectMenu
          }
          aria-expanded={
            projectMenu !== null
          }
        >
          <span className="project-name-text">
            {project?.name ??
              "Loading project..."}
          </span>

          {projectMenu ? (
            <ChevronUp size={17} />
          ) : (
            <ChevronDown
              size={17}
            />
          )}
        </button>
      </div>

      <div className="files-section-header">
        <span>
          Files
        </span>

        <button
          type="button"
          className="sidebar-header-icon"
          aria-label="Create or upload"
          title="Create or upload"
          onClick={
            openRootMenu
          }
        >
          <Plus size={17} />
        </button>
      </div>

      <div className="sidebar-main">
        <FileTree
          node={tree}
          activePath={
            activePath
          }
          onOpenFile={
            onOpenFile
          }
          onCreateFile={
            onCreateFile
          }
          onCreateFolder={
            onCreateFolder
          }
          onRequestUploadFile={
            requestFileUpload
          }
          onRequestUploadFolder={
            requestFolderUpload
          }
          onRenameEntry={
            onRenameEntry
          }
          onDeleteEntry={
            onDeleteEntry
          }
          onDownloadFile={
            onDownloadFile
          }
        />
      </div>

      <div className="sidebar-footer">
        <AccountMenu
          onOpenSettings={
            onOpenSettings
          }
        />

        <button
          className="secondary-button"
          disabled
          title="Collaboration requires authentication"
        >
          Invite
        </button>
      </div>

      <input
        ref={fileInputRef}
        className="visually-hidden-file-input"
        type="file"
        multiple
        onChange={
          handleFileSelection
        }
      />

      <input
        {...directoryInputProps}
        ref={folderInputRef}
        className="visually-hidden-file-input"
        type="file"
        multiple
        onChange={
          handleFolderSelection
        }
      />

      <PopupMenu
        open={
          projectMenu !== null
        }
        x={
          projectMenu?.x ?? 0
        }
        y={
          projectMenu?.y ?? 0
        }
        items={
          projectMenuItems
        }
        onClose={() =>
          setProjectMenu(null)
        }
      />

      <PopupMenu
        open={
          rootMenu !== null
        }
        x={
          rootMenu?.x ?? 0
        }
        y={
          rootMenu?.y ?? 0
        }
        items={
          rootMenuItems
        }
        onClose={() =>
          setRootMenu(null)
        }
      />
    </aside>
  );
}