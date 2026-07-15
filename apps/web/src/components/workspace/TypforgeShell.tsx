"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

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
import {
  DEFAULT_EDITOR_SETTINGS,
  loadEditorSettings,
  saveEditorSettings,
  type EditorSettings
} from "@/lib/editor-settings";
import type { OpenEditorFile } from "@/types/editor";

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
  const [openFiles, setOpenFiles] = useState<OpenEditorFile[]>([]);
  const [activePath, setActivePath] = useState<string>();
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
  const [pendingClosePath, setPendingClosePath] = useState<string | null>(null);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(DEFAULT_EDITOR_SETTINGS);
  const [pdfRevision, setPdfRevision] = useState(0);
  const compileInFlightRef = useRef(false);

  const fullScreenModalOpen =
    settingsOpen ||
    uploadOpen ||
    textDialog !== null ||
    deleteDialog !== null ||
    messageDialog !== null ||
    pendingClosePath !== null;

  const {defaultLayout, onLayoutChanged} = useDefaultLayout({
    id: "typforge-workspace-layout-v1",
    storage: panelLayoutStorage
  });

  const pdfUrl = useMemo(() => {
    if (!pdfPath) return undefined;
    return `${api.absoluteUrl(pdfPath)}?revision=${pdfRevision}`;
  },[pdfPath,pdfRevision]);

  const downloadUrl = useMemo(() => {
    if (!downloadPath) return undefined;
    return api.absoluteUrl(downloadPath);
  }, [downloadPath]);

  const activeFile = useMemo(() => openFiles.find((file) => file.path === activePath),[openFiles, activePath]);
  const content = activeFile?.content ?? "";
  const editorDirty = Boolean(activeFile && activeFile.content !== activeFile.savedContent);
  const hasDirtyFiles = useMemo(() => openFiles.some((file) => file.content !== file.savedContent),[openFiles]);

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

  useEffect(() => {
    setEditorSettings(loadEditorSettings());
    setLayoutReady(true);
  }, []);

  useEffect(() => {
    if (!layoutReady) {
      return;
    }
    saveEditorSettings(editorSettings);
  }, [editorSettings,layoutReady]);

  useEffect(() => {void bootstrap();}, []);

  useEffect(() => {
    if (!hasDirtyFiles) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasDirtyFiles]);

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

  async function openFile(projectId: string,path: string,forceReload = false) {
    const existingFile = openFiles.find((file) => file.path ===path);

    if (existingFile && !forceReload) {
      setActivePath(path);
      return;
    }

    const file = await api.getFile(projectId, path);

    setOpenFiles((current) => {
      const alreadyOpen = current.some((openFile) => openFile.path ===path);

      if (alreadyOpen) {
        return current.map((openFile) =>
            openFile.path === path
              ? { path, content: file.content, savedContent: file.content }
              : openFile
        );
      }

      return [
        ...current,
        { path, content: file.content, savedContent: file.content }
      ];
    });

    setActivePath(path);
  }

  async function handleOpenFile(path: string) {
    if (!project) return;
    await openFile(project.id, path);
  }

  function handleEditorChange(value: string) {
    if (!activePath) {
      return;
    }

    setOpenFiles(current => current.map(file => file.path === activePath? { ...file, content:value }: file));
  }

  function handleSelectEditorTab(path: string) {
    setActivePath(path);
  }

  function closeEditorTab(path: string) {
    const closingIndex = openFiles.findIndex((file) => file.path === path);

    if (closingIndex < 0) {
      return;
    }

    const remainingFiles = openFiles.filter((file) => file.path !== path);

    setOpenFiles(remainingFiles);

    if (activePath !== path) {
      return;
    }

    const nextFile = remainingFiles[Math.min(closingIndex, remainingFiles.length - 1)];

    setActivePath(nextFile?.path);
  }

  function handleRequestCloseEditorTab(path: string) {
    const file = openFiles.find((openFile) => openFile.path === path);

    if (!file) {
      return;
    }

    const dirty = file.content !== file.savedContent;

    if (dirty) {
      setPendingClosePath(path);
      return;
    }

    closeEditorTab(path);
  }

  async function confirmDiscardAndCloseTab() {
    if (!pendingClosePath) return;

    closeEditorTab(pendingClosePath);
}

  const compileProject = useCallback(async (targetProject = project,saveBeforeCompile = true): Promise<boolean> => {
      if (!targetProject || compileInFlightRef.current) return false;

      compileInFlightRef.current = true;
      setCompiling(true);

      const fileToSave = saveBeforeCompile ? activeFile : undefined;

      let saveCompleted = !fileToSave;

      try {
        if (fileToSave) {
          await api.updateFile(targetProject.id, fileToSave.path, fileToSave.content);
          saveCompleted = true;
          setOpenFiles((current) => current.map((file) => file.path === fileToSave.path ? { ...file, savedContent: fileToSave.content } : file));
        }

        const result:CompileResult = await api.compile(targetProject.id, targetProject.entryFile);

        if (result.logsUrl) {
          const logResult = await api.getLogs(result.buildId);
          setLogs(logResult.logs);
        } else {
          setLogs(
            result.diagnostics?.map((diagnostic) => 
              `${diagnostic.severity}: ${diagnostic.message}`).join("\n") ?? ""
          );
        }

        if (result.ok) {
          setPdfPath(result.pdfUrl);
          setDownloadPath(result.downloadUrl);
          setPdfRevision((current) => current + 1);
        } else {
          setToolsOpen(true);
          setActiveTool("logs");
        }

        return true;
      } catch (
        error
      ) {
        setLogs(error instanceof Error ? error.message : "Compile failed");
        setToolsOpen(true);
        setActiveTool("logs");

        return saveCompleted;
      } finally {
        compileInFlightRef.current = false;
        setCompiling(false);
      }
    }, [project, activeFile]
  );

  const saveAndCompileCurrent = useCallback(
    async () => {
      await compileProject(project, true);
    },[compileProject, project]
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";

      if (!isSaveShortcut) {
        return;
      }

      event.preventDefault();

      if (!compiling) {
        void saveAndCompileCurrent();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [compiling, saveAndCompileCurrent]);

  useEffect(() => {
    if (!editorSettings.realtimeCompilation || !editorDirty || !project || !activePath || compiling) {
      return;
    }

    const timeoutId = window.setTimeout(() => { void saveAndCompileCurrent(); }, 750);
    return () => { window.clearTimeout(timeoutId); };
  }, [editorSettings.realtimeCompilation, editorDirty, project, activePath, content, compiling, saveAndCompileCurrent]);

  async function handleCompile() {
    await saveAndCompileCurrent();
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
    setOpenFiles([]);
    setActivePath(undefined);
    await refreshTree(project.id);

    const loadedTree = await api.getTree(project.id);
    const firstTyp = findFirstTypFile(loadedTree);

    if (firstTyp) {
      await openFile(project.id, firstTyp.path, true);
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

      function renamedPath(currentPath: string) {
        const suffix = currentPath.slice(node.path.length);

        return result.path + suffix;
      }

      setOpenFiles(current => current.map((file) =>
          isSameOrChildPath(file.path, node.path)
            ? { ...file, path: renamedPath(file.path) }
            : file
      ));

      if (isSameOrChildPath(activePath, node.path)) {
        setActivePath(renamedPath(activePath!));
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

    const activeFileWasDeleted = isSameOrChildPath(activePath, node.path);
    const remainingOpenFiles = openFiles.filter((file) => !isSameOrChildPath(file.path, node.path));

    setOpenFiles(remainingOpenFiles);

    if (activeFileWasDeleted) {
      const nextOpenFile = remainingOpenFiles[0];

      if (nextOpenFile) {
        setActivePath(nextOpenFile.path);
        return;
      }

      const firstTypFile = findFirstTypFile(loadedTree);

      if (firstTypFile) {
        await openFile(project.id, firstTypFile.path, true);
      } else {
        setActivePath(undefined);
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
          <div className="workspace-panel workspace-panel-sidebar">
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
          <div className="workspace-panel workspace-panel-editor">
            <EditorPane
              openFiles={openFiles}
              activePath={activePath}
              content={content}
              fontSize={editorSettings.fontSize}
              toolsOpen={toolsOpen}
              onChange={handleEditorChange}
              onSelectTab={handleSelectEditorTab}
              onCloseTab={handleRequestCloseEditorTab}
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
          <div className="workspace-panel workspace-panel-right">
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
          editorSettings={editorSettings}
          onChangeTheme={setTheme}
          onChangeEditorSettings={setEditorSettings}
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
        open={pendingClosePath !== null}
        title="Unsaved changes"
        confirmLabel="Discard changes"
        submittingLabel="Closing..."
        danger
        onClose={() => setPendingClosePath(null)}
        onConfirm={confirmDiscardAndCloseTab}
      >
        <code>{pendingClosePath?.split("/").pop()}</code>
        {" "}
        has unsaved changes. Closing this tab will discard them.
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteDialog !== null}
        title="Confirm deletion"
        confirmLabel="Delete"
        submittingLabel="Deleting..."
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