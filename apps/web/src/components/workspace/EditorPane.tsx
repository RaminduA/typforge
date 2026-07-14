"use client";

import CodeMirror from "@uiw/react-codemirror";

import {
  EditorView,
  highlightActiveLineGutter,
  keymap,
  lineNumbers
} from "@codemirror/view";

import { EditorState } from "@codemirror/state";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";

import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";

import { useMemo } from "react";

import { EDITOR_FONT_SIZE_PIXELS, type EditorFontSize } from "@/lib/editor-settings";

interface EditorPaneProps {
  activePath?: string;
  content: string;
  fontSize: EditorFontSize;
  onChange: (value: string) => void;
  onOpenTools: () => void;
}

export function EditorPane({ activePath, content, fontSize, onChange, onOpenTools }: EditorPaneProps) {
  const extensions = useMemo(() => [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        highlightSelectionMatches(),
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
      ],

      [fontSize]
    );

  return (
    <main className="editor-pane">
      <div className="editor-header">
        <div className="editor-tabs">
          <div className="tab active">
            {activePath ?? "No file selected"}
          </div>
        </div>

        <button
          className="secondary-button"
          onClick={onOpenTools}
        >
          Tools
        </button>
      </div>

      <div className="codemirror-wrap">
        <CodeMirror
          value={content}
          height="100%"
          basicSetup={false}
          editable={Boolean(activePath)}
          extensions={extensions}
          theme="dark"
          placeholder="Open a .typ file to start editing..."
          onChange={(value) => onChange(value)}
        />
      </div>
    </main>
  );
}