export interface PdfViewerSettings {
  darkMode: boolean;
  zoomShortcuts: boolean;
}

export const DEFAULT_PDF_VIEWER_SETTINGS: PdfViewerSettings = {
  darkMode: false,
  zoomShortcuts: true
};

const STORAGE_KEY = "typforge-pdf-viewer-settings-v1";

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function loadPdfViewerSettings(): PdfViewerSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_PDF_VIEWER_SETTINGS };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return { ...DEFAULT_PDF_VIEWER_SETTINGS };
    }

    const parsed = JSON.parse(stored) as Partial<PdfViewerSettings>;

    return {
      darkMode: readBoolean(
        parsed.darkMode,
        DEFAULT_PDF_VIEWER_SETTINGS.darkMode
      ),
      zoomShortcuts: readBoolean(
        parsed.zoomShortcuts,
        DEFAULT_PDF_VIEWER_SETTINGS.zoomShortcuts
      )
    };
  } catch {
    return { ...DEFAULT_PDF_VIEWER_SETTINGS };
  }
}

export function savePdfViewerSettings(settings: PdfViewerSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    
  }
}
