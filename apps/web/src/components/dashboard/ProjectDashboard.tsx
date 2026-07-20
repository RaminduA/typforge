"use client";

import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  FileText,
  Grid3X3,
  List,
  MoreHorizontal,
  Plus,
  Search
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Group,
  Panel,
  Separator
} from "react-resizable-panels";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";

import { SettingsModal } from "@/components/modals/SettingsModal";
import { AccountMenu } from "@/components/workspace/AccountMenu";
import {
  DEFAULT_EDITOR_SETTINGS,
  loadEditorSettings,
  saveEditorSettings,
  type EditorSettings
} from "@/lib/editor-settings";
import {
  DEFAULT_PDF_VIEWER_SETTINGS,
  loadPdfViewerSettings,
  savePdfViewerSettings,
  type PdfViewerSettings
} from "@/lib/pdf-viewer-settings";
import { api } from "@/lib/api";
import { applyTheme, type ThemePreference } from "@/lib/theme";
import type { Project } from "@/types/project";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type DashboardSection = "all" | "yours" | "shared";
type SortDirection = "desc" | "asc";
type SortField = "name" | "createdAt";
type ProjectMenuState = {
  projectId: string;
  top: number;
  left: number;
};

const PROJECT_MENU_WIDTH = 190;

interface ProjectPdfThumbnailProps {
  pdfUrl?: string;
  cachedImageUrl?: string;
  onThumbnailReady?: (imageUrl: string) => void;
}

const ProjectPdfThumbnail = dynamic<ProjectPdfThumbnailProps>(
  () => import("@/components/dashboard/ProjectPdfThumbnail"),
  {
    ssr: false,
    loading: () => (
      <span className="dashboard-project-preview-fallback">
        <FileText size={18} />
      </span>
    )
  }
);

const CONTENT_PANEL_DEFAULT_SIZE = 80;
const CONTENT_PANEL_MIN_SIZE = 70;
const CONTENT_PANEL_MAX_SIZE = 86.5;

const SIDE_PANEL_DEFAULT_SIZE = 100 - CONTENT_PANEL_DEFAULT_SIZE;
const SIDE_PANEL_MIN_SIZE = 100 - CONTENT_PANEL_MAX_SIZE;
const SIDE_PANEL_MAX_SIZE = 100 - CONTENT_PANEL_MIN_SIZE;

function panelPercent(value: number) {
  return `${value}%`;
}

function formatRelativeDate(value: string) {
  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    return "";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.round(diffMs / 60_000));
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);
  const diffMonths = Math.round(diffDays / 30);

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  if (diffDays < 30) {
    return `${diffDays}d`;
  }

  if (diffMonths < 12) {
    return `${diffMonths}mo`;
  }

  return `${Math.round(diffMonths / 12)}y`;
}

function compareProjects(field: SortField, direction: SortDirection) {
  return (a: Project, b: Project) => {
    let result = 0;

    if (field === "name") {
      result = a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
        numeric: true
      });
    } else {
      result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }

    return direction === "asc" ? result : -result;
  };
}

function SortIcon({field, activeField, direction}: {field: SortField; activeField: SortField; direction: SortDirection;}) {
  if (field !== activeField) {
    return <ChevronsUpDown size={13} />;
  }

  return direction === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
}

export function ProjectDashboard() {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeSection, setActiveSection] = useState<DashboardSection>("yours");
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [projectPreviewUrls, setProjectPreviewUrls] = useState<Record<string, string>>({});
  const [projectThumbnailUrls, setProjectThumbnailUrls] = useState<Record<string, string>>({});
  const previewRequestedProjectCacheKeysRef = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(DEFAULT_EDITOR_SETTINGS);
  const [pdfViewerSettings, setPdfViewerSettings] = useState<PdfViewerSettings>(DEFAULT_PDF_VIEWER_SETTINGS);
  const [openProjectMenu, setOpenProjectMenu] = useState<ProjectMenuState | null>(null);
  const [projectActionDialog, setProjectActionDialog] = useState<{
    type: "rename" | "duplicate" | "delete";
    project: Project;
  } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    setEditorSettings(loadEditorSettings());
    setPdfViewerSettings(loadPdfViewerSettings());
  }, []);

  useEffect(() => {
    applyTheme(theme);

    if (theme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemThemeChange() {
      applyTheme("system");
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [theme]);

  useEffect(() => { saveEditorSettings(editorSettings); }, [editorSettings]);
  useEffect(() => { savePdfViewerSettings(pdfViewerSettings); }, [pdfViewerSettings]);
  useEffect(() => { void loadProjects(); }, []);

  function projectThumbnailCacheKey(project: Project) {
    return `typforge:dashboard-thumbnail:${project.id}:${project.updatedAt}`;
  }

  function removeOldProjectThumbnailCache(project: Project, activeKey: string) {
    const prefix = `typforge:dashboard-thumbnail:${project.id}:`;

    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);

      if (key && key.startsWith(prefix) && key !== activeKey) {
        localStorage.removeItem(key);
      }
    }
  }

  function cacheProjectThumbnail(project: Project, imageUrl: string) {
    const cacheKey = projectThumbnailCacheKey(project);

    try {
      localStorage.setItem(cacheKey, imageUrl);
      removeOldProjectThumbnailCache(project, cacheKey);
    } catch {
      // Storage can fail if the browser quota is full.
    }

    setProjectThumbnailUrls((current) => ({...current, [project.id]: imageUrl}));
  }

  useEffect(() => {
    let cancelled = false;

    async function loadProjectPreviews() {
      for (const project of projects) {
        if (cancelled) {
          return;
        }

        const cacheKey = projectThumbnailCacheKey(project);

        try {
          const cachedImageUrl = localStorage.getItem(cacheKey);

          if (cachedImageUrl) {
            setProjectThumbnailUrls((current) => ({...current, [project.id]: cachedImageUrl}));
            continue;
          }
        } catch {
          // Ignore localStorage read errors and fall back to live preview generation.
        }

        if (previewRequestedProjectCacheKeysRef.current.has(cacheKey)) {
          continue;
        }

        previewRequestedProjectCacheKeysRef.current.add(cacheKey);

        try {
          const result = await api.compile(project.id, project.entryFile);

          if (!cancelled && result.ok && result.pdfUrl) {
            const previewUrl = api.absoluteUrl(result.pdfUrl);

            setProjectPreviewUrls((current) => ({...current, [project.id]: previewUrl}));
          }
        } catch {
          // Keep the fallback file preview if this project cannot compile.
        }
      }
    }

    void loadProjectPreviews();

    return () => {
      cancelled = true;
    };
  }, [projects]);

  useEffect(() => {
    if (!openProjectMenu) {
      return;
    }

    function closeProjectMenu() {
      setOpenProjectMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenProjectMenu(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeProjectMenu);
    window.addEventListener("scroll", closeProjectMenu, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeProjectMenu);
      window.removeEventListener("scroll", closeProjectMenu, true);
    };
  }, [openProjectMenu]);

  async function loadProjects() {
    try {
      setLoading(true);
      setError(undefined);

      const result = await api.listProjects();
      setProjects(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load projects");
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    try {
      setCreating(true);

      const project = await api.createProject("Untitled Project");
      router.push(`/projects/${project.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create project");
    } finally {
      setCreating(false);
    }
  }

  function openProject(projectId: string) {
    router.push(`/projects/${projectId}`);
  }

  function handleSort(nextField: SortField) {
    if (sortField === nextField) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(nextField);
    setSortDirection(nextField === "name" ? "asc" : "desc");
  }

  function clampMenuLeft(left: number) {
    return Math.min(Math.max(8, left), window.innerWidth - PROJECT_MENU_WIDTH - 8);
  }

  function openProjectActionsMenu(project: Project, event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const bounds = event.currentTarget.getBoundingClientRect();

    setOpenProjectMenu({
      projectId: project.id,
      top: Math.min(bounds.bottom + 8, window.innerHeight - 12),
      left: clampMenuLeft(bounds.right - PROJECT_MENU_WIDTH)
    });
  }

  function handleProjectRowKeyDown(event: React.KeyboardEvent<HTMLDivElement>, projectId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openProject(projectId);
    }
  }

  function openRenameDialog(project: Project) {
    setOpenProjectMenu(null);
    setRenameDraft(project.name);
    setProjectActionDialog({ type: "rename", project });
  }

  function openDuplicateDialog(project: Project) {
    setOpenProjectMenu(null);
    setProjectActionDialog({ type: "duplicate", project });
  }

  function openDeleteDialog(project: Project) {
    setOpenProjectMenu(null);
    setProjectActionDialog({ type: "delete", project });
  }

  async function confirmRenameProject(project: Project) {
    const nextName = renameDraft.trim();

    if (!nextName) {
      throw new Error("Project name cannot be empty.");
    }

    if (nextName === project.name) {
      return;
    }

    setError(undefined);
    await api.updateProject(project.id, nextName);
    await loadProjects();
  }

  async function confirmDuplicateProject(project: Project) {
    setError(undefined);
    await api.duplicateProject(project.id);
    await loadProjects();
  }

  function clearProjectThumbnailCache(projectId: string) {
    const prefix = `typforge:dashboard-thumbnail:${projectId}:`;

    try {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);

        if (key?.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Ignore localStorage cleanup failures.
    }
  }

  async function confirmDeleteProject(project: Project) {
    setError(undefined);
    await api.deleteProject(project.id);
    clearProjectThumbnailCache(project.id);
    setProjects((current) => current.filter((item) => item.id !== project.id));

    setProjectPreviewUrls((current) => {
      const next = { ...current };
      delete next[project.id];
      return next;
    });

    setProjectThumbnailUrls((current) => {
      const next = { ...current };
      delete next[project.id];
      return next;
    });
  }

  function renderProjectActionsMenu() {
    if (!openProjectMenu || typeof document === "undefined") {
      return null;
    }

    const project = projects.find((item) => item.id === openProjectMenu.projectId);

    if (!project) {
      return null;
    }

    return createPortal(
      <>
        <div
          className="small-popup-interaction-shield dashboard-project-menu-shield"
          onPointerDown={() => setOpenProjectMenu(null)}
        />

        <div
          className="popup-menu dashboard-project-menu is-positioned"
          style={{top: openProjectMenu.top, left: openProjectMenu.left}}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="popup-menu-item"
            onClick={() => openRenameDialog(project)}
          >
            <span>Rename</span>
          </button>

          <button
            type="button"
            className="popup-menu-item"
            onClick={() => openDuplicateDialog(project)}
          >
            <span>Duplicate</span>
          </button>

          <div className="popup-menu-separator" />

          <button
            type="button"
            className="popup-menu-item danger"
            onClick={() => openDeleteDialog(project)}
          >
            <span>Delete</span>
          </button>
        </div>
      </>,
      document.body
    );
  }

  const sidebarItems: Array<{id: DashboardSection;label: string;}> = [
    { id: "all", label: "All Projects" },
    { id: "yours", label: "Your Projects" },
    { id: "shared", label: "Shared with you" }
  ];

  const activeSectionLabel = sidebarItems.find((item) => item.id === activeSection)?.label ?? "Your Projects";

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const visibleProjects = activeSection === "shared" ? [] : projects;

    return visibleProjects
      .filter((project) => {
        if (!normalizedQuery) {
          return true;
        }

        return project.name.toLowerCase().includes(normalizedQuery);
      })
      .slice()
      .sort(compareProjects(sortField, sortDirection));
  }, [activeSection, projects, query, sortField, sortDirection]);

  function renderProjectActionDialog() {
    if (!projectActionDialog) {
      return null;
    }

    const { type, project } = projectActionDialog;

    if (type === "rename") {
      return (
        <ConfirmDialog
          open
          title="Rename project"
          confirmLabel="Rename"
          submittingLabel="Renaming..."
          onClose={() => setProjectActionDialog(null)}
          onConfirm={() => confirmRenameProject(project)}
        >
          <input
            className="action-dialog-input"
            value={renameDraft}
            autoFocus
            placeholder="Project name"
            onChange={(event) => setRenameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void confirmRenameProject(project).then(() => {
                  setProjectActionDialog(null);
                });
              }
            }}
          />
        </ConfirmDialog>
      );
    }

    if (type === "duplicate") {
      return (
        <ConfirmDialog
          open
          title="Duplicate project"
          confirmLabel="Duplicate"
          submittingLabel="Duplicating..."
          onClose={() => setProjectActionDialog(null)}
          onConfirm={() => confirmDuplicateProject(project)}
        >
          <p>
            Create a copy of <code>{project.name}</code>?
          </p>
        </ConfirmDialog>
      );
    }

    return (
      <ConfirmDialog
        open
        title="Delete project"
        confirmLabel="Delete"
        submittingLabel="Deleting..."
        danger
        onClose={() => setProjectActionDialog(null)}
        onConfirm={() => confirmDeleteProject(project)}
      >
        <p>
          Delete <code>{project.name}</code>? This action cannot be undone.
        </p>
      </ConfirmDialog>
    );
  }

  return (
    <>
        <main className={settingsOpen ? "dashboard-page dashboard-page-blurred" : "dashboard-page"}>
        <Group
            id="typforge-dashboard"
            orientation="horizontal"
            className="dashboard-outer-box"
        >
            <Panel
            id="dashboard-sidebar-panel"
            defaultSize={panelPercent(SIDE_PANEL_DEFAULT_SIZE)}
            minSize={panelPercent(SIDE_PANEL_MIN_SIZE)}
            maxSize={panelPercent(SIDE_PANEL_MAX_SIZE)}
            >
            <aside className="sidebar dashboard-sidebar">
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

                <nav className="dashboard-sidebar-menu" aria-label="Project sections">
                {sidebarItems.map((item) => (
                    <button
                    key={item.id}
                    type="button"
                    className={
                        activeSection === item.id
                        ? "dashboard-sidebar-menu-item dashboard-sidebar-menu-item-active"
                        : "dashboard-sidebar-menu-item"
                    }
                    onClick={() => setActiveSection(item.id)}
                    >
                    {item.label}
                    </button>
                ))}
                </nav>

                <div className="sidebar-footer">
                <AccountMenu onOpenSettings={() => setSettingsOpen(true)} />
                </div>
            </aside>
            </Panel>

            <Separator
            id="dashboard-sidebar-content-separator"
            className="workspace-resize-handle dashboard-resize-handle"
            />

            <Panel
            id="dashboard-content-panel"
            defaultSize={panelPercent(CONTENT_PANEL_DEFAULT_SIZE)}
            minSize={panelPercent(CONTENT_PANEL_MIN_SIZE)}
            maxSize={panelPercent(CONTENT_PANEL_MAX_SIZE)}
            >
                <section className="dashboard-inner-box">
                    <header className="dashboard-header">
                    <h1>{activeSectionLabel}</h1>

                    <div className="dashboard-actions">
                        <label className="dashboard-search">
                        <Search size={18} />
                        <input
                            value={query}
                            placeholder="Search"
                            onChange={(event) => setQuery(event.target.value)}
                        />
                        </label>

                        <div className="dashboard-view-toggle" aria-label="View mode">
                        <button
                            type="button"
                            className="dashboard-view-button dashboard-view-button-active"
                            aria-label="List view"
                        >
                            <List size={18} />
                        </button>

                        <button
                            type="button"
                            className="dashboard-view-button"
                            aria-label="Grid view"
                            title="Grid view will be added later"
                        >
                            <Grid3X3 size={17} />
                        </button>
                        </div>

                        <button
                        type="button"
                        className="dashboard-secondary-button"
                        disabled
                        title="Import from dashboard will be added later"
                        >
                        Import
                        <ChevronDown size={16} />
                        </button>

                        <button
                        type="button"
                        className="dashboard-primary-button"
                        onClick={createProject}
                        disabled={creating}
                        >
                        <Plus size={18} />
                        {creating ? "Creating..." : "New"}
                        <ChevronDown size={16} />
                        </button>
                    </div>
                    </header>

                    <div className="dashboard-table">
                    <div className="dashboard-table-head">
                        <button
                            type="button"
                            className="dashboard-table-heading"
                            onClick={() => handleSort("name")}
                        >
                            Name
                            <SortIcon
                                field="name"
                                activeField={sortField}
                                direction={sortDirection}
                            />
                        </button>

                        <button
                            type="button"
                            className="dashboard-table-heading dashboard-created-heading"
                            onClick={() => handleSort("createdAt")}
                        >
                            Created
                            <SortIcon
                                field="createdAt"
                                activeField={sortField}
                                direction={sortDirection}
                            />
                        </button>
                    </div>

                    {loading ? (
                        <div className="dashboard-empty-state">
                        Loading projects...
                        </div>
                    ) : error ? (
                        <div className="dashboard-empty-state dashboard-error-state">
                        {error}
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="dashboard-empty-state">
                        {activeSection === "shared"
                            ? "Shared projects will appear here later."
                            : query.trim()
                            ? "No projects match your search."
                            : "No projects yet. Create your first Typforge project."}
                        </div>
                    ) : (
                        <div className="dashboard-project-list">
                        {filteredProjects.map((project) => (
                          <div
                            key={project.id}
                            role="button"
                            tabIndex={0}
                            className="dashboard-project-row"
                            onClick={() => openProject(project.id)}
                            onKeyDown={(event) => handleProjectRowKeyDown(event, project.id)}
                          >
                            <span className="dashboard-project-preview" aria-hidden="true">
                              <ProjectPdfThumbnail
                                pdfUrl={projectPreviewUrls[project.id]}
                                cachedImageUrl={projectThumbnailUrls[project.id]}
                                onThumbnailReady={(imageUrl: string) => cacheProjectThumbnail(project, imageUrl)}
                              />
                            </span>

                            <span className="dashboard-project-name">
                              {project.name}
                            </span>

                            <span className="dashboard-project-created">
                              {formatRelativeDate(project.createdAt)}
                            </span>

                            <button
                              type="button"
                              className="dashboard-project-more"
                              aria-label={`More actions for ${project.name}`}
                              aria-expanded={openProjectMenu?.projectId === project.id}
                              onClick={(event) => openProjectActionsMenu(project, event)}
                            >
                              <MoreHorizontal size={17} />
                            </button>
                          </div>
                        ))}
                        </div>
                    )}
                    </div>
                </section>
            </Panel>
        </Group>
        </main>

        {renderProjectActionsMenu()}
        {renderProjectActionDialog()}

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
    </>
  );
}