"use client";

import dynamic from "next/dynamic";

import type { PdfViewerSettings } from "@/lib/pdf-viewer-settings";
import type { CompileStatus } from "@/types/build";

const PdfDocumentViewer = dynamic(
  () =>
    import("./PdfDocumentViewer").then(
      (module) => module.PdfDocumentViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="pdf-viewer-module-loading">
        Loading PDF viewer...
      </div>
    )
  }
);

interface PdfPreviewPaneProps {
  pdfUrl?: string;
  downloadUrl?: string;
  compileStatus: CompileStatus;
  settings: PdfViewerSettings;
  mobile?: boolean;
  canShowPreviousCompile: boolean;
  canShowNextCompile: boolean;
  onCompile: () => void;
  onShowPreviousCompile: () => void;
  onShowNextCompile: () => void;
}

export function PdfPreviewPane({
  pdfUrl,
  downloadUrl,
  compileStatus,
  settings,
  mobile = false,
  canShowPreviousCompile,
  canShowNextCompile,
  onCompile,
  onShowPreviousCompile,
  onShowNextCompile
}: PdfPreviewPaneProps) {
  return (
    <section className="preview-pane">
      <PdfDocumentViewer
        pdfUrl={pdfUrl}
        downloadUrl={downloadUrl}
        compileStatus={compileStatus}
        settings={settings}
        mobile={mobile}
        canShowPreviousCompile={canShowPreviousCompile}
        canShowNextCompile={canShowNextCompile}
        onCompile={onCompile}
        onShowPreviousCompile={onShowPreviousCompile}
        onShowNextCompile={onShowNextCompile}
      />
    </section>
  );
}
