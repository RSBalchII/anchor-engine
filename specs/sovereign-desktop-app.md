# Sovereign Desktop App - Planning Document

> **Vision**: A privacy-first AI assistant that lives on your desktop, sees what you see, remembers what matters, and runs entirely on your hardware.

## 1. Core Concept

```
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR DESKTOP (Windows/Mac/Linux)             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Any Application                        │   │
│  │   (Browser, IDE, Documents, Games, etc.)                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                    Screen Capture (periodic)                    │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SOVEREIGN OVERLAY (Electron)                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────┐   │   │
│  │  │ Vision Model│  │ Chat Model  │  │ ECE Memory     │   │   │
│  │  │ (Qwen-VL)   │──▶│ (Qwen3-4B)  │──▶│ (CozoDB)       │   │   │
│  │  │ Screen→Text │  │ Reasoning   │  │ Long-term Store│   │   │
│  │  └─────────────┘  └─────────────┘  └────────────────┘   │   │
│  │                                                          │   │
│  │  [Hotkey: Alt+Space]  [Floating Widget]  [System Tray]  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Key Differentiators from Claude Desktop / ChatGPT

| Feature | Claude Desktop | Sovereign Desktop |
|---------|---------------|-------------------|
| **Data Location** | Anthropic servers | 100% local |
| **Screen Reading** | No | Yes (local VL model) |
| **Memory Persistence** | Session-based | Permanent (ECE) |
| **Cost** | Subscription | Free (your hardware) |
| **Privacy** | Trust provider | Zero trust needed |
| **Offline** | No | Yes |
| **Customization** | Limited | Full control |

## 3. Architecture Layers

### Layer 1: Screen Capture Engine
```
┌──────────────────────────────────────────────────────┐
│                 CAPTURE MODES                         │
├──────────────────────────────────────────────────────┤
│ 1. Continuous (1 frame/5sec) - Background awareness  │
│ 2. On-Demand (hotkey) - "What am I looking at?"      │
│ 3. Change-Detection - Only when screen changes       │
│ 4. Window-Focused - Track specific app windows       │
└──────────────────────────────────────────────────────┘

Technologies:
- Windows: electron desktopCapturer or native win32 API
- Cross-platform: screenshot-desktop, robotjs
- Efficient: Only capture when needed (change detection)
```

### Layer 2: Vision Language Model (VL)
```
Purpose: Convert screenshots → semantic text descriptions

Model Options (ranked by efficiency):
┌────────────────────┬─────────┬──────────┬───────────────────┐
│ Model              │ VRAM    │ Speed    │ Quality           │
├────────────────────┼─────────┼──────────┼───────────────────┤
│ Qwen2.5-VL-3B      │ ~4GB    │ Fast     │ Good for UI       │
│ Qwen2.5-VL-7B      │ ~8GB    │ Medium   │ Better context    │
│ MiniCPM-V-2.6      │ ~4GB    │ Fast     │ Good efficiency   │
│ LLaVA-1.6-7B       │ ~8GB    │ Medium   │ Strong general    │
│ moondream2         │ ~2GB    │ Very Fast│ Basic but quick   │
└────────────────────┴─────────┴──────────┴───────────────────┘

Output: Structured scene description
{
  "timestamp": 1736400000000,
  "active_window": "VS Code - db.js",
  "visible_text": ["function initializeDb", "CozoDB", "..."],
  "ui_elements": ["sidebar", "editor", "terminal"],
  "activity": "coding JavaScript database initialization",
  "notable": ["error in terminal", "debugging session"]
}
```

### Layer 3: Language Model (Chat/Reasoning)
```
Current: Qwen3-4B-Thinking (already integrated)

Enhanced Context Assembly:
┌─────────────────────────────────────────────────────┐
│ PROMPT ASSEMBLY                                      │
├─────────────────────────────────────────────────────┤
│ 1. System prompt (personality, capabilities)        │
│ 2. ECE Memory injection (relevant past context)     │
│ 3. Recent screen context (last 5 VL descriptions)  │
│ 4. Current screen (if vision-triggered)            │
│ 5. User query                                       │
└─────────────────────────────────────────────────────┘
```

### Layer 4: ECE Memory Integration
```
Already Built! Just needs connection:

POST /v1/memory/search  → Retrieve relevant context
POST /v1/memory/ingest  → Store important observations

New Automatic Ingestion:
- Screen context summaries (hourly digest)
- Conversation highlights
- Detected patterns ("Rob usually codes in evening")
```

## 4. User Interface Concepts

### 4.1 Floating Overlay (Primary)
```
┌────────────────────────────────────────┐
│ 🧠 [                              ] ⚙️ │  ← Minimal bar (always visible)
└────────────────────────────────────────┘
         │
         ▼ (expands on focus/hotkey)
┌────────────────────────────────────────┐
│ 🧠 Sovereign                       ─ □ │
├────────────────────────────────────────┤
│                                        │
│  I see you're working on db.js in     │
│  VS Code. The FTS migration looks     │
│  like it's running every startup.     │
│                                        │
│  Want me to help fix that?            │
│                                        │
├────────────────────────────────────────┤
│ [Yes, show me] [Explain more] [Later] │
├────────────────────────────────────────┤
│ > Type or press Alt+Space...          │
└────────────────────────────────────────┘
```

### 4.2 System Tray Mode
```
   🧠 (tray icon)
    │
    ├── "What's on my screen?"
    ├── "Remember this"
    ├── "Search memories..."
    ├── ────────────────
    ├── Settings
    └── Quit
```

### 4.3 Hotkey Actions
```
Alt + Space     → Toggle overlay / quick chat
Alt + Shift + S → "What am I looking at?"
Alt + Shift + R → "Remember this screen"
Alt + Shift + M → Search memories
Ctrl + Shift + C → Copy screen context to clipboard
```

## 5. Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ELECTRON MAIN PROCESS                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Screen      │    │ Model       │    │ ECE         │     │
│  │ Capture     │───▶│ Orchestrator│◀──▶│ Client      │     │
│  │ Service     │    │             │    │ (HTTP)      │     │
│  └─────────────┘    └──────┬──────┘    └──────┬──────┘     │
│                            │                   │            │
│                     ┌──────┴──────┐     ┌──────┴──────┐    │
│                     │ VL Model    │     │ Chat Model  │    │
│                     │ (llama.cpp) │     │ (llama.cpp) │    │
│                     └─────────────┘     └─────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ IPC
┌─────────────────────────────────────────────────────────────┐
│                    ELECTRON RENDERER (UI)                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Overlay     │    │ Chat        │    │ Settings    │     │
│  │ Widget      │    │ Window      │    │ Panel       │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼ HTTP (localhost:3000)
┌─────────────────────────────────────────────────────────────┐
│                    ECE ENGINE (Existing)                     │
│  Memory Storage │ FTS Search │ Dreamer │ File Watcher       │
└─────────────────────────────────────────────────────────────┘
```

## 6. Implementation Phases

### Phase 1: Basic Overlay (2-3 days)
```
Goal: Electron app with chat connected to ECE + local LLM

Tasks:
□ Create Electron boilerplate with overlay window
□ Implement hotkey activation (Alt+Space)
□ Connect to ECE API (existing localhost:3000)
□ Connect to local LLM (existing Qwen endpoint)
□ Basic chat UI (port chat.html concepts)
□ System tray with basic menu
□ Settings: model path, ECE endpoint, hotkeys
```

### Phase 2: Screen Awareness (3-5 days)
```
Goal: Add vision model for screen understanding

Tasks:
□ Integrate screen capture (desktopCapturer)
□ Add VL model loading (Qwen2.5-VL or moondream2)
□ Build capture → VL → text pipeline
□ "What's on my screen?" command
□ Periodic background capture (configurable)
□ Change detection (don't spam VL with identical frames)
```

### Phase 3: Proactive Memory (2-3 days)
```
Goal: Auto-remember important things

Tasks:
□ Hourly screen context digest → ECE
□ Conversation highlight extraction → ECE
□ "Remember this" hotkey action
□ Smart deduplication (don't store repetitive context)
□ Activity pattern detection
```

### Phase 4: Polish & Distribution (2-3 days)
```
Goal: Usable by others

Tasks:
□ Installer (electron-builder)
□ Auto-update mechanism
□ First-run setup wizard
□ Model download helper
□ Documentation
□ Performance optimization (GPU usage, memory)
```

## 7. Technical Decisions

### 7.1 Electron vs Tauri vs Native
```
Electron (Recommended):
✅ JavaScript ecosystem (same as ECE)
✅ Mature, well-documented
✅ Easy UI development
✅ Cross-platform
❌ Higher memory (~100-200MB baseline)

Tauri:
✅ Much smaller footprint (~10MB)
✅ Rust performance
❌ Different language (learning curve)
❌ Smaller ecosystem

Decision: Electron - consistency with ECE, faster development
```

### 7.2 Model Hosting
```
Option A: Embedded in Electron (llama.cpp via node-llama-cpp)
✅ Single app, no separate server
❌ More complex packaging

Option B: ECE hosts models (current approach)
✅ ECE already runs models
✅ Overlay is thin client
❌ Requires ECE running

Option C: Hybrid
✅ VL model in Electron (for screen)
✅ Chat model in ECE (reuse existing)
Recommended for Phase 1-2

Decision: Start with Option B, migrate to C
```

### 7.3 Privacy Controls
```
User-configurable:
- Blur sensitive windows (banking, passwords)
- Blacklist apps from capture
- Encryption at rest for screen cache
- Auto-delete screen history after N days
- Manual "pause" mode
```

## 8. Folder Structure (Proposed)
```
sovereign-desktop/
├── package.json
├── electron/
│   ├── main.js              # Main process
│   ├── preload.js           # Bridge to renderer
│   ├── capture/
│   │   ├── screen.js        # Screen capture logic
│   │   └── change-detect.js # Smart capture triggering
│   ├── models/
│   │   ├── vl-runner.js     # Vision-language model
│   │   └── orchestrator.js  # Model coordination
│   └── services/
│       ├── ece-client.js    # ECE API wrapper
│       ├── hotkeys.js       # Global hotkey registration
│       └── tray.js          # System tray management
├── renderer/
│   ├── index.html           # Overlay UI
│   ├── styles.css
│   └── app.js               # UI logic
├── assets/
│   ├── icons/
│   └── sounds/              # Optional notification sounds
└── config/
    └── default.json         # Default settings
```

## 9. Quick Start Prototype

Minimal viable overlay (could build today):

```javascript
// electron/main.js - Bare minimum
const { app, BrowserWindow, globalShortcut, Tray } = require('electron');

let overlay;

app.whenReady().then(() => {
  // Frameless, always-on-top overlay
  overlay = new BrowserWindow({
    width: 400,
    height: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: true }
  });
  
  overlay.loadFile('renderer/index.html');
  overlay.hide();
  
  // Alt+Space to toggle
  globalShortcut.register('Alt+Space', () => {
    overlay.isVisible() ? overlay.hide() : overlay.show();
  });
  
  // System tray
  const tray = new Tray('assets/icon.png');
  tray.setToolTip('Sovereign Desktop');
});
```

## 10. Next Steps

1. **Decide**: Build as separate repo or within ECE_Core?
2. **Prototype**: Create basic Electron overlay in 1 day
3. **Connect**: Wire up to existing ECE + LLM
4. **Test**: Daily use for a week
5. **Iterate**: Add vision, polish, distribute

---

## Questions to Answer

1. **Separate repo or monorepo?**
   - Separate: Cleaner, independent versioning
   - Monorepo: Shared code, easier development

2. **VL model priority?**
   - Start without (chat-only) then add?
   - Or VL from day one?

3. **Target users?**
   - Just you (power user)?
   - Or others (need installer, docs)?

4. **Hardware constraints?**
   - What GPU do you have?
   - Running VL + Chat together needs planning

---

*This is your personal AI that never phones home, never forgets, and always has context.*
