# AGENTS.md — SoundKeys Architecture & AI Developer Guidelines

Welcome to **SoundKeys**! This document serves as the authoritative guide for AI agents and human developers maintaining and expanding this repository.

---

## ⚠️ MANDATORY RULES FOR ALL AGENTS
> [!IMPORTANT]
> 1. **FEATURE REGISTRY MAINTENANCE**: Whenever you implement, modify, or plan a new feature, you **MUST update the Feature Registry table in this document (`AGENTS.md`)** before concluding your task.
> 2. **VERSION SYNCHRONIZATION**:
>    - **Major Changes**: Increment the major version number (`X.0.0`).
>    - **Minor / Subversion Changes**: Increment the minor version number (`1.X.0` or `3.X.0`).
>    - **Strict Synchronization**: You **MUST keep version numbers identical across all files**: `package.json`, `.github/workflows/build.yml`, `Sidebar.jsx`, `Settings.jsx`, and `AGENTS.md`. (Current version: `3.3.0`).

---

## Project Overview & Design Philosophy

**SoundKeys** is a feature-rich, high-performance Windows desktop application that plays tactile, customizable audio feedback on system-wide keyboard (and optional mouse) events.

- **Stack**: Electron + React + Vite + Howler.js + uiohook-napi + sql.js + Recharts
- **Aesthetic**: Premium dark neon / glassmorphism UI with vibrant real-time visualizers and smooth micro-animations.
- **Author**: Apoorv Nema

---

## Architecture Blueprint

```
SoundKeys/
├── AGENTS.md                    ← [THIS FILE] Guide & feature registry
├── package.json                 ← Node dependencies & scripts
├── electron.vite.config.mjs     ← Vite + Electron build setup
├── electron-builder.json5       ← Portable & NSIS packaging rules
├── scripts/
│   ├── create-cert.ps1          ← Self-signed code signing certificate generator
│   └── generate-piano.js        ← ADSR tone synthesis for Piano theme notes
│
├── src/
│   ├── main/
│   │   ├── index.js             ← Electron main process (tray, IPC, keyhook, window management)
│   │   └── analytics.js         ← SQLite Analytics Engine (sql.js WASM)
│   ├── preload/
│   │   └── index.js             ← ContextBridge IPC wrapper (window.soundkeys)
│   └── renderer/                ← React 18 UI
│       ├── index.html
│       └── src/
│           ├── App.jsx          ← Main application container & IPC hooks
│           ├── components/
│           │   ├── AudioEngine.jsx  ← Howler.js low-latency audio player
│           │   ├── HotkeyBindingsPanel.jsx ← Custom hotkey sound bindings editor
│           │   ├── PianoKeyboard.jsx ← Interactive white/black key piano component
│           │   ├── Sidebar.jsx      ← Navigation panel
│           │   └── ThemeCreatorModal.jsx ← Custom theme creator/editor
│           ├── pages/
│           │   ├── Dashboard.jsx    ← Orb visualizer & live keypress stats
│           │   ├── Analytics.jsx    ← SQLite analytics tab & interactive charts
│           │   ├── KeyboardLayout.jsx ← Key Overrides & tester
│           │   ├── PianoPractice.jsx ← Synthesia MIDI waterfall & freestyle mode
│           │   ├── Settings.jsx     ← Preferences, feature log, data dir, system toggles
│           │   ├── Store.jsx        ← Sound pack store & installed themes manager
│           │   └── TypingTest.jsx   ← WPM speed test & AI paragraph generator
│           └── styles/
│               └── index.css        ← Design system tokens & styles
│
└── sounds/
    ├── store/                   ← Bundled sound pack store assets (Piano, Typewriter)
    └── themes/                  ← User sound pack playlists (copied to user dataDir)
        ├── default/             ← SoundKeys Classic
        └── ...
```

---

## Feature Registry

| Feature ID | Feature Name | Description | Status | Added / Updated |
|---|---|---|---|---|
| **FEAT-001** | Global Key Hook | Intercepts system-wide keyboard events using `uiohook-napi` | ✅ Operational | v1.0.0 |
| **FEAT-002** | Audio Engine | Low-latency audio playback with Howler.js (file:// protocol) | ✅ Operational | v1.0.0 |
| **FEAT-003** | System Tray | Quick mute toggle, theme selection menu, restore window | ✅ Operational | v1.0.0 |
| **FEAT-004** | Dynamic Tray Color | Tray icon changes (Green when active & playing, Red when muted) | ✅ Operational | v1.0.0 |
| **FEAT-005** | Global Hotkey | `Ctrl+Shift+S` global shortcut to toggle mute from any application | ✅ Operational | v1.0.0 |
| **FEAT-006** | Taskbar Visibility Toggle | Option to hide/show app in Windows Taskbar (`skipTaskbar`) | ✅ Operational | v1.0.0 |
| **FEAT-007** | Close Action Toggle | Preference for close button: Minimize to Tray vs Quit App | ✅ Operational | v1.0.0 |
| **FEAT-008** | Custom Theme Playlist Creator | UI modal to create & import custom sound packs directly in app | ✅ Operational | v1.0.0 |
| **FEAT-009** | Heatmap & Visualizer | Real-time pulsing visualizer & keypress stats counter | ✅ Operational | v1.0.0 |
| **FEAT-010** | Rebranded Default Theme | Rebranded to "SoundKeys Classic" (no Opera GX references) | ✅ Operational | v1.0.0 |
| **FEAT-011** | Windows Autostart | `app.setLoginItemSettings()` native Windows Registry autostart | ✅ Operational | v1.0.0 |
| **FEAT-012** | Custom SoundKeys Icon | Custom application window and desktop packaging icon | ✅ Operational | v1.0.0 |
| **FEAT-013** | Interactive Hotkey Rebinder | Rebind global mute shortcut via UI listener | ✅ Operational | v1.0.0 |
| **FEAT-014** | Red Muted Visual Theme | Vibrant Red orb, glow rings, indicators and tray icon when muted | ✅ Operational | v1.0.0 |
| **FEAT-015** | Taskbar Overlay Badge | Green/Red dot badge on Windows taskbar icon reflects mute state in real-time | ✅ Operational | v1.1.0 |
| **FEAT-016** | Tray Quick Settings | Right-click tray shows Start with Windows toggle & Dynamic Status Icon toggle | ✅ Operational | v1.1.0 |
| **FEAT-017** | GitHub Actions Pipeline | CI/CD pipeline (`.github/workflows/build.yml`) builds & publishes Windows portable and setup binaries to GitHub Releases on push to master | ✅ Operational | v1.1.0 |
| **FEAT-018** | Unified Data Directory | Single customizable directory storing settings, sound themes, and analytics DB. Relocate anytime via Settings. | ✅ Operational | v1.2.0 |
| **FEAT-019** | SQLite Analytics Engine | WASM SQLite database (`sql.js`) logging keypresses, hourly activity, daily trends, and letter frequencies | ✅ Operational | v1.2.0 |
| **FEAT-020** | Analytics Dashboard & Charts | Interactive Recharts dashboard with Today Hourly bar chart, 30-Day Trend line chart, and A-Z Key Heatmap grid | ✅ Operational | v1.2.0 |
| **FEAT-021** | Analytics Export & Purge | CSV data export tool and configurable MB limit with date-range purge controls | ✅ Operational | v1.2.0 |
| **FEAT-022** | Accurate Key Name Display | Display exact key names (A, B, Enter, Space, F1, etc.) on Dashboard instead of generic category labels | ✅ Operational | v1.2.0 |
| **FEAT-023** | WPM Audit & Session Reset | Refined WPM calculation (typing keys only) + session counter reset button + seeded today count from SQLite DB | ✅ Operational | v1.2.0 |
| **FEAT-024** | Playlist Edit & Delete | Edit custom theme configs/sounds and delete custom themes directly from Settings | ✅ Operational | v1.2.0 |
| **FEAT-025** | Multi-Sound Typing Pool | Dynamic typing sound slots in theme creator allowing random sound selection per keypress (OperaGX style) | ✅ Operational | v1.2.0 |
| **FEAT-026** | CI Automatic Native Packaging & Signing | GitHub Actions workflow relies on `electron-builder` native module resolution, preventing node-gyp Visual Studio compiler errors while signing builds with `CSC_LINK` | ✅ Operational | v1.2.0 |
| **FEAT-027** | Directory Reset & Fallback | Reset Data Directory to default location (%APPDATA%) + auto-fallback to default if custom directory is deleted | ✅ Operational | v1.2.0 |
| **FEAT-028** | Subdirectory Migration Guard & Icon Tracking | Prevent recursive data directory migration into nested subfolders + tracked build/ icon assets for GitHub Actions | ✅ Operational | v1.2.1 |
| **FEAT-029** | Typing Test Page | Full WPM typing speed test with timed (15s/30s/60s/120s) & passage modes, character-by-character colour coding, live stats, confetti on personal best | ✅ Operational | v2.0.0 |
| **FEAT-030** | Gemini AI Paragraph Generator | Secure Gemini API integration (main process only) generating paragraphs by category grid or custom prompt at Easy/Medium/Hard difficulty; built-in offline fallback | ✅ Operational | v2.0.0 |
| **FEAT-031** | Paragraph Library | Save, delete, import and export typing paragraphs as JSON; tracks times used per entry | ✅ Operational | v2.0.0 |
| **FEAT-032** | Typing Session Analytics | SQLite `typing_sessions` table logging every test; WPM trend chart, difficulty breakdown bar chart, and session history table in Analytics page | ✅ Operational | v2.0.0 |
| **FEAT-033** | Gemini API Key Settings | Encrypted key storage via `electron-store`; key never sent to renderer; Show/Hide toggle, Save, Clear; status badge in Settings | ✅ Operational | v2.0.0 |
| **FEAT-034** | Keyboard Layout Manager & Tester | Interactive 104-key visual keyboard page to disable/mute specific keys, override sound categories, assign external audio files, and test real-time key glow/unglow | ✅ Operational | v2.1.0 |
| **FEAT-035** | Hotkey Sound Bindings | Assign custom sounds to key shortcuts (e.g., Ctrl+C, Ctrl+Shift+Alt+Q+S); shortcut match suppresses regular keypress sound | ✅ Operational | v3.0.0 |
| **FEAT-036** | Feature Log in Settings | Versioned changelog inside Settings showing all 39 features grouped by version with search filter | ✅ Operational | v3.0.0 |
| **FEAT-037** | Sound Pack & Theme Store | Dedicated sidebar Store page with Browse + My Themes tabs; absorbs theme management from Settings; local-first, ready for online expansion | ✅ Operational | v3.0.0 |
| **FEAT-038** | Piano Per-Key Theme | ADSR-synthesized WAV per keycode mapped via `perKeyMapping` schema with C3-C7 pitch range | ✅ Operational | v3.0.0 |
| **FEAT-039** | Piano Practice Page | Synthesia-style MIDI waterfall + freestyle piano mode; per-key glow visualizer; MIDI file loader with transport controls | ✅ Operational | v3.0.0 |
| **FEAT-040** | Interactive Click-to-Play Piano Keys | Play piano notes on click/touch with per-key acoustic WAV samples and low-latency Web Audio synthesizer fallback | ✅ Operational | v3.1.0 |
| **FEAT-041** | Piano Octave Shift Control | Interactive octave transpose controls (-2 to +2 octaves) shifting both keyboard key mapping and audio pitch across the full piano range | ✅ Operational | v3.1.0 |
| **FEAT-042** | Comprehensive Piano Key & Note Labels | Real-time dual label display showing exact piano note names (e.g., C4, D#4) and mapped computer keyboard shortcuts on all white and black keys | ✅ Operational | v3.1.0 |
| **FEAT-043** | Waterfall Play-Along Audio Engine | Synchronized audio playback as falling MIDI notes hit the trigger line with real-time key glow and simultaneous user play-along support | ✅ Operational | v3.1.0 |
| **FEAT-044** | Piano Click Scroll Fix | Removed erroneous auto-scroll on click; piano scrolls only on practice cluster advance via controlled `scrollToCenterMidi` prop | ✅ Operational | v3.2.0 |
| **FEAT-045** | Left / Right / Both Hand Filter | Filter waterfall and practice mode by MIDI channel hand: Both, Right hand (ch1/treble), or Left hand (ch2/bass) — affects display and audio | ✅ Operational | v3.2.0 |
| **FEAT-046** | Practice Mode Chord Note Display | Prominent real-time chord display panel with large note name pills, per-note hit checkmarks, chord vs single-note label, and progress bar | ✅ Operational | v3.2.0 |
| **FEAT-047** | Fullscreen Piano Practice | One-click fullscreen toggle button in Piano Practice header; ESC also exits; icon changes to reflect current state | ✅ Operational | v3.2.0 |
| **FEAT-048** | Salamander Grand Piano Integration Script | Node.js helper script (`scripts/download-piano-samples.js`) to install free CC-licensed Yamaha C5 grand piano samples with full C1–C8 coverage | ✅ Operational | v3.2.0 |
| **FEAT-049** | A-to-B Looping Mode | Set custom A and B loop points on timeline with interactive progress bar markers and continuous playback/practice section looping | ✅ Operational | v3.3.0 |
| **FEAT-050** | Smart Hand Color Separation | Intelligent multi-track & Middle-C pitch split coloring Left Hand notes in Amber/Yellow and Right Hand notes in Cyan/Blue | ✅ Operational | v3.3.0 |
| **FEAT-051** | Practice Out-of-Range Auto-Play | Automatically plays audio and satisfies chord notes that fall outside the active playable keyboard range so practice never gets stuck | ✅ Operational | v3.3.0 |

---

## Developer Guidelines for AI Agents

1. **Maintain Single Main File Pattern**:
   Keep `src/main/index.js` consolidated or ensure electron-vite externalization rules do not break child modules during bundling.
2. **Audio Latency**:
   Always load WAV audio files using `Howler` with `html5: false` (Web Audio API) for sub-15ms execution latency.
3. **IPC Bridge Consistency**:
   When adding main-renderer IPC channels, update:
   - `ipcMain.handle` / `ipcMain.on` in `src/main/index.js`
   - Exposed methods in `src/preload/index.js`
   - Fallback methods in `src/renderer/src/App.jsx`
4. **Feature Registry Updates**:
   Before completing any task, update the **Feature Registry** table above in `AGENTS.md`.
5. **Version Synchronization**:
   For every major change update the major version (`X.0.0`) and for minor changes update subversion (`1.X.0` or `3.X.0`). Ensure matching versions in `package.json`, `Sidebar.jsx`, `Settings.jsx`, `.github/workflows/build.yml`, and `AGENTS.md` (Current version: `3.3.0`).
