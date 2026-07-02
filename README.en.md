# Auto Text Translator Browser Extension

[Chinese](README.md) | [English](README.en.md)

This is a Manifest V3 browser extension for quickly translating selected text on web pages. It does not require a build step or installed dependencies. You can load the source folder directly in Chrome, Edge, and other Chromium-based browsers through "Load unpacked".

## Project Summary

- The extension is built from `manifest.json`, a background service worker, content scripts, popup UI, options page, icons, and locale files.
- The current version can run directly from the source directory without `node_modules`.
- `package.json` only provides optional ZIP packaging scripts. It is not required at runtime.
- `.superpowers/`, `.worktrees/`, and `docs/superpowers/` are local development artifacts and are not required for GitHub publishing or extension installation.

## Features

- Shows a small translation trigger button after text is selected on a web page.
- Supports a context menu item: "Translate selected text".
- Provides a toolbar popup for manually entering and translating text.
- Supports automatic source language detection and common target language choices.
- Supports copying translation results, browser speech synthesis, character counting, and language swapping.
- Provides an options page for API fields, language settings, cache, context menu, shortcut, and behavior toggles.
- Includes `zh_CN` and `en` extension name and description locales.

## Tech Stack

- Manifest V3
- WebExtensions / Chrome Extension API
- Vanilla JavaScript, HTML, and CSS
- `chrome.storage.sync` for settings
- `chrome.contextMenus` for the right-click menu
- `chrome.runtime.sendMessage` for communication between content scripts, popup, options page, and background service worker

## How It Works

1. `content_scripts/content.js` is injected into web pages and listens for text selection.
2. After text is selected, a small translation trigger button appears near the selection.
3. Clicking the button, or using the context menu, sends a translation request to `background/background.js`.
4. The background service worker first calls the public Google Translate endpoint and falls back to MyMemory if that request fails.
5. The translated result is returned to the content script and displayed in an in-page floating popup.
6. `popup/` provides the toolbar translation panel, while `options/` provides the settings page.

> Note: the options page still contains fields for LibreTranslate, Google, and DeepL, but the current background translation logic does not dynamically switch by `apiService`. At runtime it uses the public Google Translate endpoint first, with MyMemory as fallback.

## Directory Structure

```text
auto-translator-extension/
├── manifest.json              # Browser extension manifest and entry configuration
├── background/
│   └── background.js          # Translation, cache, settings, and context menu logic
├── content_scripts/
│   ├── content.js             # Web page selection handling and translation popup logic
│   └── content.css            # Trigger button and popup styles
├── popup/
│   ├── popup.html             # Toolbar popup page
│   ├── popup.css              # Toolbar popup styles
│   └── popup.js               # Popup translation, copy, speech, and language logic
├── options/
│   ├── options.html           # Extension settings page
│   └── options.js             # Settings load, save, reset, and API test logic
├── icons/
│   ├── icon16.png             # 16px extension icon
│   ├── icon48.png             # 48px extension icon
│   └── icon128.png            # 128px extension icon
├── _locales/
│   ├── zh_CN/messages.json    # Chinese extension name and description
│   └── en/messages.json       # English extension name and description
├── README.md                  # Chinese project documentation
├── README.en.md               # English project documentation
├── TESTING.md                 # Manual test checklist
├── 使用教程.md                # Chinese user guide
├── package.json               # Optional ZIP packaging scripts
└── .gitignore                 # Git ignore rules
```

## Required Runtime Files

These files are required for the browser extension to load and run correctly:

| Path | Required | Purpose |
| --- | --- | --- |
| `manifest.json` | Yes | Declares extension permissions, entries, content scripts, popup, options page, and icons |
| `background/background.js` | Yes | Handles translation requests, caching, settings, and context menu setup |
| `content_scripts/content.js` | Yes | Injects page behavior, listens for selected text, and displays translation UI |
| `content_scripts/content.css` | Yes | Styles the in-page trigger button and translation popup |
| `popup/popup.html` | Yes | Toolbar popup structure |
| `popup/popup.css` | Yes | Toolbar popup styles |
| `popup/popup.js` | Yes | Toolbar popup translation, copy, speech, and settings logic |
| `options/options.html` | Yes | Options page structure |
| `options/options.js` | Yes | Options page settings save, reset, and API test logic |
| `icons/*.png` | Yes | Extension icons |
| `_locales/*/messages.json` | Yes | Locale messages used by `__MSG_appName__` and `__MSG_appDesc__` in `manifest.json` |

Recommended files for GitHub publishing:

| Path | Purpose |
| --- | --- |
| `README.md` | Chinese GitHub project overview |
| `README.en.md` | English GitHub project overview |
| `使用教程.md` | Chinese user guide |
| `TESTING.md` | Manual testing checklist |
| `package.json` | Optional packaging scripts |
| `.gitignore` | Keeps temporary files, dependencies, and build outputs out of Git |

Not recommended for the GitHub publishing folder:

| Path | Reason |
| --- | --- |
| `.git/` | Local Git repository metadata |
| `.superpowers/` | Local agent workspace data |
| `.worktrees/` | Local worktrees and generated archives |
| `docs/superpowers/` | Process documents that are not required for installing or running the extension |
| `node_modules/` | Dependencies are not required by the current project |
| `dist/`, `build/`, `*.zip` | Generated artifacts that can be rebuilt when needed |

## Installation

### Chrome / Edge

1. Open the extension management page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
2. Enable "Developer mode".
3. Click "Load unpacked".
4. Select the folder that contains `manifest.json`.

### Firefox

This project currently uses Manifest V3 and `chrome.*` APIs, so it primarily targets Chrome and Edge. Firefox compatibility should be verified against the target Firefox version before publishing.

## Usage

### Translate Selected Text On A Web Page

1. Select text on a web page.
2. A small translation trigger button appears near the selected text.
3. Click the trigger button.
4. View the translation popup, then copy or speak the translated result if needed.

### Translate From The Context Menu

1. Select text on a web page.
2. Right-click the selection.
3. Choose "Translate selected text".

### Translate From The Toolbar Popup

1. Click the extension icon in the browser toolbar.
2. Type or paste the text to translate.
3. Select source and target languages.
4. Click "Translate".

### Options Page

Open the options page from the popup settings button or the browser extension management page. You can configure:

- Translation service fields
- API endpoint and API key fields
- Target language
- Auto selection translation toggle
- Translation popup toggle
- Cache toggle
- Context menu toggle
- Shortcut toggle
- Debounce delay and cache size

## Development

This project has no dependency installation step. After changing source files, reload the extension from the browser extension management page to test the changes.

To create a ZIP package on a system with the `zip` command available, run:

```bash
npm run build:chrome
```

or:

```bash
npm run build:firefox
```

## Testing

Use `TESTING.md` as the manual testing checklist. Important checks include:

- The extension loads successfully.
- Selecting text on a web page shows the trigger button.
- Clicking the trigger button shows a translation popup.
- The context menu can trigger translation.
- The toolbar popup can translate manually entered text.
- The options page can save and reset settings.
- Network failures show error messages instead of silently failing.

## GitHub Publishing Folder

The `github/` directory contains the source and documentation files prepared for publishing to GitHub. Check the contents of that folder before initializing or pushing a remote repository.

## License

This README keeps the original MIT License note. Before publishing as an open source project, consider adding a standalone `LICENSE` file.
