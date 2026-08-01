# AGENTS.md — SoundKeys Architecture & AI Developer Guidelines

Welcome to **SoundKeys**! This document serves as the authoritative guide for AI agents and human developers maintaining and expanding this repository.

---

## ⚠️ MANDATORY RULES FOR ALL AGENTS
> [!IMPORTANT]
> 1. **FEATURE REGISTRY MAINTENANCE**: Whenever you implement, modify, or plan a new feature, you **MUST update the Feature Registry table in this document (`AGENTS.md`)** before concluding your task.
> 2. **VERSION SYNCHRONIZATION**:
>    - **Major Changes**: Increment the major version number (`X.0.0`).
>    - **Minor / Subversion Changes**: Increment the minor version number (`1.X.0`).
>    - **Strict Synchronization**: You **MUST keep version numbers identical across all files**: `package.json`, `.github/workflows/build.yml`, `Sidebar.jsx`, `Settings.jsx`, and `AGENTS.md`. (Current version: `1.1.0`).

---

## Project Overview & Design Philosophy

**SoundKeys** is a feature-rich, high-performance Windows desktop application that plays tactile, customizable audio feedback on system-wide keyboard (and optional mouse) events.

- **Stack**: Electron + React + Vite + Howler.js + uiohook-napi
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
│
├── src/
│   ├── main/
│   │   └── index.js             ← Electron main process (tray, IPC, keyhook, window management)
│   ├── preload/
│   │   └── index.js             ← ContextBridge IPC wrapper (window.soundkeys)
│   └── renderer/                ← React 18 UI
│       ├── index.html
│       └── src/
│           ├── App.jsx          ← Main application container & IPC hooks
│           ├── components/
│           │   ├── AudioEngine.jsx  ← Howler.js low-latency audio player
│           │   ├── Sidebar.jsx      ← Navigation panel
│           │   └── ThemeCreatorModal.jsx ← Custom theme creator/importer
│           ├── pages/
│           │   ├── Dashboard.jsx    ← Orb visualizer & live keypress stats
│           │   └── Settings.jsx     ← Preferences, theme manager, system toggles
│           └── styles/
│               └── index.css        ← Design system tokens & styles
│
└── sounds/
    └── themes/                  ← Sound pack playlists (WAV files + theme.json)
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
   For every major change update the major version (`X.0.0`) and for minor changes update subversion (`1.X.0`). Ensure matching versions in `package.json`, `Sidebar.jsx`, `Settings.jsx`, `.github/workflows/build.yml`, and `AGENTS.md` (Current version: `1.1.0`).
