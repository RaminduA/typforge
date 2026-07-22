"use client";

import { FileText } from "lucide-react";
import { type CSSProperties, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

interface ProjectPdfThumbnailProps {
  pdfUrl?: string;
  cachedImageUrl?: string;
  width?: number;
  fallbackIconSize?: number;
  onThumbnailReady?: (imageUrl: string) => void;
}

const THUMBNAIL_ASPECT_RATIO = 1.414;
const MIN_INTERNAL_RENDER_WIDTH = 480;
const INTERNAL_RENDER_SCALE = 4;

export default function ProjectPdfThumbnail({pdfUrl,cachedImageUrl,width = 30,fallbackIconSize = 18,onThumbnailReady}: ProjectPdfThumbnailProps) {
  const rootRef = useRef<HTMLSpanElement>(null);

  const visualHeight = Math.round(width * THUMBNAIL_ASPECT_RATIO);
  const internalRenderWidth = Math.max(MIN_INTERNAL_RENDER_WIDTH, Math.ceil(width * INTERNAL_RENDER_SCALE));

  const thumbnailStyle = {
    "--dashboard-thumbnail-width": `${width}px`,
    "--dashboard-thumbnail-height": `${visualHeight}px`
  } as CSSProperties;

  function handleRenderSuccess() {
    const canvas = rootRef.current?.querySelector("canvas");

    if (!canvas) {
      return;
    }

    try {
      const imageUrl = canvas.toDataURL("image/png");
      onThumbnailReady?.(imageUrl);
    } catch {
      // Keep the live PDF render if canvas extraction fails.
    }
  }

  if (cachedImageUrl) {
    return (
      <img
        src={cachedImageUrl}
        alt=""
        className="dashboard-project-preview-image"
        style={thumbnailStyle}
        draggable={false}
      />
    );
  }

  if (!pdfUrl) {
    return (
      <span
        className="dashboard-project-preview-fallback"
        style={thumbnailStyle}
      >
        <FileText size={fallbackIconSize} />
      </span>
    );
  }

  return (
    <span
      ref={rootRef}
      className="dashboard-project-preview-render-root"
      style={thumbnailStyle}
    >
      <Document
        file={pdfUrl}
        className="dashboard-project-preview-document"
        loading={
          <span
            className="dashboard-project-preview-fallback"
            style={thumbnailStyle}
          >
            <FileText size={fallbackIconSize} />
          </span>
        }
        error={
          <span
            className="dashboard-project-preview-fallback"
            style={thumbnailStyle}
          >
            <FileText size={fallbackIconSize} />
          </span>
        }
      >
        <Page
          pageNumber={1}
          width={internalRenderWidth}
          className="dashboard-project-preview-page"
          renderTextLayer={false}
          renderAnnotationLayer={false}
          onRenderSuccess={handleRenderSuccess}
        />
      </Document>
    </span>
  );
}