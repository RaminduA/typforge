"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties
} from "react";

import type { Project, VersionSnapshot } from "@/types/project";

export type ToolTab = "info" | "versions" | "logs";

type LogFilter = "warnings-errors" | "warnings" | "errors" | "raw";

interface ToolsPanelProps {
  activeTab: ToolTab;
  onChangeTab: (tab: ToolTab) => void;
  project?: Project;
  versions: VersionSnapshot[];
  logs: string;
  onCreateVersion: () => void;
  onRestoreVersion: (versionId: string) => void;
}

const LOG_FILTER_LABELS: Record<LogFilter, string> = {
  "warnings-errors": "Warnings and Errors",
  warnings: "Warnings only",
  errors: "Errors only",
  raw: "Raw logs"
};

interface LogDiagnostic {
  id: number;
  severity: "error" | "warning";
  lines: string[];
}

function isErrorStart(line: string) {
  const trimmed = line.trim();

  return (
    /^error:/i.test(trimmed) ||
    /^!/.test(trimmed) ||
    /\bLaTeX Error:/i.test(trimmed) ||
    /\bTeX capacity exceeded/i.test(trimmed) ||
    /\bEmergency stop/i.test(trimmed) ||
    /\bFatal error/i.test(trimmed)
  );
}

function isWarningStart(line: string) {
  const trimmed = line.trim();

  return (
    /^warning:/i.test(trimmed) ||
    /^LaTeX Warning:/i.test(trimmed) ||
    /^Package .* Warning:/i.test(trimmed) ||
    /\bwarning\b/i.test(trimmed)
  );
}

function isDiagnosticStart(line: string) {
  return isErrorStart(line) || isWarningStart(line);
}

function isLikelyDiagnosticContinuation(line: string) {
  const trimmed = line.trim();

  if (trimmed === "") return true;

  return (
    /^[-─┌│╭╰]/.test(trimmed) ||
    /^\d+\s/.test(trimmed) ||
    /^\^+/.test(trimmed) ||
    /^= hint:/i.test(trimmed) ||
    /^hint:/i.test(trimmed) ||
    /^l\.\d+/i.test(trimmed) ||
    /^[A-Za-z0-9_\-./\\]+\.typ:\d+:\d+/.test(trimmed) ||
    /^Compiler process exited/i.test(trimmed) ||
    /^exit status/i.test(trimmed)
  );
}

function parseDiagnostics(logs: string): LogDiagnostic[] {
  const lines = logs.split(/\r?\n/);
  const diagnostics: LogDiagnostic[] = [];

  let current: LogDiagnostic | null = null;

  function flushCurrent() {
    if (current && current.lines.some((line) => line.trim() !== "")) {
      diagnostics.push(current);
    }

    current = null;
  }

  for (const line of lines) {
    if (isDiagnosticStart(line)) {
      flushCurrent();

      current = {
        id: diagnostics.length,
        severity: isWarningStart(line) && !isErrorStart(line) ? "warning" : "error",
        lines: [line]
      };

      continue;
    }

    if (current && isLikelyDiagnosticContinuation(line)) {
      current.lines.push(line);
      continue;
    }

    if (current) {
      flushCurrent();
    }
  }

  flushCurrent();

  return diagnostics;
}

function filterDiagnostics(diagnostics: LogDiagnostic[], filter: LogFilter) {
  if (filter === "warnings") {
    return diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
  }

  if (filter === "errors") {
    return diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  }

  return diagnostics;
}

export function ToolsPanel({
  activeTab,
  onChangeTab,
  project,
  versions,
  logs,
  onCreateVersion,
  onRestoreVersion
}: ToolsPanelProps) {
  const [logFilter, setLogFilter] = useState<LogFilter>("raw");
  const [logFilterOpen, setLogFilterOpen] = useState(false);

  const tabsRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<ToolTab, HTMLButtonElement | null>>({ info: null, versions: null, logs: null });
  const [tabIndicatorStyle, setTabIndicatorStyle] = useState<CSSProperties>({ opacity: 0, width: 0, transform: "translateX(0px)" });

  useEffect(() => {
    function updateIndicator() {
      const tabs = tabsRef.current;
      const activeButton = tabRefs.current[activeTab];

      if (!tabs || !activeButton) {
        return;
      }

      const tabsRect = tabs.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();

      setTabIndicatorStyle({
        opacity: 1,
        width: buttonRect.width,
        transform: `translateX(${buttonRect.left - tabsRect.left}px)`
      });
    }

    updateIndicator();

    window.addEventListener("resize", updateIndicator);

    return () => {
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeTab]);

  const diagnostics = useMemo(() => parseDiagnostics(logs), [logs]);

  const visibleDiagnostics = useMemo(
    () => filterDiagnostics(diagnostics, logFilter),
    [diagnostics, logFilter]
  );

  const errorCount = useMemo(
    () => diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
    [diagnostics]
  );

  const warningCount = useMemo(
    () => diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
    [diagnostics]
  );

  return (
    <section className="tools-panel">
      <div className="tools-tabs" ref={tabsRef}>
        <button
          ref={(element) => { tabRefs.current.info = element; }}
          className={`tools-tab-button ${activeTab === "info" ? "active" : ""}`}
          onClick={() => onChangeTab("info")}
        >
          Project Info
        </button>

        <button
          ref={(element) => { tabRefs.current.versions = element; }}
          className={`tools-tab-button ${activeTab === "versions" ? "active" : ""}`}
          onClick={() => onChangeTab("versions")}
        >
          Versions
        </button>

        <button
          ref={(element) => { tabRefs.current.logs = element; }}
          className={`tools-tab-button ${activeTab === "logs" ? "active" : ""}`}
          onClick={() => onChangeTab("logs")}
        >
          Logs
        </button>

        <span
          className="tools-tabs-indicator"
          style={tabIndicatorStyle}
          aria-hidden="true"
        />
      </div>

      <div className="tools-body">
        {activeTab === "info" ? (
          <div className="tools-section">
            <h3>Project Info</h3>
            <p><strong>Name:</strong> {project?.name ?? "-"}</p>
            <p><strong>Entry file:</strong> {project?.entryFile ?? "main.typ"}</p>
            <p><strong>Project ID:</strong> {project?.id ?? "-"}</p>
          </div>
        ) : null}

        {activeTab === "versions" ? (
          <div className="tools-section">
            <div className="tools-section-header">
              <h3>Versions</h3>

              <button className="secondary-button" onClick={onCreateVersion}>
                Snapshot
              </button>
            </div>

            {versions.length === 0 ? (
              <p className="muted">No snapshots yet.</p>
            ) : (
              versions.map((version) => (
                <div className="version-row" key={version.id}>
                  <strong>{version.message}</strong>

                  <div className="muted small">
                    {new Date(version.createdAt).toLocaleString()}
                  </div>

                  <button
                    className="secondary-button"
                    onClick={() => onRestoreVersion(version.id)}
                  >
                    Restore
                  </button>
                </div>
              ))
            )}
          </div>
        ) : null}

        {activeTab === "logs" ? (
          <div className="logs-panel">
            <div className="logs-toolbar">
              <div className="logs-filter-wrap">
                <button
                  className="logs-filter-trigger"
                  type="button"
                  aria-expanded={logFilterOpen}
                  onClick={() => setLogFilterOpen((open) => !open)}
                >
                  <span>{LOG_FILTER_LABELS[logFilter]}</span>

                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="m6 9 6 6 6-6"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </button>

                {logFilterOpen ? (
                  <>
                    <button
                      className="logs-filter-shield"
                      type="button"
                      aria-label="Close log filter menu"
                      onClick={() => setLogFilterOpen(false)}
                    />

                    <div className="logs-filter-menu">
                      {(Object.keys(LOG_FILTER_LABELS) as LogFilter[]).map((filter) => (
                        <button
                          key={filter}
                          className={`logs-filter-option ${
                            logFilter === filter ? "selected" : ""
                          }`}
                          type="button"
                          onClick={() => {
                            setLogFilter(filter);
                            setLogFilterOpen(false);
                          }}
                        >
                          {LOG_FILTER_LABELS[filter]}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="logs-summary">
                <span className={errorCount > 0 ? "has-errors" : ""}>
                  {errorCount} errors
                </span>

                <span className={warningCount > 0 ? "has-warnings" : ""}>
                  {warningCount} warnings
                </span>
              </div>
            </div>

            <div className="logs-viewer" role="log" aria-live="polite">
              {!logs ? (
                <div className="logs-empty">No compile logs yet.</div>
              ) : logFilter === "raw" ? (
                <pre className="logs logs-raw">{logs}</pre>
              ) : visibleDiagnostics.length === 0 ? (
                <div className="logs-nice">Nice! No issues here.</div>
              ) : (
                <div className="logs-diagnostics">
                  {visibleDiagnostics.map((diagnostic) => (
                    <pre
                      key={diagnostic.id}
                      className={`logs-diagnostic logs-diagnostic-${diagnostic.severity}`}
                    >
                      {diagnostic.lines.join("\n")}
                    </pre>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}