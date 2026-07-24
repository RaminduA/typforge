"use client";

import CodeMirror from "@uiw/react-codemirror";

import {
  EditorView,
  highlightActiveLineGutter,
  keymap,
  lineNumbers
} from "@codemirror/view";
import { foldGutter } from "@codemirror/language";

import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { ChevronUp, FileText, LayoutGrid, MoreHorizontal, X } from "lucide-react";
import { useMemo } from "react";
import { EDITOR_FONT_SIZE_PIXELS, type EditorFontSize } from "@/lib/editor-settings";
import type { OpenEditorFile } from "@/types/editor";
import { typstLanguageExtensions } from "@/lib/typst-language";

interface EditorPaneProps {
  openFiles: OpenEditorFile[];
  activePath?: string;
  content: string;
  fontSize: EditorFontSize;
  toolsOpen: boolean;
  variant?: "desktop" | "mobile";
  onChange: (value: string) => void;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onOpenTools: () => void;
  onOpenMobileFilePicker?: () => void;
  onOpenMobileFileActions?: () => void;
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

export function EditorPane({
  openFiles,
  activePath,
  content,
  fontSize,
  toolsOpen,
  variant = "desktop",
  onChange,
  onSelectTab,
  onCloseTab,
  onOpenTools,
  onOpenMobileFilePicker,
  onOpenMobileFileActions
}: EditorPaneProps) {
  const extensions = useMemo(() => [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        highlightSelectionMatches(),
        ...typstLanguageExtensions(),
        foldGutter(),
        EditorState.tabSize.of(2),
        EditorView.lineWrapping,
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),

        EditorView.theme({
          "&": {
            height: "100%",
            maxHeight: "100%",
            backgroundColor: "var(--bg-editor)",
            color: "var(--text-primary)",
            fontSize: EDITOR_FONT_SIZE_PIXELS[fontSize]
          },

          ".cm-scroller": {
            height: "100%",
            overflow: "auto",
            fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
            lineHeight: "1.62"
          },

          ".cm-content": {
            minHeight: "100%",
            padding: "20px 0"
          },

          ".cm-line": {
            padding: "0 22px"
          },

          ".cm-gutters": {
            backgroundColor: "var(--bg-editor)",
            color: "var(--text-muted)",
            borderRight: "1px solid var(--border-soft)"
          },

          ".cm-activeLineGutter": {
            backgroundColor: "var(--bg-panel-soft)",
            color: "var(--text-primary)"
          },

          ".cm-activeLine": {
            backgroundColor: "var(--bg-panel-soft)"
          },

          ".cm-selectionBackground": {
            backgroundColor: "rgba(16, 163, 127, 0.28) !important"
          },

          ".cm-cursor": {
            borderLeftColor: "var(--text-primary)"
          },

          ".cm-searchMatch": {
            backgroundColor: "rgba(230, 180, 80, 0.35)"
          },

          ".cm-searchMatch-selected": {
            backgroundColor: "rgba(230, 180, 80, 0.55)"
          },

          ".cm-focused": {
            outline: "none"
          }
        })
      ], [fontSize]
    );

  const hasOpenTabs = openFiles.length > 0;
  const activeFile = openFiles.find((file) => file.path === activePath);

  if (variant === "mobile") {
    return (
      <main className="editor-pane mobile-editor-pane">
        {hasOpenTabs && activePath ? (
          <div className="codemirror-wrap mobile-codemirror-wrap">
            <CodeMirror
              key={activePath}
              value={content}
              height="100%"
              basicSetup={false}
              editable
              extensions={extensions}
              theme="dark"
              onChange={(value) => onChange(value)}
            />
          </div>
        ) : (
          <div className="mobile-editor-empty">Open a Typst file to start editing.</div>
        )}

        <footer className="mobile-editor-bottom-bar">
          <button
            type="button"
            className="mobile-editor-file-button"
            disabled={!activePath}
            aria-label="Open project files"
            onClick={onOpenMobileFilePicker}
          >
            <FileText size={18} />
            <span>{activePath ? getFileName(activePath) : "No file open"}</span>
            {activeFile && activeFile.content !== activeFile.savedContent ? (
              <span className="mobile-editor-dirty" aria-label="Unsaved changes">●</span>
            ) : null}
            <ChevronUp size={18} />
          </button>

          <button
            type="button"
            className="mobile-editor-more-button"
            disabled={!activePath}
            aria-label="Open file actions"
            onClick={onOpenMobileFileActions}
          >
            <MoreHorizontal size={22} />
          </button>
        </footer>
      </main>
    );
  }

  return (
    <main className="editor-pane">
      <div className={hasOpenTabs ? "editor-header" : "editor-header is-empty"}>
        {hasOpenTabs ? (
          <div
            className="editor-tabs"
            role="tablist"
            aria-label="Open files"
          >
            {openFiles.map((file) => {
              const active = file.path === activePath;
              const dirty = file.content !== file.savedContent;

              return (
                <div
                  key={file.path}
                  className={active ? "editor-tab active" : "editor-tab"}
                  role="presentation"
                  title={file.path}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className="editor-tab-main"
                    onClick={() => onSelectTab(file.path)}
                  >
                    <FileText className="editor-tab-file-icon" size={15} />
                    <span className="editor-tab-label">
                      {getFileName(file.path)}
                    </span>

                    {dirty ? (
                      <span
                        className="editor-tab-dirty"
                        aria-label="Unsaved changes"
                        title="Unsaved changes"
                      >
                        ●
                      </span>
                    ) : null}
                  </button>

                  <button
                    type="button"
                    className="editor-tab-close"
                    aria-label={`Close ${getFileName(file.path)}`}
                    title="Close"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCloseTab(file.path);
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        <button
          type="button"
          className={toolsOpen ? "editor-tools-button is-open" : "editor-tools-button"}
          aria-pressed={toolsOpen}
          aria-label={toolsOpen ? "Close tools" : "Open tools"}
          onClick={onOpenTools}
        >
          {toolsOpen ? (
            <>
              <span className="editor-tools-button-text">
                Close
              </span>

              <X size={17} />
            </>
          ) : (
            <>
              <span className="editor-tools-button-text">
                Tools
              </span>

              <LayoutGrid size={17} />
            </>
          )}
        </button>
      </div>

      {hasOpenTabs && activePath ? (
        <div className="codemirror-wrap">
          <CodeMirror
            key={activePath}
            value={content}
            height="100%"
            basicSetup={false}
            editable
            extensions={extensions}
            theme="dark"
            onChange={(value) => onChange(value)}
          />
        </div>
      ) : null}
    </main>
  );
}