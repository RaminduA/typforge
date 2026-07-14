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

import type { ThemePreference } from "@/lib/theme";

interface SettingsModalProps {
  theme: ThemePreference;
  editorSettings: EditorSettings;
  onChangeTheme: (theme: ThemePreference) => void;
  onChangeEditorSettings: (settings: EditorSettings) => void;
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

export function SettingsModal({
  theme,
  editorSettings,
  onChangeTheme,
  onChangeEditorSettings,
  onClose
}: SettingsModalProps) {
  const [dictionaryWord, setDictionaryWord] = useState("");

  useEffect(() => {function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  function updateSetting<K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) {
    onChangeEditorSettings({
      ...editorSettings,
      [key]: value
    });
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
        <aside className="settings-navigation">
          <button type="button" className="settings-navigation-item active">
            <Code2 size={17} />
            <span>Editor</span>
          </button>

          <button type="button" className="settings-navigation-item" disabled>
            <FileText size={17} />
            <span>PDF Viewer</span>
          </button>

          <button type="button" className="settings-navigation-item" disabled>
            <FolderTree size={17} />
            <span>File Management</span>
          </button>

          <button type="button" className="settings-navigation-item" disabled>
            <Archive size={17} />
            <span>Data Controls</span>
          </button>

          <button type="button" className="settings-navigation-item" disabled>
            <Atom size={17} />
            <span>Beta features</span>
          </button>

          <button type="button" className="settings-navigation-item" disabled>
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
            <h2 id="settings-title">Editor</h2>
          </header>

          <div className="settings-options">
            <div className="settings-option-row">
              <div className="settings-option-copy">
                <h3>
                  Interface Theme
                </h3>

                <p>
                  Select your interface color scheme.
                </p>
              </div>

              <ThemeSelect value={theme} onChange={onChangeTheme} />
            </div>

            <div className="settings-option-row">
              <div className="settings-option-copy">
                <h3>
                  Language
                </h3>

                <p>
                  Choose the interface language. System default follows your browser settings.
                </p>
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
                <h3>
                  Font size
                </h3>

                <p>
                  Adjust the editor font size.
                </p>
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
                <h3>
                  Auto Formatting
                </h3>

                <p>
                  Automatically add the correct number of spaces before each code command
                </p>
              </div>

              <SettingsToggle
                label="Auto Formatting"
                checked={editorSettings.autoFormatting}
                onChange={(checked) => updateSetting("autoFormatting", checked)}
              />
            </div>

            <div className="settings-option-row">
              <div className="settings-option-copy">
                <h3>
                  Realtime compilation
                </h3>

                <p>
                  Automatically compile the document as you type
                </p>
              </div>

              <SettingsToggle
                label="Realtime compilation"
                checked={editorSettings.realtimeCompilation}
                onChange={(checked) => updateSetting("realtimeCompilation", checked)}
              />
            </div>

            <div className="settings-option-row">
              <div className="settings-option-copy">
                <h3>
                  Vim Mode
                </h3>

                <p>
                  Enable vim mode in the editor
                </p>
              </div>

              <SettingsToggle
                label="Vim Mode"
                checked={editorSettings.vimMode}
                onChange={(checked) => updateSetting("vimMode", checked)}
              />
            </div>

            <div className="settings-option-row">
              <div className="settings-option-copy">
                <h3>
                  Equation hover
                </h3>

                <p>
                  Show live equation previews when hovering LaTeX math.
                </p>
              </div>

              <SettingsToggle
                label="Equation hover"
                checked={editorSettings.equationHover}
                onChange={(checked) => updateSetting("equationHover", checked)}
              />
            </div>

            <div className="settings-option-row">
              <div className="settings-option-copy">
                <h3>
                  Disable Word Wrap
                </h3>

                <p>
                  Prevents lines from wrapping, requiring horizontal scrolling for long lines.
                </p>
              </div>

              <SettingsToggle
                label="Disable Word Wrap"
                checked={editorSettings.disableWordWrap}
                onChange={(checked) => updateSetting("disableWordWrap", checked)}
              />
            </div>

            <div className="settings-option-row">
              <div className="settings-option-copy">
                <h3>
                  Disable Sticky Scroll
                </h3>

                <p>
                  Keeps parent structures (sections, environments) visible while scrolling. Disable to stop headers from sticking to the top.
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
                <h3>
                  Editor spellcheck
                </h3>

                <p>
                  Underline possible misspellings for supported dictionary languages. Unsupported locales currently fall back to English.
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
                <h3>
                  Personal spellcheck dictionary
                </h3>

                <p>
                  Add words to your personal spellcheck dictionary. These words are stored in local settings and ignored across projects in this browser.
                </p>
              </div>

              <form
                className="settings-dictionary-form"
                onSubmit={handleDictionarySubmit}
              >
                <input
                  value={dictionaryWord}
                  placeholder="Add a word to ignore"
                  aria-label="Add a word to ignore"
                  onChange={(event) => setDictionaryWord(event.target.value)}
                />

                <button
                  type="submit"
                  aria-label="Add word"
                  title="Add word"
                >
                  <ListPlus size={18} />
                </button>
              </form>
            </div>
          </div>
        </main>
      </section>
    </div>
  );
}