export interface EditorSession {
  openPaths: string[];
  activePath?: string;
}

const STORAGE_PREFIX = "typforge-editor-session-v1";

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}:${projectId}`;
}

export function loadEditorSession(projectId: string): EditorSession | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const stored = window.localStorage.getItem(storageKey(projectId));

    if (stored === null) {
      return undefined;
    }

    const parsed = JSON.parse(stored) as Partial<EditorSession>;

    const openPaths = Array.isArray(parsed.openPaths)
      ? Array.from(new Set(parsed.openPaths.filter((value): value is string => typeof value === "string" && value.trim().length > 0)))
      : [];

    const activePath = typeof parsed.activePath === "string" && openPaths.includes(parsed.activePath) ? parsed.activePath : undefined;

    return { openPaths, activePath };
  } catch {
    return undefined;
  }
}

export function saveEditorSession(projectId: string, session: EditorSession): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(session));
  } catch {
    /* Keep the in-memory editor session when storage is unavailable. */
  }
}

export function clearEditorSession(projectId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey(projectId));
  } catch {
    /* Nothing else is required when browser storage is unavailable. */
  }
}
