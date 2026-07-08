"use client";

import { useEffect, useMemo, useState } from "react";

import { api } from "@/lib/api";
import { findFirstTypFile } from "@/lib/file-tree";
import { applyTheme, type ThemePreference } from "@/lib/theme";
import type { CompileResult } from "@/types/build";
import type { FileNode, Project, VersionSnapshot } from "@/types/project";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { UploadZipModal } from "@/components/modals/UploadZipModal";
import { EditorPane } from "./EditorPane";
import { LeftSidebar } from "./LeftSidebar";
import { PdfPreviewPane } from "./PdfPreviewPane";
import { ToolTab, ToolsPanel } from "./ToolsPanel";

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
    void bootstrap();
  }, []);

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

  async function handleSave() {
    if (!project || !activePath) return;
    await api.updateFile(project.id, activePath, content);
    await refreshTree(project.id);
  }

  async function handleCompile() {
    if (!project) return;

    setCompiling(true);

    try {
      if (activePath) {
        await api.updateFile(project.id, activePath, content);
      }

      const result: CompileResult = await api.compile(project.id, project.entryFile);
      setLogs(result.diagnostics?.map((d) => `${d.severity}: ${d.message}`).join("\n") ?? "");

      if (result.logsUrl) {
        const logResult = await api.getLogs(result.buildId);
        setLogs(logResult.logs);
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
  }

  return (
    <>
      <div className="shell">
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

        <EditorPane
          activePath={activePath}
          content={content}
          onChange={setContent}
          onSave={handleSave}
          onOpenTools={() => setToolsOpen((value) => !value)}
        />

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

      {settingsOpen ? (
        <SettingsModal
          theme={theme}
          onChangeTheme={setTheme}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {uploadOpen ? (
        <UploadZipModal onUpload={handleUploadZip} onClose={() => setUploadOpen(false)} />
      ) : null}
    </>
  );
}