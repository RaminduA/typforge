"use client";

interface PdfPreviewPaneProps {
  pdfUrl?: string;
  downloadUrl?: string;
  compiling: boolean;
  onCompile: () => void;
}

export function PdfPreviewPane({
  pdfUrl,
  downloadUrl,
  compiling,
  onCompile
}: PdfPreviewPaneProps) {
  return (
    <section className="preview-pane">
      <div className="preview-toolbar">
        <div className="toolbar-left">
          <button className="primary-button" onClick={onCompile} disabled={compiling}>
            {compiling ? "Compiling..." : "Compile"}
          </button>
          <span className="muted small">PDF Preview</span>
        </div>

        <div className="toolbar-right">
          {downloadUrl ? (
            <a className="secondary-button" href={downloadUrl}>
              Download
            </a>
          ) : (
            <button className="secondary-button" disabled>
              Download
            </button>
          )}
        </div>
      </div>

      {pdfUrl ? (
        <div className="pdf-frame-wrap">
          <iframe className="pdf-frame" src={pdfUrl} title="Typforge PDF preview" />
        </div>
      ) : (
        <div className="empty-preview">
          <div>
            <div style={{ fontSize: 32, marginBottom: 8 }}>PDF</div>
            <div>Click Compile to render the current Typst project.</div>
          </div>
        </div>
      )}
    </section>
  );
}