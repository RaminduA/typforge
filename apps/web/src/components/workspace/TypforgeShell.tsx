"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useRouter } from "next/navigation";

import { SettingsModal } from "@/components/modals/SettingsModal";
import { UploadZipModal } from "@/components/modals/UploadZipModal";
import { ApiRequestError, api } from "@/lib/api";
import { findFirstTypFile, isSameOrChildPath, joinProjectPath } from "@/lib/file-tree";
import {
  applyTheme,
  loadThemePreference,
  saveThemePreference,
  type ThemePreference
} from "@/lib/theme";
import {
  DEFAULT_PDF_VIEWER_SETTINGS,
  loadPdfViewerSettings,
  savePdfViewerSettings,
  type PdfViewerSettings
} from "@/lib/pdf-viewer-settings";
import type { CompileResult, CompileStatus } from "@/types/build";
import type { FileNode, Project, VersionSnapshot } from "@/types/project";
import { EditorPane } from "./EditorPane";
import { LeftSidebar } from "./LeftSidebar";
import { MobileFileBrowser } from "./MobileFileBrowser";
import { PdfPreviewPane } from "./PdfPreviewPane";
import { ToolTab, ToolsPanel } from "./ToolsPanel";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MessageDialog } from "@/components/ui/MessageDialog";
import { TextInputDialog } from "@/components/ui/TextInputDialog";
import {
  DEFAULT_EDITOR_SETTINGS,
  loadEditorSettings,
  saveEditorSettings,
  type EditorSettings
} from "@/lib/editor-settings";
import {
  clearEditorSession,
  loadEditorSession,
  saveEditorSession
} from "@/lib/editor-session";
import type { OpenEditorFile } from "@/types/editor";

interface CompiledPdfVersion {
  buildId: string;
  pdfUrl: string;
  downloadUrl?: string;
}

interface CompiledPdfHistory {
  entries: CompiledPdfVersion[];
  index: number;
}

const MAIN_AREA_DEFAULT_SIZE = 80.5;
const MAIN_AREA_MIN_SIZE = 70;
const MAIN_AREA_MAX_SIZE = 87;

const RIGHT_PANEL_DEFAULT_SIZE = 40.5;
const RIGHT_PANEL_MIN_SIZE = 20.5;
const RIGHT_PANEL_MAX_SIZE = 81;

const LEFT_PANEL_DEFAULT_SIZE = 100 - MAIN_AREA_DEFAULT_SIZE;
const LEFT_PANEL_MIN_SIZE = 100 - MAIN_AREA_MAX_SIZE;
const LEFT_PANEL_MAX_SIZE = 100 - MAIN_AREA_MIN_SIZE;

const EDITOR_PANEL_DEFAULT_SIZE = 100 - RIGHT_PANEL_DEFAULT_SIZE;
const EDITOR_PANEL_MIN_SIZE = 100 - RIGHT_PANEL_MAX_SIZE;
const EDITOR_PANEL_MAX_SIZE = 100 - RIGHT_PANEL_MIN_SIZE;

function panelPercent(value: number) {
  return `${value}%`;
}

function diagnosticsToLogText(result: CompileResult) {
  return (
    result.diagnostics
      ?.map((diagnostic) => `${diagnostic.severity}: ${diagnostic.message}`)
      .filter(Boolean).join("\n") ?? ""
  );
}

type MobileWorkspaceTab = "files" | "editor" | "preview";

interface TypforgeShellProps {
  projectId: string;
}

export function TypforgeShell({ projectId }: TypforgeShellProps) {
  const router = useRouter();

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
  const [pdfHistory, setPdfHistory] = useState<CompiledPdfHistory>({entries: [],index: -1});
  const [logs, setLogs] = useState("");
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolTab>("info");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [compiling, setCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState<CompileStatus>("idle");
  const [layoutReady, setLayoutReady] = useState(false);
  const [editorSessionReady, setEditorSessionReady] = useState(false);
  const [textDialog, setTextDialog] = useState<TextDialogState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [messageDialog, setMessageDialog] = useState<MessageState | null>(null);
  const [pendingClosePath, setPendingClosePath] = useState<string | null>(null);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(DEFAULT_EDITOR_SETTINGS);
  const [pdfViewerSettings, setPdfViewerSettings] = useState<PdfViewerSettings>(DEFAULT_PDF_VIEWER_SETTINGS);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileWorkspaceTab>("editor");
  const [mobileFilePickerOpen, setMobileFilePickerOpen] = useState(false);
  const [mobileFileActionsOpen, setMobileFileActionsOpen] = useState(false);
  const compileInFlightRef = useRef(false);

  const fullScreenModalOpen =
    settingsOpen ||
    uploadOpen ||
    textDialog !== null ||
    deleteDialog !== null ||
    messageDialog !== null ||
    pendingClosePath !== null ||
    mobileFilePickerOpen ||
    mobileFileActionsOpen;

  const selectedPdfVersion = pdfHistory.index >= 0 ? pdfHistory.entries[pdfHistory.index] : undefined;

  const pdfUrl = selectedPdfVersion?.pdfUrl;
  const downloadUrl = selectedPdfVersion?.downloadUrl;

  const canShowPreviousCompile = pdfHistory.index > 0;
  const canShowNextCompile = pdfHistory.index >= 0 && pdfHistory.index < pdfHistory.entries.length - 1;

  const activeFile = useMemo(() => openFiles.find((file) => file.path === activePath),[openFiles, activePath]);
  const content = activeFile?.content ?? "";
  const editorDirty = Boolean(activeFile && activeFile.content !== activeFile.savedContent);
  const hasDirtyFiles = useMemo(() => openFiles.some((file) => file.content !== file.savedContent),[openFiles]);
  const openPathSignature = useMemo(() => openFiles.map((file) => file.path).join("\n"), [openFiles]);

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
    const mobileQuery = window.matchMedia("(max-width: 768px)");

    setTheme(loadThemePreference());
    setEditorSettings(loadEditorSettings());
    setPdfViewerSettings(loadPdfViewerSettings());
    setIsMobile(mobileQuery.matches);
    setLayoutReady(true);
  }, []);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 768px)");

    function handleMobileChange(event: MediaQueryListEvent) {
      setIsMobile(event.matches);

      if (!event.matches) {
        setMobileFilePickerOpen(false);
        setMobileFileActionsOpen(false);
      }
    }

    mobileQuery.addEventListener("change", handleMobileChange);

    return () => {
      mobileQuery.removeEventListener("change", handleMobileChange);
    };
  }, []);

  useEffect(() => {
    if (!layoutReady) {
      return;
    }

    saveThemePreference(theme);
  }, [layoutReady, theme]);

  useEffect(() => {
    if (!layoutReady) {
      return;
    }

    saveEditorSettings(editorSettings);
  }, [editorSettings, layoutReady]);

  useEffect(() => {
    if (!layoutReady) {
      return;
    }

    savePdfViewerSettings(pdfViewerSettings);
  }, [layoutReady, pdfViewerSettings]);

  useEffect(() => {
    if (!editorSessionReady || !project) {
      return;
    }

    const openPaths = openFiles.map((file) => file.path);

    saveEditorSession(project.id, {openPaths,activePath: activePath && openPaths.includes(activePath) ? activePath : undefined});
  }, [activePath,editorSessionReady,openPathSignature,project]);

  useEffect(() => { void bootstrap(projectId);}, [projectId]);

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

  useEffect(() => {
    function handleEditorPinch(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const editor = target.closest(".codemirror-wrap");

      if (!editor) {
        return;
      }

      const scroller = editor.querySelector<HTMLElement>(".cm-scroller");

      if (!scroller) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      scroller.scrollBy({top: event.deltaY * 1.8, left: event.deltaX * 1.35, behavior: "auto"});
    }

    window.addEventListener("wheel", handleEditorPinch, {
      capture: true,
      passive: false
    });

    return () => {
      window.removeEventListener("wheel", handleEditorPinch, true);
    };
  }, []);

  async function restoreEditorTabs(
    projectId: string,
    loadedTree: FileNode
  ) {
    const session = loadEditorSession(projectId);
    
    if (session === undefined) {
      const firstTyp = findFirstTypFile(loadedTree);

      if (firstTyp) {
        const file = await api.getFile(projectId, firstTyp.path);

        setOpenFiles([{ path: firstTyp.path, content: file.content, savedContent: file.content }]);

        setActivePath(firstTyp.path);
      } else {
        setOpenFiles([]);
        setActivePath(undefined);
      }

      setEditorSessionReady(true);
      return;
    }

    const restoredFiles = (
      await Promise.all(session.openPaths.map(async (path) => {
          try {
            const file = await api.getFile(projectId, path);
            return {path,content: file.content,savedContent: file.content} satisfies OpenEditorFile;
          } catch {
            return null;
          }
        })
      )
    ).filter((file): file is OpenEditorFile => file !== null);

    const restoredPaths = restoredFiles.map((file) => file.path);

    const restoredActivePath = session.activePath && restoredPaths.includes(session.activePath) ? session.activePath : restoredFiles.at(-1)?.path;

    setOpenFiles(restoredFiles);
    setActivePath(restoredActivePath);
    setEditorSessionReady(true);
  }

  async function bootstrap(targetProjectId: string) {
    try {
      setProject(undefined);
      setTree(undefined);
      setOpenFiles([]);
      setActivePath(undefined);
      setPdfHistory({ entries: [], index: -1 });
      setLogs("");
      setVersions([]);
      setCompileStatus("idle");
      setEditorSessionReady(false);

      const selected = await api.getProject(targetProjectId);

      setProject(selected);

      const loadedTree = await api.getTree(selected.id);
      setTree(loadedTree);

      await restoreEditorTabs(selected.id, loadedTree);

      await refreshVersions(selected.id);
      await compileProject(selected, false);
    } catch (error) {
      setMessageDialog({
        title: "Project not found",
        message: error instanceof Error ? error.message : "The selected project could not be opened."
      });

      router.replace("/");
    }
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
        return current.map((openFile) => openFile.path === path? { path, content: file.content, savedContent: file.content }: openFile);
      }

      return [...current, { path, content: file.content, savedContent: file.content }];
    });

    setActivePath(path);
  }

  async function handleOpenFile(path: string) {
    if (!project) return;
    await openFile(project.id, path);
  }

  async function handleMobileOpenFile(path: string) {
    await handleOpenFile(path);
    setMobileTab("editor");
    setMobileFilePickerOpen(false);
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
      setCompileStatus("compiling");

      const fileToSave = saveBeforeCompile ? activeFile : undefined;

      let saveCompleted = !fileToSave;

      try {
        if (fileToSave) {
          await api.updateFile(targetProject.id, fileToSave.path, fileToSave.content);
          saveCompleted = true;
          setOpenFiles((current) => current.map((file) => file.path === fileToSave.path ? { ...file, savedContent: fileToSave.content } : file));
        }

        const result:CompileResult = await api.compile(targetProject.id, targetProject.entryFile);

        const fallbackLogs = diagnosticsToLogText(result);

        let compilerLogs = fallbackLogs;

        if (result.buildId) {
          try {
            const fetchedLogs = await api.getLogs(result.buildId);

            console.log("[Typforge compile result]", result);
            console.log("[Typforge fetched compiler logs]", fetchedLogs);

            compilerLogs =
              fetchedLogs ||
              fallbackLogs ||
              "Compile finished, but no compiler logs were returned.";
          } catch (logError) {
            compilerLogs =
              logError instanceof Error
                ? `Unable to fetch compiler logs for ${result.buildId}:\n${logError.message}\n\nFallback diagnostics:\n${fallbackLogs}`
                : `Unable to fetch compiler logs for ${result.buildId}.\n\nFallback diagnostics:\n${fallbackLogs}`;
          }
        }

        setLogs(compilerLogs);

        if (result.ok) {
          setCompileStatus("compiled");

          if (result.pdfUrl) {
            const revision = Date.now();

            const nextVersion: CompiledPdfVersion = {
              buildId: result.buildId,
              pdfUrl: `${api.absoluteUrl(result.pdfUrl)}?revision=${revision}`,
              downloadUrl: result.downloadUrl ? api.absoluteUrl(result.downloadUrl) : undefined
            };

            setPdfHistory((current) => {
              const entries = [...current.entries, nextVersion].slice(-50);
              return {entries, index: entries.length - 1};
            });
          }
        } else {
          setCompileStatus("failed");
          setToolsOpen(true);
          setActiveTool("logs");
        }

        return true;
      } catch (error) {
        setCompileStatus("failed");

        if (error instanceof ApiRequestError && error.logs) {
          setLogs(error.logs);
        } else if (error instanceof Error) {
          setLogs(error.message);
        } else {
          setLogs("Compile failed");
        }

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
    async () => {await compileProject(project, true);},[compileProject, project]
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

  function handleShowPreviousCompile() {
    setPdfHistory((current) => {
      if (current.index <= 0) {
        return current;
      }

      return {...current, index: current.index - 1};
    });

    setCompileStatus("compiled");
  }

  function handleShowNextCompile() {
    setPdfHistory((current) => {
      if (current.index < 0 || current.index >= current.entries.length - 1) {
        return current;
      }

      return {...current, index: current.index + 1};
    });

    setCompileStatus("compiled");
  }

  async function handleCompile() {
    await saveAndCompileCurrent();
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

    const entries = files.map((file) => ({file, path: joinProjectPath(parentPath, file.name)}));

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
        (file) => ({file, path: joinProjectPath(parentPath, file.webkitRelativePath || file.name)})
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
      title:"Share and collaborate",
      message:"Collaboration will become available after authentication and shared projects are implemented."
    });
  }

  function handleRenameProject() {
    setTextDialog({type: "rename-project"});
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

      setOpenFiles(current => current.map((file) => isSameOrChildPath(file.path, node.path)
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
      clearEditorSession(project.id);

      await api.deleteProject(project.id);

      router.replace("/");

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
      {isMobile ? (
        <section
          className={fullScreenModalOpen ? "mobile-workspace shell-modal-blurred" : "mobile-workspace"}
        >
          <header className="mobile-workspace-header">
            <button
              type="button"
              className="mobile-workspace-brand"
              aria-label="Back to projects"
              onClick={() => router.push("/")}
            >
              T
            </button>

            <h1>{project?.name ?? "Loading project..."}</h1>

            <button
              type="button"
              className="mobile-workspace-share"
              onClick={handleShareProject}
            >
              Share
            </button>
          </header>

          <nav className="mobile-workspace-tabs" aria-label="Workspace sections">
            {(["files", "editor", "preview"] as MobileWorkspaceTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={mobileTab === tab ? "mobile-workspace-tab active" : "mobile-workspace-tab"}
                aria-selected={mobileTab === tab}
                onClick={() => setMobileTab(tab)}
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>

          <div className={`mobile-workspace-body mobile-workspace-body-${mobileTab}`}>
            {mobileTab === "files" ? (
              <MobileFileBrowser
                variant="page"
                project={project}
                tree={tree}
                activePath={activePath}
                onOpenFile={handleMobileOpenFile}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onUploadFiles={handleUploadFiles}
                onUploadFolder={handleUploadFolder}
                onRenameEntry={handleRenameEntry}
                onDeleteEntry={handleDeleteEntry}
                onDownloadFile={handleDownloadFile}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            ) : null}

            {mobileTab === "editor" ? (
              <EditorPane
                variant="mobile"
                openFiles={openFiles}
                activePath={activePath}
                content={content}
                fontSize={editorSettings.fontSize}
                toolsOpen={false}
                onChange={handleEditorChange}
                onSelectTab={handleSelectEditorTab}
                onCloseTab={handleRequestCloseEditorTab}
                onOpenTools={() => undefined}
                onOpenMobileFilePicker={() => setMobileFilePickerOpen(true)}
                onOpenMobileFileActions={() => setMobileFileActionsOpen(true)}
              />
            ) : null}

            {mobileTab === "preview" ? (
              <div className="mobile-preview-pane">
                <PdfPreviewPane
                  mobile
                  pdfUrl={pdfUrl}
                  downloadUrl={downloadUrl}
                  compileStatus={compileStatus}
                  settings={pdfViewerSettings}
                  canShowPreviousCompile={canShowPreviousCompile}
                  canShowNextCompile={canShowNextCompile}
                  onCompile={handleCompile}
                  onShowPreviousCompile={handleShowPreviousCompile}
                  onShowNextCompile={handleShowNextCompile}
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <Group
          id="typforge-workspace-outer"
          orientation="horizontal"
          className={fullScreenModalOpen ? "shell shell-modal-blurred" : "shell"}
        >
          <Panel
            id="file-sidebar"
            defaultSize={panelPercent(LEFT_PANEL_DEFAULT_SIZE)}
            minSize={panelPercent(LEFT_PANEL_MIN_SIZE)}
            maxSize={panelPercent(LEFT_PANEL_MAX_SIZE)}
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
            id="workspace-main-area"
            defaultSize={panelPercent(MAIN_AREA_DEFAULT_SIZE)}
            minSize={panelPercent(MAIN_AREA_MIN_SIZE)}
            maxSize={panelPercent(MAIN_AREA_MAX_SIZE)}
          >
            <div className="workspace-panel workspace-panel-main">
              <Group
                id="typforge-workspace-inner"
                orientation="horizontal"
                className="workspace-inner-group"
              >
                <Panel
                  id="typst-editor"
                  defaultSize={panelPercent(EDITOR_PANEL_DEFAULT_SIZE)}
                  minSize={panelPercent(EDITOR_PANEL_MIN_SIZE)}
                  maxSize={panelPercent(EDITOR_PANEL_MAX_SIZE)}
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
                  defaultSize={panelPercent(RIGHT_PANEL_DEFAULT_SIZE)}
                  minSize={panelPercent(RIGHT_PANEL_MIN_SIZE)}
                  maxSize={panelPercent(RIGHT_PANEL_MAX_SIZE)}
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
                        compileStatus={compileStatus}
                        settings={pdfViewerSettings}
                        canShowPreviousCompile={canShowPreviousCompile}
                        canShowNextCompile={canShowNextCompile}
                        onCompile={handleCompile}
                        onShowPreviousCompile={handleShowPreviousCompile}
                        onShowNextCompile={handleShowNextCompile}
                      />
                    )}
                  </div>
                </Panel>
              </Group>
            </div>
          </Panel>
        </Group>
      )}

      {isMobile && mobileFilePickerOpen ? (
        <div
          className="mobile-bottom-sheet-layer"
          role="presentation"
          onPointerDown={() => setMobileFilePickerOpen(false)}
        >
          <div
            className="mobile-file-picker-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Project files"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <MobileFileBrowser
              variant="sheet"
              project={project}
              tree={tree}
              activePath={activePath}
              onOpenFile={handleMobileOpenFile}
              onCreateFile={(parentPath) => {
                setMobileFilePickerOpen(false);
                handleCreateFile(parentPath);
              }}
              onCreateFolder={(parentPath) => {
                setMobileFilePickerOpen(false);
                handleCreateFolder(parentPath);
              }}
              onUploadFiles={handleUploadFiles}
              onUploadFolder={handleUploadFolder}
              onRenameEntry={(node) => {
                setMobileFilePickerOpen(false);
                handleRenameEntry(node);
              }}
              onDeleteEntry={(node) => {
                setMobileFilePickerOpen(false);
                handleDeleteEntry(node);
              }}
              onDownloadFile={handleDownloadFile}
              onCloseSheet={() => setMobileFilePickerOpen(false)}
              onOpenFileActions={() => {
                setMobileFilePickerOpen(false);
                setMobileFileActionsOpen(true);
              }}
            />
          </div>
        </div>
      ) : null}

      {isMobile && mobileFileActionsOpen && activePath ? (
        <div
          className="mobile-bottom-sheet-layer"
          role="presentation"
          onPointerDown={() => setMobileFileActionsOpen(false)}
        >
          <div
            className="mobile-file-actions-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="File actions"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setMobileFileActionsOpen(false);
                handleRenameEntry({
                  name: activePath.split("/").pop() ?? activePath,
                  path: activePath,
                  type: "file"
                });
              }}
            >
              Rename file
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileFileActionsOpen(false);
                handleDownloadFile(activePath);
              }}
            >
              Download file
            </button>

            <button
              type="button"
              className="danger"
              onClick={() => {
                setMobileFileActionsOpen(false);
                handleDeleteEntry({
                  name: activePath.split("/").pop() ?? activePath,
                  path: activePath,
                  type: "file"
                });
              }}
            >
              Delete file
            </button>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <SettingsModal
          theme={theme}
          editorSettings={editorSettings}
          pdfViewerSettings={pdfViewerSettings}
          onChangeTheme={setTheme}
          onChangeEditorSettings={setEditorSettings}
          onChangePdfViewerSettings={setPdfViewerSettings}
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