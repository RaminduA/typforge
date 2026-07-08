"use client";

interface EditorPaneProps {
  activePath?: string;
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onOpenTools: () => void;
}

export function EditorPane({
  activePath,
  content,
  onChange,
  onSave,
  onOpenTools
}: EditorPaneProps) {
  return (
    <main className="editor-pane">
      <div className="editor-header">
        <div className="editor-tabs">
          <div className="tab active">{activePath ?? "No file selected"}</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="secondary-button" onClick={onSave} disabled={!activePath}>
            Save
          </button>
          <button className="secondary-button" onClick={onOpenTools}>
            Tools
          </button>
        </div>
      </div>

      <textarea
        className="editor-textarea"
        value={content}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        disabled={!activePath}
        placeholder="Open a .typ file to start editing..."
      />
    </main>
  );
}