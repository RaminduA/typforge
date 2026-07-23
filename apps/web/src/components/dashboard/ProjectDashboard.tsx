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
type DashboardViewMode = "list" | "grid";
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
  width?: number;
  fallbackIconSize?: number;
  onThumbnailReady?: (imageUrl: string) => void;
}

interface DashboardTooltipState {
  text: string;
  top: number;
  left: number;
  placement: "above" | "below";
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

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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
  const [viewMode, setViewMode] = useState<DashboardViewMode>("list");
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
  const dashboardRootRef = useRef<HTMLElement>(null);
  const mobileSearchButtonRef = useRef<HTMLButtonElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchContainerRef = useRef<HTMLLabelElement>(null);
  const [dashboardTooltip, setDashboardTooltip] = useState<DashboardTooltipState | null>(null);
  const [mobileSectionMenuOpen, setMobileSectionMenuOpen] = useState(false);
  const [mobileCreateMenuOpen, setMobileCreateMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);

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

  useEffect(() => {
    if (!mobileSearchOpen) {
      return;
    }

    mobileSearchInputRef.current?.focus();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        mobileSearchButtonRef.current?.contains(target) ||
        mobileSearchContainerRef.current?.contains(target)
      ) {
        return;
      }

      setMobileSearchOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [mobileSearchOpen]);

  useEffect(() => {
    function handleMobileEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setMobileSectionMenuOpen(false);
      setMobileCreateMenuOpen(false);
      setMobileAccountOpen(false);
      setMobileSearchOpen(false);
    }

    window.addEventListener("keydown", handleMobileEscape);

    return () => {
      window.removeEventListener("keydown", handleMobileEscape);
    };
  }, []);

  function projectThumbnailCacheKey(project: Project) {
    return `typforge:dashboard-thumbnail:${project.id}:v2:${project.updatedAt}`;
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

  useEffect(() => {
    const root = dashboardRootRef.current;

    if (!root) {
      return;
    }

    const rootElement: HTMLElement = root;

    function showTooltipForElement(element: HTMLElement) {
      const text = element.dataset.tooltip;

      if (!text) {
        return;
      }

      const bounds = element.getBoundingClientRect();
      const estimatedWidth = Math.min(240, Math.max(90, text.length * 7.2));

      const left = clampNumber(
        bounds.left + bounds.width / 2,
        estimatedWidth / 2 + 8,
        window.innerWidth - estimatedWidth / 2 - 8
      );

      const hasSpaceBelow = bounds.bottom + 42 < window.innerHeight;

      setDashboardTooltip({
        text,
        left,
        top: hasSpaceBelow ? bounds.bottom + 8 : bounds.top - 8,
        placement: hasSpaceBelow ? "below" : "above"
      });
    }

    function handlePointerOver(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const tooltipElement = target.closest<HTMLElement>("[data-tooltip]");

      if (
        !tooltipElement ||
        !rootElement.contains(tooltipElement) ||
        tooltipElement.closest(".popup-menu") ||
        tooltipElement.closest(".account-menu-panel")
      ) {
        return;
      }

      showTooltipForElement(tooltipElement);
    }

    function handlePointerOut(event: PointerEvent) {
      const target = event.target;
      const relatedTarget = event.relatedTarget;

      if (!(target instanceof Element)) {
        return;
      }

      const tooltipElement = target.closest<HTMLElement>("[data-tooltip]");

      if (!tooltipElement) {
        return;
      }

      if (relatedTarget instanceof Node && tooltipElement.contains(relatedTarget)) {
        return;
      }

      setDashboardTooltip(null);
    }

    function handleFocusIn(event: FocusEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const tooltipElement = target.closest<HTMLElement>("[data-tooltip]");

      if (tooltipElement && rootElement.contains(tooltipElement)) {
        showTooltipForElement(tooltipElement);
      }
    }

    function handleFocusOut() {
      setDashboardTooltip(null);
    }

    rootElement.addEventListener("pointerover", handlePointerOver);
    rootElement.addEventListener("pointerout", handlePointerOut);
    rootElement.addEventListener("focusin", handleFocusIn);
    rootElement.addEventListener("focusout", handleFocusOut);

    return () => {
      rootElement.removeEventListener("pointerover", handlePointerOver);
      rootElement.removeEventListener("pointerout", handlePointerOut);
      rootElement.removeEventListener("focusin", handleFocusIn);
      rootElement.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

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

  async function createProject(name = "Untitled Project") {
    try {
      setCreating(true);

      const project = await api.createProject(name);
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
    const viewportGap = 12;
    const menuGap = 7;
    const estimatedMenuHeight = 132;
    const preferredTop = bounds.bottom + menuGap;
    const top = preferredTop + estimatedMenuHeight <= window.innerHeight - viewportGap
      ? preferredTop
      : Math.max(viewportGap, bounds.top - estimatedMenuHeight - menuGap);

    setOpenProjectMenu({
      projectId: project.id,
      top,
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
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpenProjectMenu(null);
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
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
          className="dashboard-project-action-dialog is-rename"
          backdropClassName="dashboard-project-action-backdrop"
          title={
            <>
              <span className="dashboard-dialog-desktop-copy">Rename project</span>
              <span className="dashboard-dialog-mobile-copy">Edit project name</span>
            </>
          }
          confirmLabel={
            <>
              <span className="dashboard-dialog-desktop-copy">Rename</span>
              <span className="dashboard-dialog-mobile-copy">Save</span>
            </>
          }
          submittingLabel="Saving..."
          onClose={() => setProjectActionDialog(null)}
          onConfirm={() => confirmRenameProject(project)}
        >
          <p className="dashboard-dialog-mobile-copy dashboard-project-action-message">
            Enter a new name for your project.
          </p>

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
          className="dashboard-project-action-dialog is-duplicate"
          backdropClassName="dashboard-project-action-backdrop"
          title={
            <>
              <span className="dashboard-dialog-desktop-copy">Duplicate project</span>
              <span className="dashboard-dialog-mobile-copy">Confirm duplication</span>
            </>
          }
          confirmLabel="Duplicate"
          submittingLabel="Duplicating..."
          onClose={() => setProjectActionDialog(null)}
          onConfirm={() => confirmDuplicateProject(project)}
        >
          <p className="dashboard-dialog-desktop-copy">
            Create a copy of <code>{project.name}</code>?
          </p>
          <p className="dashboard-dialog-mobile-copy dashboard-project-action-message">
            Are you sure you want to duplicate this project?
          </p>
        </ConfirmDialog>
      );
    }

    return (
      <ConfirmDialog
        open
        className="dashboard-project-action-dialog is-delete"
        backdropClassName="dashboard-project-action-backdrop"
        title={
          <>
            <span className="dashboard-dialog-desktop-copy">Delete project</span>
            <span className="dashboard-dialog-mobile-copy">Confirm deletion</span>
          </>
        }
        confirmLabel="Delete"
        submittingLabel="Deleting..."
        danger
        onClose={() => setProjectActionDialog(null)}
        onConfirm={() => confirmDeleteProject(project)}
      >
        <p className="dashboard-dialog-desktop-copy">
          Delete <code>{project.name}</code>? This action cannot be undone.
        </p>
        <p className="dashboard-dialog-mobile-copy dashboard-project-action-message">
          Are you sure you want to delete this project?
        </p>
      </ConfirmDialog>
    );
  }

  return (
    <>
        <main
            ref={dashboardRootRef}
            className={[
              "dashboard-page",
              settingsOpen ? "dashboard-page-blurred" : "",
              projectActionDialog ? "dashboard-page-mobile-action-blurred" : ""
            ].filter(Boolean).join(" ")}
        >
        <section className="mobile-dashboard-view">
          <header className="mobile-dashboard-account-bar">
            <span className="mobile-dashboard-brand" aria-label="Typforge">
              T
            </span>

            <div className="mobile-dashboard-account-wrap">
              <button
                type="button"
                className="mobile-dashboard-account-trigger"
                aria-haspopup="menu"
                aria-expanded={mobileAccountOpen}
                onClick={() => {
                  setMobileAccountOpen((current) => !current);
                  setMobileSectionMenuOpen(false);
                  setMobileCreateMenuOpen(false);
                }}
              >
                <span className="mobile-dashboard-avatar">R</span>
                <span className="mobile-dashboard-account-name">Ramindu Abeygunawardane</span>
                <ChevronDown size={18} />
              </button>

              {mobileAccountOpen ? (
                <>
                  <button
                    type="button"
                    className="mobile-dashboard-menu-shield"
                    aria-label="Close account menu"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setMobileAccountOpen(false);
                    }}
                  />
                  <div className="mobile-dashboard-account-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setMobileAccountOpen(false)}
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </header>

          <div className="mobile-dashboard-controls-wrap">
            <div className="mobile-dashboard-controls">
              <div className="mobile-dashboard-filter-wrap">
                <button
                  type="button"
                  className="mobile-dashboard-filter-trigger"
                  aria-haspopup="menu"
                  aria-expanded={mobileSectionMenuOpen}
                  onClick={() => {
                    setMobileSectionMenuOpen((current) => !current);
                    setMobileCreateMenuOpen(false);
                    setMobileAccountOpen(false);
                  }}
                >
                  <span>{activeSectionLabel}</span>
                  <ChevronDown size={21} />
                </button>

                {mobileSectionMenuOpen ? (
                  <>
                    <button
                      type="button"
                      className="mobile-dashboard-menu-shield"
                      aria-label="Close project filter"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setMobileSectionMenuOpen(false);
                      }}
                    />
                    <div className="mobile-dashboard-filter-menu" role="menu">
                      {sidebarItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={activeSection === item.id}
                          className={activeSection === item.id ? "active" : undefined}
                          onClick={() => {
                            setActiveSection(item.id);
                            setMobileSectionMenuOpen(false);
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>

              <button
                ref={mobileSearchButtonRef}
                type="button"
                className="mobile-dashboard-icon-button"
                aria-label="Search projects"
                aria-expanded={mobileSearchOpen}
                onClick={() => {
                  setMobileSearchOpen((current) => !current);
                  setMobileSectionMenuOpen(false);
                  setMobileCreateMenuOpen(false);
                  setMobileAccountOpen(false);
                }}
              >
                <Search size={25} />
              </button>

              <div className="mobile-dashboard-create-wrap">
                <button
                  type="button"
                  className="mobile-dashboard-create-button"
                  aria-label="Create new"
                  aria-haspopup="menu"
                  aria-expanded={mobileCreateMenuOpen}
                  disabled={creating}
                  onClick={() => {
                    setMobileCreateMenuOpen((current) => !current);
                    setMobileSectionMenuOpen(false);
                    setMobileAccountOpen(false);
                  }}
                >
                  <Plus size={28} />
                </button>

                {mobileCreateMenuOpen ? (
                  <>
                    <button
                      type="button"
                      className="mobile-dashboard-menu-shield"
                      aria-label="Close create menu"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setMobileCreateMenuOpen(false);
                      }}
                    />
                    <div className="mobile-dashboard-create-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMobileCreateMenuOpen(false);
                          void createProject("Untitled Project");
                        }}
                      >
                        Blank project
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMobileCreateMenuOpen(false);
                          void createProject("Example Project");
                        }}
                      >
                        Example project
                      </button>
                      <div className="mobile-dashboard-menu-divider" />
                      <button type="button" role="menuitem" disabled>
                        New folder
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {mobileSearchOpen ? (
              <label ref={mobileSearchContainerRef} className="mobile-dashboard-search">
                <Search size={22} />
                <input
                  ref={mobileSearchInputRef}
                  value={query}
                  placeholder="Search projects"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            ) : null}
          </div>

          <div className="mobile-dashboard-projects">
            {loading ? (
              <div className="dashboard-empty-state">Loading projects...</div>
            ) : error ? (
              <div className="dashboard-empty-state dashboard-error-state">{error}</div>
            ) : filteredProjects.length === 0 ? (
              <div className="dashboard-empty-state">
                {activeSection === "shared"
                  ? "Shared projects will appear here later."
                  : query.trim()
                    ? "No projects match your search."
                    : "No projects yet. Create your first Typforge project."}
              </div>
            ) : (
              <div className="mobile-dashboard-project-list">
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    role="button"
                    tabIndex={0}
                    className="mobile-dashboard-project-row"
                    onClick={() => openProject(project.id)}
                    onKeyDown={(event) => handleProjectRowKeyDown(event, project.id)}
                  >
                    <span className="dashboard-project-preview" aria-hidden="true">
                      <ProjectPdfThumbnail
                        pdfUrl={projectPreviewUrls[project.id]}
                        cachedImageUrl={projectThumbnailUrls[project.id]}
                        width={30}
                        fallbackIconSize={18}
                        onThumbnailReady={(imageUrl: string) => cacheProjectThumbnail(project, imageUrl)}
                      />
                    </span>

                    <span className="mobile-dashboard-project-name">{project.name}</span>
                    <span className="mobile-dashboard-project-created">{formatRelativeDate(project.createdAt)}</span>

                    <button
                      type="button"
                      className="dashboard-project-more"
                      aria-label={`More actions for ${project.name}`}
                      aria-expanded={openProjectMenu?.projectId === project.id}
                      onClick={(event) => openProjectActionsMenu(project, event)}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <Group
            id="typforge-dashboard"
            orientation="horizontal"
            className="dashboard-outer-box desktop-dashboard-view"
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
                            className={
                              viewMode === "list"
                                ? "dashboard-view-button dashboard-view-button-active dashboard-tooltip-button"
                                : "dashboard-view-button dashboard-tooltip-button"
                            }
                            aria-label="List view"
                            aria-pressed={viewMode === "list"}
                            data-tooltip="List view"
                            onClick={() => setViewMode("list")}
                          >
                            <List size={18} />
                          </button>

                          <button
                            type="button"
                            className={
                              viewMode === "grid"
                                ? "dashboard-view-button dashboard-view-button-active dashboard-tooltip-button"
                                : "dashboard-view-button dashboard-tooltip-button"
                            }
                            aria-label="Grid view"
                            aria-pressed={viewMode === "grid"}
                            data-tooltip="Grid view"
                            onClick={() => setViewMode("grid")}
                          >
                            <Grid3X3 size={17} />
                          </button>
                        </div>

                        <span
                          className="dashboard-tooltip-button"
                          data-tooltip="Import from dashboard will be added later"
                          tabIndex={0}
                        >
                          <button
                            type="button"
                            className="dashboard-secondary-button"
                            disabled
                          >
                            Import
                            <ChevronDown size={16} />
                          </button>
                        </span>

                        <button
                          type="button"
                          className="dashboard-primary-button dashboard-tooltip-button"
                          data-tooltip="Create new project"
                          onClick={() => void createProject()}
                          disabled={creating}
                        >
                          <Plus size={18} />
                          {creating ? "Creating..." : "New"}
                          <ChevronDown size={16} />
                        </button>
                      </div>
                    </header>

                    <div className="dashboard-table">
                      <div className={viewMode === "list" ? "dashboard-table-head" : "dashboard-table-head dashboard-table-head-hidden"}>
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
                      ) : viewMode === "list" ? (
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
                                  width={30}
                                  fallbackIconSize={18}
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
                      ) : (
                        <div className="dashboard-project-grid">
                          {filteredProjects.map((project) => (
                            <div
                              key={project.id}
                              role="button"
                              tabIndex={0}
                              className="dashboard-project-card"
                              onClick={() => openProject(project.id)}
                              onKeyDown={(event) => handleProjectRowKeyDown(event, project.id)}
                            >
                              <button
                                type="button"
                                className="dashboard-project-card-more"
                                aria-label={`More actions for ${project.name}`}
                                aria-expanded={openProjectMenu?.projectId === project.id}
                                onClick={(event) => openProjectActionsMenu(project, event)}
                              >
                                <MoreHorizontal size={17} />
                              </button>

                              <span className="dashboard-project-card-preview" aria-hidden="true">
                                <ProjectPdfThumbnail
                                  pdfUrl={projectPreviewUrls[project.id]}
                                  cachedImageUrl={projectThumbnailUrls[project.id]}
                                  width={118}
                                  fallbackIconSize={28}
                                  onThumbnailReady={(imageUrl: string) => cacheProjectThumbnail(project, imageUrl)}
                                />
                              </span>

                              <span className="dashboard-project-card-footer">
                                <span className="dashboard-project-card-name">
                                  {project.name}
                                </span>

                                <span className="dashboard-project-card-created">
                                  {formatRelativeDate(project.createdAt)}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                </section>
            </Panel>
        </Group>
        </main>

        {dashboardTooltip && typeof document !== "undefined"
          ? createPortal(
              <div
                className={
                  dashboardTooltip.placement === "above"
                    ? "pdf-global-tooltip is-above"
                    : "pdf-global-tooltip is-below"
                }
                style={{
                  top: dashboardTooltip.top,
                  left: dashboardTooltip.left
                }}
              >
                {dashboardTooltip.text}
              </div>,
              document.body
            )
          : null}

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