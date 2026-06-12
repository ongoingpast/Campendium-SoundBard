# SoundBard

A floating soundboard panel for FoundryVTT GMs. Bank your sound effects, assign hotkeys, and fire them off mid-session without breaking stride.

Built by [Campendium](https://campendium.io) — a digital toolkit for TTRPG GMs and worldbuilders.

---

## What it does

SoundBard gives you a draggable grid of sound buttons that lives on top of your Foundry canvas. Load sounds into slots, label them, give them hotkeys, and play them with a single click or keypress. Think StreamDeck, but inside Foundry.

- Up to **20 banks** of sounds, each with a configurable grid (up to 8×8)
- **Hotkeys** per slot, assigned in Configure Controls — keys are shown directly on the button
- **Cross-bank search** — type in the sidebar to find any named sound across all your banks
- **Master volume and reverb** sliders built into the panel
- **Stop All** button to cut everything at once
- Respects Foundry's global mute
- All settings are **client-scoped** — each player's layout is their own

---

## Usage

Open the panel via the toolbar icon (scene controls) or assign a keybind under Configure Controls > SoundBard.

**Adding sounds:**
Right-click any empty slot to configure it. You can pick a file from Foundry's file browser, set a display name, and optionally assign an emoji as the button label.

**Banks:**
The sidebar lists your banks. Click to switch, double-click (or right-click) the active bank to rename it. The search box at the top of the sidebar searches sound names across all banks — pressing Enter or clicking a result jumps straight to that slot.

**Hotkeys:**
Go to Configure Controls and find the SoundBard section. Each slot in each bank can have its own keybind. The assigned key is displayed in the corner of the button.

**Macro API:**
```js
game.soundbard.open()
```

---

## Installation

Paste this manifest URL into Foundry's **Install Module** dialog:

```
https://github.com/ongoingpast/Campendium-SoundBard/releases/latest/download/module.json
```

Or find it by searching **SoundBard** in the module browser once it's listed.

---

## Settings

| Setting | Default | Description |
|---|---|---|
| Columns | 4 | Grid width (2–8) |
| Rows | 3 | Grid height (2–8) |

Grid size changes apply across all banks. Slots beyond the new grid size are preserved in storage and restored if you expand again.

---

## Compatibility

| Foundry Version | Status |
|---|---|
| V13 | Verified |
| V11–V12 | Should work |

---

## Contributing

Issues and PRs welcome at [github.com/ongoingpast/Campendium-SoundBard](https://github.com/ongoingpast/Campendium-SoundBard).

Built with TypeScript + Vite. Run `npm install` then `npm run dev` to start the watch build. Foundry picks up changes on page reload.
