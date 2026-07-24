"use client";

import {
  Archive,
  Atom,
  Code2,
  FileText,
  FolderTree,
  ListPlus,
  Share2,
  X
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import { SettingsSelect, type SettingsSelectOption } from "@/components/ui/SettingsSelect";
import { SettingsToggle } from "@/components/ui/SettingsToggle";
import { ThemeSelect } from "@/components/ui/ThemeSelect";
import type { EditorFontSize, EditorLanguage, EditorSettings } from "@/lib/editor-settings";
import type { PdfViewerSettings } from "@/lib/pdf-viewer-settings";
import type { ThemePreference } from "@/lib/theme";

type SettingsSection =
  | "editor"
  | "pdf-viewer"
  | "file-management"
  | "data-controls"
  | "beta-features"
  | "integrations";

interface SettingsModalProps {
  theme: ThemePreference;
  editorSettings: EditorSettings;
  pdfViewerSettings: PdfViewerSettings;
  onChangeTheme: (theme: ThemePreference) => void;
  onChangeEditorSettings: (settings: EditorSettings) => void;
  onChangePdfViewerSettings: (settings: PdfViewerSettings) => void;
  onClose: () => void;
}

const languageOptions: ReadonlyArray<SettingsSelectOption<EditorLanguage>> = [
  { value: "system", label: "System default" },
  { value: "english", label: "English" },
  { value: "simplified-chinese", label: "简体中文" },
  { value: "traditional-chinese", label: "繁體中文" },
  { value: "korean", label: "한국어" },
  { value: "french", label: "Français" },
  { value: "german", label: "Deutsch" },
  { value: "spanish", label: "Español" },
  { value: "japanese", label: "日本語" },
  { value: "italian", label: "Italiano" },
  { value: "russian", label: "Русский" },
  { value: "portuguese", label: "Português" },
  { value: "hindi", label: "हिन्दी" }
];

const fontSizeOptions: ReadonlyArray<SettingsSelectOption<EditorFontSize>> = [
  { value: "small", label: "Small" },
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
  { value: "very-large", label: "Very Large" }
];

const sectionTitles: Record<SettingsSection, string> = {
  editor: "Editor",
  "pdf-viewer": "PDF Viewer",
  "file-management": "File Management",
  "data-controls": "Data Controls",
  "beta-features": "Beta features",
  integrations: "Integrations"
};

export function SettingsModal({
  theme,
  editorSettings,
  pdfViewerSettings,
  onChangeTheme,
  onChangeEditorSettings,
  onChangePdfViewerSettings,
  onClose
}: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("editor");
  const [dictionaryWord, setDictionaryWord] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 768px)");

    function updateMobileState(matches: boolean) {
      setIsMobile(matches);

      if (!matches) {
        setActiveSection((current) =>
          current === "editor" || current === "pdf-viewer" ? current : "editor"
        );
      }
    }

    updateMobileState(mobileQuery.matches);

    function handleMobileChange(event: MediaQueryListEvent) {
      updateMobileState(event.matches);
    }

    mobileQuery.addEventListener("change", handleMobileChange);

    return () => {
      mobileQuery.removeEventListener("change", handleMobileChange);
    };
  }, []);

  function updateSetting<K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) {
    onChangeEditorSettings({ ...editorSettings, [key]: value });
  }

  function updatePdfViewerSetting<K extends keyof PdfViewerSettings>(
    key: K,
    value: PdfViewerSettings[K]
  ) {
    onChangePdfViewerSettings({ ...pdfViewerSettings, [key]: value });
  }

  function handleDictionarySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const word = dictionaryWord.trim();

    if (!word) {
      return;
    }

    const exists = editorSettings.personalDictionary.some(
      (existing) => existing.toLocaleLowerCase() === word.toLocaleLowerCase()
    );

    if (!exists) {
      updateSetting("personalDictionary", [...editorSettings.personalDictionary, word]);
    }

    setDictionaryWord("");
  }

  return (
    <div
      className="settings-backdrop app-blur-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="settings-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <aside className="settings-navigation" aria-label="Settings sections">
          <button
            type="button"
            className={`settings-navigation-item ${activeSection === "editor" ? "active" : ""}`}
            onClick={() => setActiveSection("editor")}
          >
            <Code2 size={17} />
            <span>Editor</span>
          </button>

          <button
            type="button"
            className={`settings-navigation-item ${activeSection === "pdf-viewer" ? "active" : ""}`}
            onClick={() => setActiveSection("pdf-viewer")}
          >
            <FileText size={17} />
            <span>PDF Viewer</span>
          </button>

          <button
            type="button"
            className={`settings-navigation-item ${activeSection === "file-management" ? "active" : ""}`}
            disabled={!isMobile}
            onClick={() => setActiveSection("file-management")}
          >
            <FolderTree size={17} />
            <span>File Management</span>
          </button>

          <button
            type="button"
            className={`settings-navigation-item ${activeSection === "data-controls" ? "active" : ""}`}
            disabled={!isMobile}
            onClick={() => setActiveSection("data-controls")}
          >
            <Archive size={17} />
            <span>Data Controls</span>
          </button>

          <button
            type="button"
            className={`settings-navigation-item ${activeSection === "beta-features" ? "active" : ""}`}
            disabled={!isMobile}
            onClick={() => setActiveSection("beta-features")}
          >
            <Atom size={17} />
            <span>Beta features</span>
          </button>

          <button
            type="button"
            className={`settings-navigation-item ${activeSection === "integrations" ? "active" : ""}`}
            disabled={!isMobile}
            onClick={() => setActiveSection("integrations")}
          >
            <Share2 size={17} />
            <span>Integrations</span>
          </button>
        </aside>

        <button
          type="button"
          className="settings-close-button"
          aria-label="Close settings"
          title="Close"
          onClick={onClose}
        >
          <X size={18} />
        </button>

        <main className="settings-content">
          <header className="settings-content-header">
            <h2 id="settings-title">{sectionTitles[activeSection]}</h2>

            {activeSection === "beta-features" ? (
              <span className="settings-beta-pill">Early access</span>
            ) : null}
          </header>

          {activeSection === "editor" ? (
            <div className="settings-options">
              <div className="settings-option-row">
                <div className="settings-option-copy">
                  <h3>Interface Theme</h3>
                  <p>Select your interface color scheme.</p>
                </div>

                <ThemeSelect value={theme} onChange={onChangeTheme} />
              </div>

              <div className="settings-option-row">
                <div className="settings-option-copy">
                  <h3>Language</h3>
                  <p>Choose the interface language. System default follows your browser settings.</p>
                </div>

                <SettingsSelect
                  value={editorSettings.language}
                  options={languageOptions}
                  ariaLabel="Interface language"
                  onChange={(value) => updateSetting("language", value)}
                />
              </div>

              <div className="settings-option-row">
                <div className="settings-option-copy">
                  <h3>Font size</h3>
                  <p>Adjust the editor font size.</p>
                </div>

                <SettingsSelect
                  value={editorSettings.fontSize}
                  options={fontSizeOptions}
                  ariaLabel="Editor font size"
                  onChange={(value) => updateSetting("fontSize", value)}
                />
              </div>

              <div className="settings-option-row">
                <div className="settings-option-copy">
                  <h3>Auto Formatting</h3>
                  <p>Automatically add the correct number of spaces before each code command</p>
                </div>

                <SettingsToggle
                  label="Auto Formatting"
                  checked={editorSettings.autoFormatting}
                  onChange={(checked) => updateSetting("autoFormatting", checked)}
                />
              </div>

              <div className="settings-option-row">
                <div className="settings-option-copy">
                  <h3>Realtime compilation</h3>
                  <p>Automatically compile the document as you type</p>
                </div>

                <SettingsToggle
                  label="Realtime compilation"
                  checked={editorSettings.realtimeCompilation}
                  onChange={(checked) => updateSetting("realtimeCompilation", checked)}
                />
              </div>

              <div className="settings-option-row">
                <div className="settings-option-copy">
                  <h3>Vim Mode</h3>
                  <p>Enable vim mode in the editor</p>
                </div>

                <SettingsToggle
                  label="Vim Mode"
                  checked={editorSettings.vimMode}
                  onChange={(checked) => updateSetting("vimMode", checked)}
                />
              </div>

              <div className="settings-option-row">
                <div className="settings-option-copy">
                  <h3>Equation hover</h3>
                  <p>Show live equation previews when hovering LaTeX math.</p>
                </div>

                <SettingsToggle
                  label="Equation hover"
                  checked={editorSettings.equationHover}
                  onChange={(checked) => updateSetting("equationHover", checked)}
                />
              </div>

              <div className="settings-option-row">
                <div className="settings-option-copy">
                  <h3>Disable Word Wrap</h3>
                  <p>Prevents lines from wrapping, requiring horizontal scrolling for long lines.</p>
                </div>

                <SettingsToggle
                  label="Disable Word Wrap"
                  checked={editorSettings.disableWordWrap}
                  onChange={(checked) => updateSetting("disableWordWrap", checked)}
                />
              </div>

              <div className="settings-option-row">
                <div className="settings-option-copy">
                  <h3>Disable Sticky Scroll</h3>
                  <p>
                    Keeps parent structures (sections, environments) visible while scrolling.
                    Disable to stop headers from sticking to the top.
                  </p>
                </div>

                <SettingsToggle
                  label="Disable Sticky Scroll"
                  checked={editorSettings.disableStickyScroll}
                  onChange={(checked) => updateSetting("disableStickyScroll", checked)}
                />
              </div>

              <div className="settings-option-row">
                <div className="settings-option-copy">
                  <h3>Editor spellcheck</h3>
                  <p>
                    Underline possible misspellings for supported dictionary languages.
                    Unsupported locales currently fall back to English.
                  </p>
                </div>

                <SettingsToggle
                  label="Editor spellcheck"
                  checked={editorSettings.editorSpellcheck}
                  onChange={(checked) => updateSetting("editorSpellcheck", checked)}
                />
              </div>

              <div className="settings-option-column">
                <div className="settings-option-copy">
                  <h3>Personal spellcheck dictionary</h3>
                  <p>
                    Add words to your personal spellcheck dictionary. These words are stored in
                    local settings and ignored across projects in this browser.
                  </p>
                </div>

                <form className="settings-dictionary-form" onSubmit={handleDictionarySubmit}>
                  <input
                    value={dictionaryWord}
                    placeholder="Add a word to ignore"
                    aria-label="Add a word to ignore"
                    onChange={(event) => setDictionaryWord(event.target.value)}
                  />

                  <button type="submit" aria-label="Add word" title="Add word">
                    <ListPlus size={18} />
                  </button>
                </form>
              </div>
            </div>
          ) : activeSection === "pdf-viewer" ? (
            <div className="settings-options">
              <div className="settings-option-row">
                <div className="settings-option-copy">
                  <h3>PDF Dark Mode</h3>
                  <p>
                    Enable “Dark Mode” for the PDF viewer by inverting the rendered document
                    colors. This setting affects only the PDF viewer; the Tools pane continues to
                    follow the app theme.
                  </p>
                </div>

                <SettingsToggle
                  label="PDF Dark Mode"
                  checked={pdfViewerSettings.darkMode}
                  onChange={(checked) => updatePdfViewerSetting("darkMode", checked)}
                />
              </div>

              <div className="settings-option-row">
                <div className="settings-option-copy">
                  <h3>PDF Zoom Shortcuts</h3>
                  <p>
                    Override the browser’s zoom shortcuts (Cmd/Ctrl +/−/0) to zoom the PDF viewer
                    instead.
                  </p>
                </div>

                <SettingsToggle
                  label="PDF Zoom Shortcuts"
                  checked={pdfViewerSettings.zoomShortcuts}
                  onChange={(checked) => updatePdfViewerSetting("zoomShortcuts", checked)}
                />
              </div>
            </div>
          ) : activeSection === "file-management" ? (
            <div className="settings-placeholder-section">
              <p>File management preferences will be available here in a future update.</p>
            </div>
          ) : activeSection === "data-controls" ? (
            <div className="settings-options settings-data-controls-options">
              <div className="settings-option-row">
                <div className="settings-option-copy">
                  <h3>Export all projects (zip)</h3>
                </div>

                <button
                  type="button"
                  className="settings-action-button"
                  disabled
                  title="The current API supports exporting one project at a time only"
                >
                  Download zip
                </button>
              </div>
            </div>
          ) : activeSection === "beta-features" ? (
            <div className="settings-options settings-beta-options">
              <div className="settings-option-copy settings-intro-copy">
                <p>Choose whether your account can receive beta Prism features.</p>
              </div>

              <div className="settings-option-row">
                <div className="settings-option-copy">
                  <h3>Join the beta program</h3>
                  <p>Get early access to Prism features that are still in development.</p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-label="Join the beta program"
                  aria-checked="false"
                  className="settings-toggle"
                  disabled
                >
                  <span className="settings-toggle-thumb" />
                </button>
              </div>

              <div className="settings-note-card">
                Beta features may change or be removed. Some features are released gradually,
                even after you opt in.
              </div>
            </div>
          ) : (
            <div className="settings-placeholder-section">
              <p>Integrations will be available here in a future update.</p>
            </div>
          )}
        </main>
      </section>
    </div>
  );
}
