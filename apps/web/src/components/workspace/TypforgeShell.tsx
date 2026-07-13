"use client";

import { useEffect, useMemo, useState } from "react";

import { SettingsModal } from "@/components/modals/SettingsModal";
import { UploadZipModal } from "@/components/modals/UploadZipModal";
import { api } from "@/lib/api";
import { findFirstTypFile, isSameOrChildPath, joinProjectPath } from "@/lib/file-tree";
import { applyTheme, type ThemePreference } from "@/lib/theme";
import type { CompileResult } from "@/types/build";
import type { FileNode, Project, VersionSnapshot } from "@/types/project";
import { EditorPane } from "./EditorPane";
import { LeftSidebar } from "./LeftSidebar";
import { PdfPreviewPane } from "./PdfPreviewPane";
import { ToolTab, ToolsPanel } from "./ToolsPanel";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { panelLayoutStorage } from "@/lib/panel-layout-storage";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MessageDialog } from "@/components/ui/MessageDialog";
import { TextInputDialog } from "@/components/ui/TextInputDialog";

export function TypforgeShell() {
  type TextDialogState = 
    | { type: "create-file"; parentPath: string; }
    | {type: "create-folder"; parentPath: string;} 
    | {type: "rename-entry"; node: FileNode;} 
    | {type: "rename-project";};

  type DeleteDialogState = {type: "entry"; node: FileNode;} | {type: "project";};

  interface MessageState {
    title: string;
    message: string;
  }

  const [project, setProject] = useState<Project>();
  const [tree, setTree] = useState<FileNode>();
  const [activePath, setActivePath] = useState<string>();
  const [content, setContent] = useState("");
  const [pdfPath, setPdfPath] = useState<string>();
  const [downloadPath, setDownloadPath] = useState<string>();
  const [logs, setLogs] = useState("");
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolTab>("info");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [compiling, setCompiling] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);
  const [textDialog, setTextDialog] = useState<TextDialogState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [messageDialog, setMessageDialog] = useState<MessageState | null>(null);

  const fullScreenModalOpen =
    settingsOpen ||
    uploadOpen ||
    textDialog !== null ||
    deleteDialog !== null ||
    messageDialog !== null;

  const {defaultLayout, onLayoutChanged} = useDefaultLayout({
    id: "typforge-workspace-layout-v1",
    storage: panelLayoutStorage
  });

  const pdfUrl = useMemo(() => {
    if (!pdfPath) return undefined;
    return `${api.absoluteUrl(pdfPath)}?t=${Date.now()}`;
  }, [pdfPath]);

  const downloadUrl = useMemo(() => {
    if (!downloadPath) return undefined;
    return api.absoluteUrl(downloadPath);
  }, [downloadPath]);

  useEffect(() => {
    applyTheme(theme);

    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemThemeChange() {
      applyTheme("system");
    }

    mediaQuery.addEventListener("change",handleSystemThemeChange);
    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [theme]);

  useEffect(() => {setLayoutReady(true);}, []);

  useEffect(() => {void bootstrap();}, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";

      if (!isSaveShortcut) {
        return;
      }

      event.preventDefault();

      if (!compiling) {
        void compileProject(project, true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [project, activePath, content, compiling]);

  async function bootstrap() {
    const existing = await api.listProjects();
    const selected = existing[0] ?? (await api.createProject("Untitled Project"));

    setProject(selected);

    const loadedTree = await api.getTree(selected.id);
    setTree(loadedTree);

    const firstTyp = findFirstTypFile(loadedTree);
    if (firstTyp) {
      await openFile(selected.id, firstTyp.path);
    }

    await refreshVersions(selected.id);

    // Auto-load the current compiled PDF preview when the app starts.
    await compileProject(selected, false);
  }

  async function refreshTree(projectId = project?.id) {
    if (!projectId) return;
    setTree(await api.getTree(projectId));
  }

  async function refreshVersions(projectId = project?.id) {
    if (!projectId) return;
    setVersions(await api.listVersions(projectId));
  }

  async function openFile(projectId: string, path: string) {
    const file = await api.getFile(projectId, path);
    setActivePath(path);
    setContent(file.content);
  }

  async function handleOpenFile(path: string) {
    if (!project) return;
    await openFile(project.id, path);
  }

  async function compileProject(targetProject = project, saveBeforeCompile = true) {
    if (!targetProject) return;

    setCompiling(true);

    try {
      if (saveBeforeCompile && activePath) {
        await api.updateFile(targetProject.id, activePath, content);
        await refreshTree(targetProject.id);
      }

      const result: CompileResult = await api.compile(
        targetProject.id,
        targetProject.entryFile
      );

      if (result.logsUrl) {
        const logResult = await api.getLogs(result.buildId);
        setLogs(logResult.logs);
      } else {
        setLogs(
          result.diagnostics?.map((d) => `${d.severity}: ${d.message}`).join("\n") ?? ""
        );
      }

      if (result.ok) {
        setPdfPath(result.pdfUrl);
        setDownloadPath(result.downloadUrl);
      } else {
        setToolsOpen(true);
        setActiveTool("logs");
      }
    } catch (error) {
      setLogs(error instanceof Error ? error.message : "Compile failed");
      setToolsOpen(true);
      setActiveTool("logs");
    } finally {
      setCompiling(false);
    }
  }

  async function handleCompile() {
    await compileProject(project, true);
  }

  async function handleNewFile() {
    if (!project) return;

    const path = window.prompt("File path", "main.typ");
    if (!path) return;

    await api.createFile(project.id, path, "");
    await refreshTree(project.id);
    await openFile(project.id, path);
  }

  async function handleNewFolder() {
    if (!project) return;

    const path = window.prompt("Folder path", "sections");
    if (!path) return;

    await api.createFolder(project.id, path);
    await refreshTree(project.id);
  }

  async function handleUploadZip(file: File) {
    if (!project) return;

    await api.uploadZip(project.id, file);
    await refreshTree(project.id);
    setUploadOpen(false);

    // Refresh preview after upload because project files may have changed.
    await compileProject(project, false);
  }

  async function handleCreateVersion() {
    if (!project) return;

    const message = window.prompt("Snapshot message", "Manual snapshot") ?? "Manual snapshot";

    await api.createVersion(project.id, message);
    await refreshVersions(project.id);
  }

  async function handleRestoreVersion(versionId: string) {
    if (!project) return;

    await api.restoreVersion(project.id, versionId);
    await refreshTree(project.id);

    const loadedTree = await api.getTree(project.id);
    const firstTyp = findFirstTypFile(loadedTree);

    if (firstTyp) {
      await openFile(project.id, firstTyp.path);
    }

    await compileProject(project, false);
  }

  function handleCreateFile(parentPath: string) {
    setTextDialog({type: "create-file", parentPath});
  }

  function handleCreateFolder(parentPath: string) {
    setTextDialog({type: "create-folder", parentPath});
  }

  async function handleUploadFiles(parentPath: string, files: File[]) {
    if (!project || files.length === 0) return;

    const entries = files.map(
        (file) => ({
          file,
          path: joinProjectPath(parentPath, file.name)
        })
      );

    try {
      await api.uploadEntries(project.id, entries);
      await refreshTree(project.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to upload files");
    }
  }
  
  async function handleUploadFolder(parentPath: string, files: File[]) {
    if (!project || files.length === 0) return;

    const entries = files.map(
        (file) => ({
          file,
          path: joinProjectPath(parentPath, file.webkitRelativePath || file.name)
        })
      );

    try {
      await api.uploadEntries(project.id, entries);
      await refreshTree(project.id);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to upload folder");
    }
  }

  function handleRenameEntry(node: FileNode) {
    setTextDialog({type: "rename-entry", node});
  }

  function handleDeleteEntry(node: FileNode) {
    setDeleteDialog({type: "entry", node});
  }

  function handleDownloadFile(path: string) {
    if (!project) {
      return;
    }

    const link = document.createElement("a");
    link.href = api.fileDownloadUrl(project.id, path);

    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function handleShareProject() {
    setMessageDialog({
      title:
        "Share and collaborate",

      message:
        "Collaboration will become available after authentication and shared projects are implemented."
    });
  }

  function handleRenameProject() {
    setTextDialog({
      type: "rename-project"
    });
  }

  async function handleDuplicateProject() {
    if (!project) {
      return;
    }

    try {
      const duplicate = await api.duplicateProject(project.id);

      setMessageDialog({
        title:"Project duplicated",
        message: `"${duplicate.name}" was created successfully.`
      });
    } catch (error) {
      setMessageDialog({
        title:"Unable to duplicate project",
        message: error instanceof Error ? error.message : "The project could not be duplicated."
      });
    }
  }

  function handleExportProject() {
    if (!project) {
      return;
    }

    const link = document.createElement("a");
    link.href = api.projectExportUrl(project.id);

    document.body.appendChild(link);

    link.click();
    link.remove();
  }

  function handleDeleteProject() {
    setDeleteDialog({type: "project"});
  }

  async function submitTextDialog(value: string) {
    if (!project || !textDialog) {
      return;
    }

    if (textDialog.type === "create-file") {
      const path = joinProjectPath(textDialog.parentPath, value);

      await api.createFile(project.id, path, "");

      await refreshTree(project.id);

      await openFile(project.id, path);

      return;
    }

    if (textDialog.type === "create-folder") {
      const path = joinProjectPath(textDialog.parentPath, value);

      await api.createFolder(project.id, path);

      await refreshTree(project.id);

      return;
    }

    if (textDialog.type === "rename-entry") {
      const node = textDialog.node;

      const result = await api.renameEntry(project.id, node.path, value);

      if (isSameOrChildPath(activePath, node.path)) {
        const suffix = activePath!.slice(node.path.length);

        setActivePath(result.path + suffix);
      }

      const updatedProject = await api.getProject(project.id);
      setProject(updatedProject);

      await refreshTree(project.id);

      return;
    }

    if (textDialog.type === "rename-project") {
      const updated = await api.updateProject(project.id, value);
      setProject(updated);
    }
  }

  async function confirmDeletion() {
    if (!project || !deleteDialog) {
      return;
    }

    if (deleteDialog.type === "project") {
      await api.deleteProject(project.id);

      const remaining = await api.listProjects();

      if (remaining.length === 0) {
        await api.createProject("Untitled Project");
      }

      window.location.reload();

      return;
    }

    const node = deleteDialog.node;

    if (node.type === "folder") {
      await api.deleteFolder(project.id, node.path);
    } else {
      await api.deleteFile(project.id, node.path);
    }

    const loadedTree = await api.getTree(project.id);
    setTree(loadedTree);

    if (isSameOrChildPath(activePath, node.path)) {
      const firstTypFile = findFirstTypFile(loadedTree);

      if (firstTypFile) {
        await openFile(project.id, firstTypFile.path);
      } else {
        setActivePath(undefined);
        setContent("");
      }
    }
  }

  if (!layoutReady) {
    return <div className="shell" aria-hidden="true" />;
  }

  return (
    <>
      <Group
        id="typforge-workspace"
        orientation="horizontal"
        className={fullScreenModalOpen ? "shell shell-modal-blurred" : "shell"}
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <Panel
          id="file-sidebar"
          defaultSize="18%"
          minSize="220px"
          maxSize="360px"
        >
          <div className="workspace-panel">
            <LeftSidebar
              project={project}
              tree={tree}
              activePath={activePath}
              onOpenFile={handleOpenFile}
              onCreateFile={handleCreateFile}
              onCreateFolder={handleCreateFolder}
              onUploadFiles={handleUploadFiles}
              onUploadFolder={handleUploadFolder}
              onRenameEntry={handleRenameEntry}
              onDeleteEntry={handleDeleteEntry}
              onDownloadFile={handleDownloadFile}
              onShareProject={handleShareProject}
              onRenameProject={handleRenameProject}
              onDeleteProject={handleDeleteProject}
              onDuplicateProject={handleDuplicateProject}
              onExportProject={handleExportProject}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
        </Panel>

        <Separator
          id="sidebar-editor-separator"
          className="workspace-resize-handle"
        />

        <Panel
          id="typst-editor"
          defaultSize="36%"
          minSize="360px"
        >
          <div className="workspace-panel">
            <EditorPane
              activePath={activePath}
              content={content}
              onChange={setContent}
              onOpenTools={() => setToolsOpen((value) => !value)}
            />
          </div>
        </Panel>

        <Separator
          id="editor-preview-separator"
          className="workspace-resize-handle"
        />

        <Panel
          id="preview-tools"
          defaultSize="46%"
          minSize="400px"
        >
          <div className="workspace-panel">
            {toolsOpen ? (
              <ToolsPanel
                activeTab={activeTool}
                onChangeTab={setActiveTool}
                project={project}
                versions={versions}
                logs={logs}
                onCreateVersion={handleCreateVersion}
                onRestoreVersion={handleRestoreVersion}
              />
            ) : (
              <PdfPreviewPane
                pdfUrl={pdfUrl}
                downloadUrl={downloadUrl}
                compiling={compiling}
                onCompile={handleCompile}
              />
            )}
          </div>
        </Panel>
      </Group>

      {settingsOpen ? (
        <SettingsModal
          theme={theme}
          onChangeTheme={setTheme}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {uploadOpen ? (
        <UploadZipModal
          onUpload={handleUploadZip}
          onClose={() => setUploadOpen(false)}
        />
      ) : null}

      {textDialog !== null ? (
        <TextInputDialog
          open
          title={
            textDialog?.type === "create-file" ? "Create new file"
            : textDialog?.type === "create-folder" ? "Create new folder"
            : textDialog?.type === "rename-project" ? "Rename project"
              : textDialog?.node.type === "folder" ? "Rename directory"
                : "Rename file"
          }

          placeholder={
            textDialog?.type === "create-folder" ? "Folder name"
            : textDialog?.type === "rename-project" ? "Project name"
              : "File name"
          }

          initialValue={
            textDialog?.type === "create-file" ? ".typ"
            : textDialog?.type === "create-folder" ? ""
            : textDialog?.type === "rename-project" ? project?.name ?? ""
              : textDialog?.node.name ?? ""
          }

          selectionMode={
            textDialog?.type === "create-file" ? "before-extension"
            : textDialog?.type === "create-folder" ? "end"
              : "select-all"
          }

          validateValue={
            (value) => {
              if (textDialog?.type === "create-file") {
                return value.toLowerCase() !== ".typ";
              }

              if (textDialog?.type === "rename-entry") {
                return value !== textDialog.node.name;
              }

              if (textDialog?.type === "rename-project") {
                return value !== project?.name;
              }

              return true;
            }
          }

          onClose={() => setTextDialog(null)}
          onSubmit={submitTextDialog}
        />
      ) : null}

      <ConfirmDialog
        open={deleteDialog !== null}
        title="Confirm deletion"
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteDialog(null)}
        onConfirm={confirmDeletion}
      >
        {deleteDialog?.type === "project" ? (
          <>
            Are you sure you want to delete{" "}
            <code>{project?.name}</code>? This action cannot
            be undone.
          </>
        ) : (
          <>
            Are you sure you want to delete{" "}
            <code>{deleteDialog?.node.name}</code>?
          </>
        )}
      </ConfirmDialog>

      <MessageDialog
        open={messageDialog !== null}
        title={messageDialog?.title ?? ""}
        message={messageDialog?.message ?? ""}
        onClose={() => setMessageDialog(null)}
      />
    </>
  );
}