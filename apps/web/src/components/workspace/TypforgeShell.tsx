"use client";

import { useEffect, useMemo, useState } from "react";

import { SettingsModal } from "@/components/modals/SettingsModal";
import { UploadZipModal } from "@/components/modals/UploadZipModal";
import { api } from "@/lib/api";
import { findFirstTypFile } from "@/lib/file-tree";
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

export function TypforgeShell() {
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
  const [theme, setTheme] = useState<ThemePreference>("dark");
  const [compiling, setCompiling] = useState(false);
  const [layoutReady, setLayoutReady] = useState(false);

  const {
    defaultLayout,
    onLayoutChanged
  } = useDefaultLayout({
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
  }, [theme]);

  useEffect(() => {
    setLayoutReady(true);
  }, []);

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isSaveShortcut =
        (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";

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

    const message =
      window.prompt("Snapshot message", "Manual snapshot") ?? "Manual snapshot";

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

  if (!layoutReady) {
    return <div className="shell" aria-hidden="true" />;
  }

  return (
    <>
      <Group
        id="typforge-workspace"
        orientation="horizontal"
        className="shell"
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
              onNewFile={handleNewFile}
              onNewFolder={handleNewFolder}
              onUploadZip={() => setUploadOpen(true)}
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
    </>
  );
}