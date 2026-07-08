"use client";

import type { Project, VersionSnapshot } from "@/types/project";

export type ToolTab = "info" | "versions" | "logs";

interface ToolsPanelProps {
  activeTab: ToolTab;
  onChangeTab: (tab: ToolTab) => void;
  project?: Project;
  versions: VersionSnapshot[];
  logs: string;
  onCreateVersion: () => void;
  onRestoreVersion: (versionId: string) => void;
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
  return (
    <section className="tools-panel">
      <div className="tools-header">
        <strong>Tools</strong>
      </div>

      <div className="tools-tabs">
        <button
          className={activeTab === "info" ? "primary-button" : "secondary-button"}
          onClick={() => onChangeTab("info")}
        >
          Project Info
        </button>
        <button
          className={activeTab === "versions" ? "primary-button" : "secondary-button"}
          onClick={() => onChangeTab("versions")}
        >
          Versions
        </button>
        <button
          className={activeTab === "logs" ? "primary-button" : "secondary-button"}
          onClick={() => onChangeTab("logs")}
        >
          Logs
        </button>
      </div>

      <div className="tools-body">
        {activeTab === "info" ? (
          <div>
            <h3>Project Info</h3>
            <p>
              <strong>Name:</strong> {project?.name ?? "-"}
            </p>
            <p>
              <strong>Entry file:</strong> {project?.entryFile ?? "main.typ"}
            </p>
            <p>
              <strong>Project ID:</strong> {project?.id ?? "-"}
            </p>
          </div>
        ) : null}

        {activeTab === "versions" ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <h3>Versions</h3>
              <button className="secondary-button" onClick={onCreateVersion}>
                Snapshot
              </button>
            </div>

            {versions.length === 0 ? (
              <p className="muted">No snapshots yet.</p>
            ) : (
              versions.map((version) => (
                <div
                  key={version.id}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)"
                  }}
                >
                  <strong>{version.message}</strong>
                  <div className="muted small">{new Date(version.createdAt).toLocaleString()}</div>
                  <button
                    className="secondary-button"
                    style={{ marginTop: 8 }}
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
          <div>
            <h3>Logs</h3>
            <pre className="logs">{logs || "No compile logs yet."}</pre>
          </div>
        ) : null}
      </div>
    </section>
  );
}