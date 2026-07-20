"use client";

import { FileText } from "lucide-react";
import { useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs",import.meta.url).toString();

interface ProjectPdfThumbnailProps {
  pdfUrl?: string;
  cachedImageUrl?: string;
  onThumbnailReady?: (imageUrl: string) => void;
}

const THUMBNAIL_WIDTH = 30;

function thumbnailPixelRatio() {
  if (typeof window === "undefined") {
    return 4;
  }

  return Math.max(3, Math.min(window.devicePixelRatio * 3, 5));
}

export default function ProjectPdfThumbnail({pdfUrl,cachedImageUrl,onThumbnailReady}: ProjectPdfThumbnailProps) {
  const rootRef = useRef<HTMLSpanElement>(null);

  function handleRenderSuccess() {
    const canvas = rootRef.current?.querySelector("canvas");

    if (!canvas) {
      return;
    }

    try {
      const imageUrl = canvas.toDataURL("image/png");
      onThumbnailReady?.(imageUrl);
    } catch {
      // If canvas extraction fails, keep using the live PDF render.
    }
  }

  if (cachedImageUrl) {
    return (
      <img
        src={cachedImageUrl}
        alt=""
        className="dashboard-project-preview-image"
        draggable={false}
      />
    );
  }

  if (!pdfUrl) {
    return (
      <span className="dashboard-project-preview-fallback">
        <FileText size={18} />
      </span>
    );
  }

  return (
    <span ref={rootRef} className="dashboard-project-preview-render-root">
      <Document
        file={pdfUrl}
        className="dashboard-project-preview-document"
        loading={
          <span className="dashboard-project-preview-fallback">
            <FileText size={18} />
          </span>
        }
        error={
          <span className="dashboard-project-preview-fallback">
            <FileText size={18} />
          </span>
        }
      >
        <Page
          pageNumber={1}
          width={THUMBNAIL_WIDTH}
          devicePixelRatio={thumbnailPixelRatio()}
          className="dashboard-project-preview-page"
          renderTextLayer={false}
          renderAnnotationLayer={false}
          onRenderSuccess={handleRenderSuccess}
        />
      </Document>
    </span>
  );
}