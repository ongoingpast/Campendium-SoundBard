import "../styles/soundboard.css";
import { MODULE_ID } from "./constants.ts";
import { registerSettings } from "./settings.ts";
import { registerKeybindings, injectSoundbardKeybindGroups } from "./keybindings.ts";
import { AudioManager, setRefreshCallback } from "./audio.ts";
import { setResizeCallback } from "./settings.ts";
import { SoundboardApp } from "./apps/SoundboardApp.ts";
import { injectPlaylistVolumeControl } from "./volumeControls.ts";
import type { SlotData } from "./types.ts";

Hooks.once("init", () => {
  registerSettings();
  registerKeybindings();
  setRefreshCallback(() => SoundboardApp.refresh());
  setResizeCallback(() => SoundboardApp.refresh());

  // Keybinding to open/close the panel (user assigns key in Configure Controls)
  game.keybindings.register(MODULE_ID, "open-panel", {
    name: "SOUNDBARD.KeybindOpen",
    editable: [],
    onDown: () => { if (!game.user?.isGM) return false; SoundboardApp.open(); return true; },
  });

  console.log(`${MODULE_ID} | Initialized`);
});

Hooks.once("ready", () => {
  type SoundBardEvent =
    | { action: "play"; slot: SlotData }
    | { action: "stop"; slotId: number }
    | { action: "stopAll" };

  (game.socket as unknown as { on(event: string, cb: (data: SoundBardEvent) => void): void })
    ?.on(`module.${MODULE_ID}`, (data) => {
      if (data.action === "play") {
        void AudioManager.play(data.slot, false);
      } else if (data.action === "stop") {
        void AudioManager.stop(data.slotId, false);
      } else if (data.action === "stopAll") {
        AudioManager.stopAll(false);
      }
    });

  // Expose API for macros: game.soundbard.open()
  (game as Record<string, unknown>).soundbard = { open: () => SoundboardApp.open() };
  console.log(`${MODULE_ID} | Ready`);
});

Hooks.on("renderControlsConfig", (_app: unknown, element: unknown) => {
  const root = element instanceof HTMLElement ? element : (element as JQuery)[0];
  if (root) injectSoundbardKeybindGroups(root);
});

// Add a SoundBard volume slider to the Playlists sidebar's global volume controls.
Hooks.on("renderPlaylistDirectory", (_app: unknown, element: unknown) => {
  const root = element instanceof HTMLElement ? element : (element as JQuery)[0];
  if (root) injectPlaylistVolumeControl(root);
});

// Honor Foundry's global mute. It has no dedicated hook, but toggling it fires
// the global volume-changed hooks; re-apply our gains in response.
// globalMute sets #globalMute AFTER firing the hooks, so defer one microtask
// to ensure game.audio.globalMute reflects the new state when we read it.
// The sidebar re-renders on every volume/mute change (ui.playlists.render()),
// so renderPlaylistDirectory handles the icon — this hook only needs to
// re-apply the gain to currently playing sounds.
Hooks.on("globalInterfaceVolumeChanged", () => queueMicrotask(() => AudioManager.applyGlobalMute()));

// V13: controls is a Record<string, SceneControl>, not an array
Hooks.on("getSceneControlButtons", (controls: Record<string, unknown>) => {
  if (!game.user?.isGM) return;
  controls[MODULE_ID] = {
    name: MODULE_ID,
    title: game.i18n.localize("SOUNDBARD.Title"),
    icon: "fa-solid fa-rectangles-mixed",
    button: true,
    onChange: () => SoundboardApp.open(),
  };
});
