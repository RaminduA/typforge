"use client";

import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleArrowDown,
  Ellipsis,
  ExternalLink,
  LoaderCircle,
  Printer,
  RefreshCw,
  RotateCcw,
  RotateCw,
  XCircle
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  KeyboardEvent as ReactKeyboardEvent
} from "react";
import { createPortal } from "react-dom";
import { Document, Page, pdfjs } from "react-pdf";

import type { PdfViewerSettings } from "@/lib/pdf-viewer-settings";
import type { CompileStatus } from "@/types/build";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type ZoomValue = "fit" | number;
type OpenMenu = "status" | "zoom" | "more" | null;
type ConcreteOpenMenu = Exclude<OpenMenu, null>;

interface FloatingMenuPosition {
  top: number;
  left: number;
}

interface FloatingTooltipState {
  text: string;
  top: number;
  left: number;
  placement: "above" | "below";
}

interface PdfDocumentProxyLike {
  numPages: number;
}

interface PdfPageProxyLike {
  pageNumber: number;
  getViewport: (options: { scale: number }) => {
    width: number;
    height: number;
  };
}

interface PdfDocumentViewerProps {
  pdfUrl?: string;
  downloadUrl?: string;
  compileStatus: CompileStatus;
  settings: PdfViewerSettings;
  canShowPreviousCompile: boolean;
  canShowNextCompile: boolean;
  onCompile: () => void;
  onShowPreviousCompile: () => void;
  onShowNextCompile: () => void;
}

const PRESET_ZOOMS = [50, 75, 100, 150, 200, 300, 400] as const;
const MIN_ZOOM = 30;
const MAX_ZOOM = 800;
const MENU_WIDTHS: Record<ConcreteOpenMenu, number> = { status: 205, zoom: 220, more: 245 };

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function formatPageNumber(value: number): string {
  return String(value).padStart(2, "0");
}

function ZoomFitIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M14 4h6v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />

      <path
        d="M10 20H4v-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function PdfDocumentViewer({ pdfUrl, downloadUrl, compileStatus, settings, canShowPreviousCompile, canShowNextCompile, onCompile, onShowPreviousCompile, onShowNextCompile }: PdfDocumentViewerProps) {
  const rootRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const statusMenuAnchorRef = useRef<HTMLDivElement>(null);
  const zoomMenuAnchorRef = useRef<HTMLDivElement>(null);
  const moreMenuAnchorRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollFrameRef = useRef<number | null>(null);
  const currentPageRef = useRef(1);
  const pageInputFocusedRef = useRef(false);
  const pendingRestorePageRef = useRef<number | null>(null);
  const pinchFrameRef = useRef<number | null>(null);
  const pinchZoomRef = useRef<number | null>(null);
  const pendingPinchAnchorRef = useRef<{contentY: number; pointerY: number; ratio: number;} | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("01");
  const [fitWidth, setFitWidth] = useState(620);
  const [basePageSize, setBasePageSize] = useState({ width: 595, height: 842 });
  const [zoom, setZoom] = useState<ZoomValue>("fit");
  const [rotation, setRotation] = useState(0);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [menuPosition, setMenuPosition] = useState<FloatingMenuPosition>({ top: 0, left: 0 });
  const [tooltip, setTooltip] = useState<FloatingTooltipState | null>(null);
  const [loading, setLoading] = useState(Boolean(pdfUrl));
  const [loadError, setLoadError] = useState<string>();

  const pages = useMemo(() => Array.from({ length: numPages }, (_, index) => index + 1), [numPages]);

  const unrotatedBaseWidth = rotation % 180 === 0 ? basePageSize.width : basePageSize.height;
  const fitPercent = Math.max(MIN_ZOOM, Math.round((fitWidth / unrotatedBaseWidth) * 100));
  const pageWidth = zoom === "fit" ? fitWidth : Math.round((unrotatedBaseWidth * zoom) / 100);
  const zoomLabel = zoom === "fit" ? "Zoom to fit" : `${Math.round(zoom)}%`;

  function getMenuAnchor(menu: ConcreteOpenMenu): HTMLElement | null {
    if (menu === "status") return statusMenuAnchorRef.current;
    if (menu === "zoom") return zoomMenuAnchorRef.current;
    return moreMenuAnchorRef.current;
  }

  function updateFloatingMenuPosition(menu: ConcreteOpenMenu) {
    const anchor = getMenuAnchor(menu);

    if (!anchor) return;

    const bounds = anchor.getBoundingClientRect();
    const menuWidth = MENU_WIDTHS[menu];
    const left = clampNumber(bounds.right - menuWidth,8,window.innerWidth - menuWidth - 8);
    const top = Math.min(bounds.bottom + 8, window.innerHeight - 12);
    setMenuPosition({ top, left });
  }

  function toggleFloatingMenu(menu: ConcreteOpenMenu) {
    setTooltip(null);

    setOpenMenu((current) => {
      if (current === menu) {
        return null;
      }

      updateFloatingMenuPosition(menu);

      return menu;
    });
  }

  useEffect(() => {pinchZoomRef.current = zoom === "fit" ? fitPercent : zoom;}, [fitPercent, zoom]);

  useEffect(() => {
    if (!openMenu) return;

    updateFloatingMenuPosition(openMenu);

    function handleReposition() {
      if (openMenu) {
        updateFloatingMenuPosition(openMenu);
      }
    }

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [openMenu]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const rootElement: HTMLElement = root;

    function showTooltipForElement(element: HTMLElement) {
      if (openMenu) {
        setTooltip(null);
        return;
      }

      const text = element.dataset.tooltip;

      if (!text) {
        return;
      }

      const bounds = element.getBoundingClientRect();

      const estimatedWidth = Math.min(240, Math.max(90, text.length * 7.2));

      const left = clampNumber(bounds.left + bounds.width / 2, estimatedWidth / 2 + 8, window.innerWidth - estimatedWidth / 2 - 8);

      const hasSpaceBelow = bounds.bottom + 42 < window.innerHeight;

      setTooltip({
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

      if (!tooltipElement || !rootElement.contains(tooltipElement) || tooltipElement.closest(".pdf-menu")) {
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

      setTooltip(null);
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
      setTooltip(null);
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
  }, [openMenu]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const pendingAnchor = pendingPinchAnchorRef.current;

    if (!viewport || !pendingAnchor) {
      return;
    }

    viewport.scrollTop = pendingAnchor.contentY * pendingAnchor.ratio - pendingAnchor.pointerY;

    pendingPinchAnchorRef.current = null;
  }, [pageWidth]);

  useEffect(() => {
    currentPageRef.current = currentPage;

    if (!pageInputFocusedRef.current) {
      setPageInput(formatPageNumber(currentPage));
    }
  }, [currentPage]);

  useEffect(() => {
    setLoadError(undefined);

    if (pdfUrl) {
      pendingRestorePageRef.current = currentPageRef.current;
      setLoading(true);
      return;
    }

    setLoading(false);
    setNumPages(0);
    setCurrentPage(1);
  }, [pdfUrl]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const viewportElement: HTMLDivElement = viewport;
    let animationFrameId: number | null = null;

    function measureStableFitWidth() {
      const viewportWidth = viewportElement.getBoundingClientRect().width;
      return Math.max(240, Math.floor(viewportWidth - 56));
    }

    function updateFitWidth() {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(() => {
        animationFrameId = null;
        const nextFitWidth = measureStableFitWidth();
        setFitWidth((currentFitWidth) => {
          if (Math.abs(currentFitWidth - nextFitWidth) < 4) {
            return currentFitWidth;
          }
          return nextFitWidth;
        });
      });
    }

    updateFitWidth();

    const observer = new ResizeObserver(updateFitWidth);

    observer.observe(viewportElement);

    return () => {
      observer.disconnect();

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Element && (target.closest("[data-pdf-menu-root]") || target.closest("[data-pdf-floating-menu]"))) {
        return;
      }

      setOpenMenu(null);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const setViewerZoom = useCallback((nextZoom: ZoomValue) => {
      pendingRestorePageRef.current = currentPageRef.current;
      setZoom(nextZoom);
    }, []
  );

  const rotateViewer = useCallback((amount: number) => {
    pendingRestorePageRef.current = currentPageRef.current;
    setRotation((current) => (current + amount + 360) % 360);
  }, []);

  const handleZoomIn = useCallback(() => {
    const currentPercent = zoom === "fit" ? fitPercent : zoom;
    const next = clampZoom(Math.floor(currentPercent / 10) * 10 + 10);

    setViewerZoom(next);
  }, [fitPercent, setViewerZoom, zoom]);

  const handleZoomOut = useCallback(() => {
    const currentPercent = zoom === "fit" ? fitPercent : zoom;
    const next = clampZoom(Math.ceil(currentPercent / 10) * 10 - 10);

    setViewerZoom(next);
  }, [fitPercent, setViewerZoom, zoom]);

  useEffect(() => {
    if (!settings.zoomShortcuts) {
      return;
    }

    function handleZoomShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        event.stopPropagation();
        setViewerZoom("fit");
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        event.stopPropagation();
        handleZoomIn();
        return;
      }

      if (event.key === "-") {
        event.preventDefault();
        event.stopPropagation();
        handleZoomOut();
      }
    }

    window.addEventListener("keydown", handleZoomShortcut, true);

    return () => {
      window.removeEventListener("keydown", handleZoomShortcut, true);
    };
  }, [handleZoomIn, handleZoomOut, setViewerZoom, settings.zoomShortcuts]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    function handlePdfPinch(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return;
      }

      const viewport = viewportRef.current;

      if (!viewport) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const currentPercent = pinchZoomRef.current ?? (zoom === "fit" ? fitPercent : zoom);

      const nextPercent = clampZoom(currentPercent * Math.exp(-event.deltaY * 0.006));

      const viewportRect = viewport.getBoundingClientRect();
      const pointerY = Math.min(viewportRect.height, Math.max(0, event.clientY - viewportRect.top));

      pendingPinchAnchorRef.current = { contentY: viewport.scrollTop + pointerY, pointerY, ratio: nextPercent / currentPercent };

      pinchZoomRef.current = nextPercent;

      if (pinchFrameRef.current !== null) {
        return;
      }

      pinchFrameRef.current = window.requestAnimationFrame(() => {
        pinchFrameRef.current = null;

        const nextZoom = pinchZoomRef.current;

        if (nextZoom === null) {
          return;
        }

        setZoom(Math.round(nextZoom * 100) / 100);
      });
    }

    root.addEventListener("wheel", handlePdfPinch, { passive: false });

    return () => {
      root.removeEventListener("wheel", handlePdfPinch);

      if (pinchFrameRef.current !== null) {
        window.cancelAnimationFrame(pinchFrameRef.current);
        pinchFrameRef.current = null;
      }
    };
  }, [fitPercent, zoom]);

  const updateCurrentPage = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport || pageRefs.current.size === 0) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const targetY = viewportRect.top + viewportRect.height * 0.35;

    let nearestPage = 1;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const [pageNumber, node] of pageRefs.current.entries()) {
      const rect = node.getBoundingClientRect();

      const distance = targetY >= rect.top && targetY <= rect.bottom ? 0 : Math.min(Math.abs(targetY - rect.top), Math.abs(targetY - rect.bottom));

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPage = pageNumber;
      }
    }

    setCurrentPage(nearestPage);
  }, []);

  const handleViewportScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) {
      return;
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      updateCurrentPage();
    });
  }, [updateCurrentPage]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    };
  }, []);

  const scrollToPage = useCallback(
    (pageNumber: number, behavior: ScrollBehavior = "auto") => {
      const viewport = viewportRef.current;
      const page = pageRefs.current.get(pageNumber);

      if (!viewport || !page) {
        return;
      }

      viewport.scrollTo({ top: Math.max(0, page.offsetTop - 10), behavior });
    }, []
  );

  const commitPageInput = useCallback(() => {
    if (pageInput.trim() === "") {
      setPageInput(formatPageNumber(currentPageRef.current));
      return;
    }

    const parsed = Number.parseInt(pageInput, 10);
    const lastPage = Math.max(numPages, 1);
    const nextPage = Math.min(lastPage, Math.max(1, Number.isFinite(parsed) ? parsed : currentPageRef.current));

    setCurrentPage(nextPage);
    setPageInput(formatPageNumber(nextPage));
    scrollToPage(nextPage, "smooth");
  }, [numPages, pageInput, scrollToPage]);

  function handlePageInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;

    if (/^\d*$/.test(nextValue)) {
      setPageInput(nextValue);
    }
  }

  function handlePageInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitPageInput();
      event.currentTarget.blur();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setPageInput(formatPageNumber(currentPageRef.current));
      event.currentTarget.blur();
      return;
    }

    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Home", "End", "Tab"].includes(event.key)
    ) {
      return;
    }

    if (!/^\d$/.test(event.key)) {
      event.preventDefault();
    }
  }

  function handlePageInputPaste(event: ReactClipboardEvent<HTMLInputElement>) {
    const pastedText = event.clipboardData.getData("text");

    if (!/^\d+$/.test(pastedText)) {
      event.preventDefault();
    }
  }

  function handleDocumentLoadSuccess(document: PdfDocumentProxyLike) {
    const nextNumPages = document.numPages;
    const restorePage = Math.min(Math.max(currentPageRef.current, 1), nextNumPages);

    setNumPages(nextNumPages);
    setCurrentPage(restorePage);
    setPageInput(formatPageNumber(restorePage));
    setLoading(false);
    setLoadError(undefined);
    pendingRestorePageRef.current = restorePage;
  }

  function handleDocumentLoadError(error: Error) {
    setLoading(false);
    setLoadError(error.message || "Unable to load the generated PDF.");
  }

  function handlePageLoadSuccess(page: PdfPageProxyLike) {
    if (page.pageNumber !== 1) {
      return;
    }

    const viewport = page.getViewport({ scale: 1 });

    setBasePageSize({ width: viewport.width, height: viewport.height });
  }

  function handlePageRenderSuccess(pageNumber: number) {
    if (pendingRestorePageRef.current !== pageNumber) {
      return;
    }

    pendingRestorePageRef.current = null;

    window.requestAnimationFrame(() => {
      scrollToPage(pageNumber);
      updateCurrentPage();
    });
  }

  async function handlePrintPdf() {
    if (!pdfUrl) {
      return;
    }

    setOpenMenu(null);

    try {
      const response = await fetch(pdfUrl);

      if (!response.ok) {
        throw new Error("Unable to load PDF for printing.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const frame = document.createElement("iframe");

      frame.style.position = "fixed";
      frame.style.right = "0";
      frame.style.bottom = "0";
      frame.style.width = "1px";
      frame.style.height = "1px";
      frame.style.border = "0";
      frame.src = objectUrl;

      frame.onload = () => {
        window.setTimeout(() => {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        }, 250);
      };

      document.body.appendChild(frame);

      window.setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(objectUrl);
      }, 60_000);
    } catch {
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
    }
  }

  const statusLabel =
    compileStatus === "compiling" ? "Compiling..."
      : compileStatus === "compiled" ? "Compiled"
        : compileStatus === "failed" ? "Compile failed"
          : "Compile";

  function renderStatusIcon() {
    if (compileStatus === "compiling") {
      return (
        <RotateCw className="pdf-status-spinner" size={17} />
      );
    }

    if (compileStatus === "compiled") {
      return <Check size={17} />;
    }

    if (compileStatus === "failed") {
      return <XCircle size={17} />;
    }

    return <RotateCw size={17} />;
  }

  function renderOpenPdfMenu() {
    if (!openMenu || typeof document === "undefined") {
      return null;
    }

    if (openMenu === "zoom") {
      return createPortal(
        <div
          className="pdf-menu pdf-zoom-menu"
          data-pdf-theme={settings.darkMode ? "dark" : "light"}
          style={{ top: menuPosition.top, left: menuPosition.left }}
          data-pdf-floating-menu
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className={`pdf-menu-item pdf-zoom-menu-item ${zoom === "fit" ? "is-selected" : ""}`}
            onClick={() => {
              setViewerZoom("fit");
              setOpenMenu(null);
            }}
          >
            <span>Zoom to fit</span>
            <span className="pdf-menu-shortcut">Ctrl0</span>
          </button>

          <div className="pdf-menu-separator" />

          <button
            type="button"
            className="pdf-menu-item pdf-zoom-menu-item"
            onClick={() => {
              handleZoomIn();
              setOpenMenu(null);
            }}
          >
            <span>Zoom in</span>
            <span className="pdf-menu-shortcut">Ctrl+</span>
          </button>

          <button
            type="button"
            className="pdf-menu-item pdf-zoom-menu-item"
            onClick={() => {
              handleZoomOut();
              setOpenMenu(null);
            }}
          >
            <span>Zoom out</span>
            <span className="pdf-menu-shortcut">Ctrl-</span>
          </button>

          <div className="pdf-menu-separator" />

          {PRESET_ZOOMS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`pdf-menu-item pdf-zoom-menu-item ${
                zoom === preset ? "is-selected" : ""
              }`}
              onClick={() => {
                setViewerZoom(preset);
                setOpenMenu(null);
              }}
            >
              <span>{preset}%</span>

              {zoom === preset ? (
                <Check size={16} />
              ) : null}
            </button>
          ))}
        </div>,
        document.body
      );
    }

    if (openMenu === "status") {
      return createPortal(
        <div
          className="pdf-menu pdf-status-menu"
          data-pdf-theme={settings.darkMode ? "dark" : "light"}
          style={{top: menuPosition.top, left: menuPosition.left}}
          data-pdf-floating-menu
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="pdf-menu-item"
            disabled={compileStatus === "compiling"}
            onClick={() => {
              setOpenMenu(null);
              onCompile();
            }}
          >
            <span>{compileStatus === "compiled" ? "Recompile PDF" : "Compile PDF"}</span>
          </button>
        </div>,
        document.body
      );
    }

    return createPortal(
      <div
        className="pdf-menu pdf-more-menu"
        data-pdf-theme={settings.darkMode ? "dark" : "light"}
        style={{top: menuPosition.top,left: menuPosition.left}}
        data-pdf-floating-menu
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="pdf-menu-item"
          disabled={!pdfUrl}
          onClick={() => {
            setOpenMenu(null);

            if (pdfUrl) {
              window.open(pdfUrl, "_blank", "noopener,noreferrer");
            }
          }}
        >
          <ExternalLink size={16} />
          <span>Open in new tab</span>
        </button>

        <button
          type="button"
          className="pdf-menu-item"
          disabled={!pdfUrl}
          onClick={() => void handlePrintPdf()}
        >
          <Printer size={16} />
          <span>Print PDF</span>
        </button>

        <div className="pdf-menu-separator" />

        <button
          type="button"
          className="pdf-menu-item"
          onClick={() => {
            rotateViewer(-90);
            setOpenMenu(null);
          }}
        >
          <RotateCcw size={16} />
          <span>Rotate counterclockwise</span>
        </button>

        <button
          type="button"
          className="pdf-menu-item"
          onClick={() => {
            rotateViewer(90);
            setOpenMenu(null);
          }}
        >
          <RotateCw size={16} />
          <span>Rotate clockwise</span>
        </button>
      </div>,
      document.body
    );
  }

  function renderPdfMenuShield() {
    if (!openMenu || typeof document === "undefined") {
      return null;
    }

    return createPortal(
      <div
        className="pdf-menu-interaction-shield"
        aria-hidden="true"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpenMenu(null);
        }}
      />,
      document.body
    );
  }

  return (
    <section
      ref={rootRef}
      className="pdf-viewer"
      data-pdf-theme={settings.darkMode ? "dark" : "light"}
    >
      {openMenu ? (
        <div
          className="pdf-menu-interaction-shield"
          aria-hidden="true"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpenMenu(null);
          }}
        />
      ) : null}
      <header className="pdf-viewer-toolbar">
        <div
          ref={statusMenuAnchorRef}
          className="pdf-status-menu-wrap pdf-tooltip-button"
          data-tooltip={
            compileStatus === "compiling" ? "Compiling..."
              : compileStatus === "compiled" ? "Recompile PDF"
                : compileStatus === "failed" ? "Compile PDF"
                  : "Compile PDF"
          }
          data-pdf-menu-root
        >
          <div
            className={`pdf-status-control is-${compileStatus}`}
          >
            <button
              type="button"
              className="pdf-status-main"
              disabled={compileStatus === "compiling"}
              onClick={onCompile}
            >
              {renderStatusIcon()}
              <span>{statusLabel}</span>
            </button>

            <button
              type="button"
              className="pdf-status-chevron"
              aria-label="Open compilation menu"
              aria-expanded={openMenu === "status"}
              onClick={() => toggleFloatingMenu("status")}>
              <ChevronDown size={16} />
            </button>
          </div>
        </div>

        <div className="pdf-viewer-toolbar-center">
          <div
            className="pdf-page-indicator"
            aria-label={numPages > 0 ? `Page ${currentPage} of ${numPages}` : "No PDF pages loaded"}>
            <input
              className="pdf-page-current-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="Current PDF page"
              value={numPages > 0 ? pageInput : ""}
              disabled={numPages === 0}
              onFocus={(event) => {
                pageInputFocusedRef.current = true;
                event.currentTarget.select();
              }}
              onBlur={() => {
                pageInputFocusedRef.current = false;
                commitPageInput();
              }}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
              onPaste={handlePageInputPaste}
            />

            <span className="pdf-page-of">of</span>

            <span>
              {numPages > 0 ? formatPageNumber(numPages) : "--"}
            </span>
          </div>

          <div
            ref={zoomMenuAnchorRef}
            className="pdf-zoom-menu-wrap pdf-tooltip-button"
            data-tooltip="Zoom"
            data-pdf-menu-root
          >
            <button
              type="button"
              className="pdf-zoom-trigger"
              aria-label="PDF zoom"
              aria-expanded={openMenu === "zoom"}
              onClick={() => toggleFloatingMenu("zoom")}>
              <ZoomFitIcon size={15} />
              <span>{zoomLabel}</span>
              <ChevronDown
                className={openMenu === "zoom" ? "is-open" : undefined}
                size={16}
              />
            </button>
          </div>
        </div>

        <div className="pdf-viewer-toolbar-actions">
          {downloadUrl ? (
            <a
              className="pdf-toolbar-icon-button pdf-tooltip-button"
              href={downloadUrl}
              aria-label="Download PDF"
              data-tooltip="Download PDF"
            >
              <CircleArrowDown size={18} />
            </a>
          ) : (
            <button
              type="button"
              className="pdf-toolbar-icon-button pdf-tooltip-button"
              aria-label="Download PDF"
              data-tooltip="Download PDF"
              disabled
            >
              <CircleArrowDown size={18} />
            </button>
          )}

          <div
            ref={moreMenuAnchorRef}
            className="pdf-more-menu-wrap"
            data-pdf-menu-root
          >
            <button
              type="button"
              className="pdf-toolbar-icon-button pdf-tooltip-button"
              aria-label="More PDF actions"
              data-tooltip="More PDF actions"
              aria-expanded={openMenu === "more"}
              disabled={!pdfUrl}
              onClick={() => toggleFloatingMenu("more")}
            >
              <Ellipsis size={19} />
            </button>
          </div>
        </div>
      </header>

      <div
        ref={viewportRef}
        className="pdf-viewer-viewport"
        onScroll={handleViewportScroll}
      >
        {pdfUrl ? (
          <Document
            key={pdfUrl}
            className="pdf-document"
            file={pdfUrl}
            loading={
              <div className="pdf-viewer-state">
                <LoaderCircle
                  className="pdf-status-spinner"
                  size={22}
                />
                <span>Loading PDF...</span>
              </div>
            }
            error={
              <div className="pdf-viewer-state is-error">
                <XCircle size={22} />
                <span>
                  {loadError ?? "Unable to load the generated PDF."}
                </span>
              </div>
            }
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
          >
            {pages.map((pageNumber) => (
              <div
                key={pageNumber}
                ref={(node) => {
                  if (node) {
                    pageRefs.current.set(pageNumber, node);
                  } else {
                    pageRefs.current.delete(pageNumber);
                  }
                }}
                className="pdf-page-shell"
                data-page-number={pageNumber}
              >
                <Page
                  className="pdf-rendered-page"
                  pageNumber={pageNumber}
                  width={pageWidth}
                  rotate={rotation}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  loading={null}
                  onLoadSuccess={handlePageLoadSuccess}
                  onRenderSuccess={() => handlePageRenderSuccess(pageNumber)}
                />
              </div>
            ))}
          </Document>
        ) : (
          <div className="pdf-viewer-state">
            <div className="pdf-empty-mark">PDF</div>
            <span>
              Compile the current Typst project to render a preview.
            </span>
          </div>
        )}

        {loading && pdfUrl ? (
          <div className="pdf-loading-overlay" aria-hidden="true" />
        ) : null}
      </div>

      {pdfUrl ? (
        <nav
          className="pdf-floating-navigation"
          aria-label="Compiled PDF history and source synchronization"
        >
          <span
            className="pdf-floating-tooltip-wrap pdf-tooltip-button pdf-tooltip-above"
            data-tooltip="Undo (Ctrl+Z)"
          >
            <button
              type="button"
              aria-label="Show previous compiled PDF"
              disabled={!canShowPreviousCompile || compileStatus === "compiling"}
              onClick={onShowPreviousCompile}
            >
              <RotateCcw size={18} />
            </button>
          </span>

          <span
            className="pdf-floating-tooltip-wrap pdf-tooltip-button pdf-tooltip-above"
            data-tooltip="Redo (Ctrl+Y)"
          >
            <button
              type="button"
              aria-label="Show next compiled PDF"
              disabled={!canShowNextCompile || compileStatus === "compiling"}
              onClick={onShowNextCompile}
            >
              <RotateCw size={18} />
            </button>
          </span>

          <span
            className="pdf-source-sync-placeholder pdf-tooltip-button pdf-tooltip-above"
            data-tooltip="Jump from PDF to Typst source"
            tabIndex={0}
          >
            <button
              type="button"
              aria-label="Jump from PDF to Typst source"
              disabled
            >
              <ChevronLeft size={20} />
            </button>
          </span>

          <span
            className="pdf-source-sync-placeholder pdf-tooltip-button pdf-tooltip-above"
            data-tooltip="Jump from Typst source to PDF"
            tabIndex={0}
          >
            <button
              type="button"
              aria-label="Jump from Typst source to PDF"
              disabled
            >
              <ChevronRight size={20} />
            </button>
          </span>
        </nav>
      ) : null}

      {renderOpenPdfMenu()}

      {tooltip && typeof document !== "undefined"
        ? createPortal(
            <div
              className={tooltip.placement === "above"
                ? "pdf-global-tooltip is-above"
                : "pdf-global-tooltip is-below"
              }
              style={{top: tooltip.top, left: tooltip.left}}
            >
              {tooltip.text}
            </div>, document.body
          )
        : null}

      {renderPdfMenuShield()}
    </section>
  );
}
