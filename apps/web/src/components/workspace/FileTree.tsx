"use client";

import {
  ChevronDown,
  ChevronRight,
  Download,
  FilePlus2,
  FileText,
  FileUp,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderUp,
  Pencil,
  Plus,
  Trash2
} from "lucide-react";

import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState
} from "react";

import {
  PopupMenu,
  type PopupMenuItem
} from "@/components/ui/PopupMenu";

import type {
  FileNode
} from "@/types/project";

interface FileTreeProps {
  node?: FileNode;
  activePath?: string;
  toggleFolderOnRowClick?: boolean;

  onOpenFile:
    (path: string) => void;

  onCreateFile:
    (parentPath: string) => void;

  onCreateFolder:
    (parentPath: string) => void;

  onRequestUploadFile:
    (parentPath: string) => void;

  onRequestUploadFolder:
    (parentPath: string) => void;

  onRenameEntry:
    (node: FileNode) => void;

  onDeleteEntry:
    (node: FileNode) => void;

  onDownloadFile:
    (path: string) => void;
}

type MenuState =
  | {
      type: "create";
      parentPath: string;
      x: number;
      y: number;
    }
  | {
      type: "file";
      node: FileNode;
      x: number;
      y: number;
    }
  | {
      type: "folder";
      node: FileNode;
      x: number;
      y: number;
    };

function collectFolderPaths(
  node?: FileNode
): string[] {
  if (!node) {
    return [];
  }

  if (node.type === "file") {
    return [];
  }

  return [
    ...(node.path
      ? [node.path]
      : []),

    ...(node.children ?? [])
      .flatMap(
        collectFolderPaths
      )
  ];
}

export function FileTree({
  node,
  activePath,
  toggleFolderOnRowClick = false,
  onOpenFile,
  onCreateFile,
  onCreateFolder,
  onRequestUploadFile,
  onRequestUploadFolder,
  onRenameEntry,
  onDeleteEntry,
  onDownloadFile
}: FileTreeProps) {
  const [
    expandedPaths,
    setExpandedPaths
  ] = useState<Set<string>>(
    new Set()
  );

  const [
    menu,
    setMenu
  ] = useState<MenuState | null>(
    null
  );

  const knownFolders =
    useRef<Set<string>>(
      new Set()
    );

  useEffect(() => {
    const folderPaths =
      collectFolderPaths(node);

    const currentFolderSet =
      new Set(folderPaths);

    setExpandedPaths(
      (current) => {
        const next =
          new Set<string>();

        for (
          const folderPath
          of folderPaths
        ) {
          const isNew =
            !knownFolders.current
              .has(folderPath);

          if (
            isNew ||
            current.has(folderPath)
          ) {
            next.add(folderPath);
          }
        }

        return next;
      }
    );

    knownFolders.current =
      currentFolderSet;
  }, [node]);

  function toggleFolder(
    path: string
  ) {
    setExpandedPaths(
      (current) => {
        const next =
          new Set(current);

        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }

        return next;
      }
    );
  }

  function openCreateMenu(
    event:
      ReactMouseEvent<HTMLButtonElement>,
    parentPath: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    const bounds =
      event.currentTarget
        .getBoundingClientRect();

    setMenu({
      type: "create",
      parentPath,
      x: bounds.right - 4,
      y: bounds.bottom + 5
    });
  }

  function openContextMenu(
    event:
      ReactMouseEvent,
    target: FileNode
  ) {
    event.preventDefault();
    event.stopPropagation();

    setMenu({
      type:
        target.type === "folder"
          ? "folder"
          : "file",

      node: target,

      x: event.clientX,
      y: event.clientY
    });
  }

  function createMenuItems(
    parentPath: string
  ): PopupMenuItem[] {
    return [
      {
        id: "create-file",
        label: "Create File",
        icon: (
          <FilePlus2 size={15} />
        ),
        onSelect: () =>
          onCreateFile(
            parentPath
          )
      },
      {
        id: "create-folder",
        label: "Create Folder",
        icon: (
          <FolderPlus size={15} />
        ),
        onSelect: () =>
          onCreateFolder(
            parentPath
          )
      },
      {
        id: "upload-file",
        label: "Upload File",
        separatorBefore: true,
        icon: (
          <FileUp size={15} />
        ),
        onSelect: () =>
          onRequestUploadFile(
            parentPath
          )
      },
      {
        id: "upload-folder",
        label: "Upload Folder",
        icon: (
          <FolderUp size={15} />
        ),
        onSelect: () =>
          onRequestUploadFolder(
            parentPath
          )
      }
    ];
  }

  function fileMenuItems(
    target: FileNode
  ): PopupMenuItem[] {
    return [
      {
        id: "rename-file",
        label: "Rename file",
        icon: (
          <Pencil size={15} />
        ),
        onSelect: () =>
          onRenameEntry(target)
      },
      {
        id: "download-file",
        label: "Download file",
        icon: (
          <Download size={15} />
        ),
        onSelect: () =>
          onDownloadFile(
            target.path
          )
      },
      {
        id: "delete-file",
        label: "Delete file",
        danger: true,
        separatorBefore: true,
        icon: (
          <Trash2 size={15} />
        ),
        onSelect: () =>
          onDeleteEntry(target)
      }
    ];
  }

  function folderMenuItems(
    target: FileNode
  ): PopupMenuItem[] {
    return [
      {
        id: "rename-directory",
        label: "Rename directory",
        icon: (
          <Pencil size={15} />
        ),
        onSelect: () =>
          onRenameEntry(target)
      },
      {
        id: "delete-directory",
        label: "Delete directory",
        danger: true,
        separatorBefore: true,
        icon: (
          <Trash2 size={15} />
        ),
        onSelect: () =>
          onDeleteEntry(target)
      }
    ];
  }

  let menuItems:
    PopupMenuItem[] = [];

  if (menu?.type === "create") {
    menuItems =
      createMenuItems(
        menu.parentPath
      );
  }

  if (menu?.type === "file") {
    menuItems =
      fileMenuItems(
        menu.node
      );
  }

  if (menu?.type === "folder") {
    menuItems =
      folderMenuItems(
        menu.node
      );
  }

  return (
    <>
      <div className="file-tree">
        {(node?.children ?? [])
          .map(
            (child) => (
              <TreeNode
                key={
                  child.path
                }
                node={child}
                depth={0}
                activePath={
                  activePath
                }
                expandedPaths={
                  expandedPaths
                }
                onToggleFolder={
                  toggleFolder
                }
                toggleFolderOnRowClick={
                  toggleFolderOnRowClick
                }
                onOpenFile={
                  onOpenFile
                }
                onOpenCreateMenu={
                  openCreateMenu
                }
                onOpenContextMenu={
                  openContextMenu
                }
              />
            )
          )}
      </div>

      <PopupMenu
        open={menu !== null}
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        items={menuItems}
        onClose={() =>
          setMenu(null)
        }
      />
    </>
  );
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  activePath?: string;
  toggleFolderOnRowClick: boolean;

  expandedPaths:
    Set<string>;

  onToggleFolder:
    (path: string) => void;

  onOpenFile:
    (path: string) => void;

  onOpenCreateMenu:
    (
      event:
        ReactMouseEvent<HTMLButtonElement>,
      parentPath: string
    ) => void;

  onOpenContextMenu:
    (
      event: ReactMouseEvent,
      node: FileNode
    ) => void;
}

function TreeNode({
  node,
  depth,
  activePath,
  toggleFolderOnRowClick,
  expandedPaths,
  onToggleFolder,
  onOpenFile,
  onOpenCreateMenu,
  onOpenContextMenu
}: TreeNodeProps) {
  const indent =
    depth * 17;

  if (node.type === "file") {
    return (
      <button
        type="button"
        className={
          activePath === node.path
            ? "file-tree-row file-row active"
            : "file-tree-row file-row"
        }
        style={{
          paddingLeft:
            12 + indent
        }}
        onClick={() =>
          onOpenFile(
            node.path
          )
        }
        onContextMenu={
          (event) =>
            onOpenContextMenu(
              event,
              node
            )
        }
      >
        <FileText
          className="tree-static-icon"
          size={15}
        />

        <span className="tree-node-name">
          {node.name}
        </span>
      </button>
    );
  }

  const expanded =
    expandedPaths.has(
      node.path
    );

  return (
    <div className="tree-folder">
      <div
        className="file-tree-row folder-row"
        style={{
          paddingLeft:
            12 + indent
        }}
        onClick={
          toggleFolderOnRowClick
            ? () => onToggleFolder(node.path)
            : undefined
        }
        onContextMenu={
          (event) =>
            onOpenContextMenu(
              event,
              node
            )
        }
      >
        {expanded ? (
          <FolderOpen
            className="tree-static-icon"
            size={16}
          />
        ) : (
          <Folder
            className="tree-static-icon"
            size={16}
          />
        )}

        <span className="tree-node-name">
          {node.name}
        </span>

        <div className="tree-row-actions">
          <button
            type="button"
            className="tree-icon-button"
            aria-label={
              `Create inside ${node.name}`
            }
            title="Create or upload"
            onClick={
              (event) =>
                onOpenCreateMenu(
                  event,
                  node.path
                )
            }
          >
            <Plus size={15} />
          </button>

          <button
            type="button"
            className="tree-icon-button"
            aria-label={
              expanded
                ? `Collapse ${node.name}`
                : `Expand ${node.name}`
            }
            title={
              expanded
                ? "Collapse"
                : "Expand"
            }
            onClick={
              (event) => {
                event.stopPropagation();

                onToggleFolder(
                  node.path
                );
              }
            }
          >
            {expanded ? (
              <ChevronDown
                size={16}
              />
            ) : (
              <ChevronRight
                size={16}
              />
            )}
          </button>
        </div>
      </div>

      {expanded ? (
        <div>
          {(node.children ?? [])
            .map(
              (child) => (
                <TreeNode
                  key={
                    child.path
                  }
                  node={child}
                  depth={
                    depth + 1
                  }
                  activePath={
                    activePath
                  }
                  expandedPaths={
                    expandedPaths
                  }
                  toggleFolderOnRowClick={
                    toggleFolderOnRowClick
                  }
                  onToggleFolder={
                    onToggleFolder
                  }
                  onOpenFile={
                    onOpenFile
                  }
                  onOpenCreateMenu={
                    onOpenCreateMenu
                  }
                  onOpenContextMenu={
                    onOpenContextMenu
                  }
                />
              )
            )}
        </div>
      ) : null}
    </div>
  );
}