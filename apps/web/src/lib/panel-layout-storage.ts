export const panelLayoutStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage failures, such as restricted browser storage.
    }
  }
} satisfies Pick<Storage, "getItem" | "setItem">;