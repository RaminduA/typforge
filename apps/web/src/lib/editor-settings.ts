export type EditorLanguage =
  | "system"
  | "english"
  | "simplified-chinese"
  | "traditional-chinese"
  | "korean"
  | "french"
  | "german"
  | "spanish"
  | "japanese"
  | "italian"
  | "russian"
  | "portuguese"
  | "hindi";

export type EditorFontSize =
  | "small"
  | "normal"
  | "large"
  | "very-large";

export interface EditorSettings {
  language: EditorLanguage;

  fontSize: EditorFontSize;

  autoFormatting: boolean;

  realtimeCompilation: boolean;

  vimMode: boolean;

  equationHover: boolean;

  disableWordWrap: boolean;

  disableStickyScroll: boolean;

  editorSpellcheck: boolean;

  personalDictionary: string[];
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  language: "system",

  fontSize: "normal",

  autoFormatting: false,

  realtimeCompilation: false,

  vimMode: false,

  /*
   * Intentionally disabled by default.
   * The UI exists, but equation previews
   * are not implemented yet.
   */
  equationHover: false,

  disableWordWrap: false,

  disableStickyScroll: false,

  editorSpellcheck: false,

  personalDictionary: []
};

export const EDITOR_FONT_SIZE_PIXELS: Record<EditorFontSize, string> = {
  small: "12px",

  normal: "14px",

  large: "16px",

  "very-large": "18px"
};

const STORAGE_KEY = "typforge-editor-settings-v1";

const validLanguages: EditorLanguage[] = [
  "system",
  "english",
  "simplified-chinese",
  "traditional-chinese",
  "korean",
  "french",
  "german",
  "spanish",
  "japanese",
  "italian",
  "russian",
  "portuguese",
  "hindi"
];

const validFontSizes: EditorFontSize[] = [
  "small",
  "normal",
  "large",
  "very-large"
];

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function loadEditorSettings(): EditorSettings {
  if (typeof window === "undefined") {
    return {
      ...DEFAULT_EDITOR_SETTINGS,

      personalDictionary: []
    };
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return {
        ...DEFAULT_EDITOR_SETTINGS,

        personalDictionary: []
      };
    }

    const parsed = JSON.parse(stored) as Partial<EditorSettings>;

    return {
      language: validLanguages.includes(parsed.language as EditorLanguage)
        ? parsed.language as EditorLanguage
        : DEFAULT_EDITOR_SETTINGS.language,

      fontSize: validFontSizes.includes(parsed.fontSize as EditorFontSize)
        ? parsed.fontSize as EditorFontSize
        : DEFAULT_EDITOR_SETTINGS.fontSize,

      autoFormatting: readBoolean(parsed.autoFormatting, DEFAULT_EDITOR_SETTINGS.autoFormatting),

      realtimeCompilation: readBoolean(parsed.realtimeCompilation, DEFAULT_EDITOR_SETTINGS.realtimeCompilation),

      vimMode: readBoolean(parsed.vimMode, DEFAULT_EDITOR_SETTINGS.vimMode),

      equationHover: readBoolean(parsed.equationHover, DEFAULT_EDITOR_SETTINGS.equationHover),

      disableWordWrap: readBoolean(parsed.disableWordWrap, DEFAULT_EDITOR_SETTINGS.disableWordWrap),

      disableStickyScroll: readBoolean(parsed.disableStickyScroll, DEFAULT_EDITOR_SETTINGS.disableStickyScroll),

      editorSpellcheck: readBoolean(parsed.editorSpellcheck, DEFAULT_EDITOR_SETTINGS.editorSpellcheck),

      personalDictionary: Array.isArray(parsed.personalDictionary)
        ? parsed.personalDictionary.filter((value): value is string => typeof value === "string")
        : []
    };
  } catch {
    return {
      ...DEFAULT_EDITOR_SETTINGS,

      personalDictionary: []
    };
  }
}

export function saveEditorSettings(settings: EditorSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /*
     * The settings remain active for the current session even if browser storage is blocked.
     */
  }
}