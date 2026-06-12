import { getMasterVolume, saveMasterVolume } from "./settings.ts";
import { AudioManager } from "./audio.ts";
import { SoundboardApp } from "./apps/SoundboardApp.ts";

const CONTROL_ID = "soundbard-global-volume";

/**
 * Inject a SoundBard volume slider into the Playlists sidebar's volume controls
 * ("User Volume Controls"). SoundBard's audio graph bypasses Foundry's core
 * volume channels (it connects straight to the AudioContext destination), so
 * this slider drives SoundBard's own master volume only — leaving the core
 * Music/Environment/Interface sliders untouched.
 */
export function injectPlaylistVolumeControl(root: HTMLElement): void {
  // Re-render of the sidebar replaces the DOM, but guard in case the hook fires
  // twice for one render.
  if (root.querySelector(`#${CONTROL_ID}`)) return;

  // V13 markup: <div class="global-volume"> … <ol class="plain"> with one
  // <li class="flexrow"> per channel. Append our row to that list so it sits
  // inside the collapsible section alongside the core channels.
  const list = root.querySelector<HTMLElement>(".global-volume ol.plain");
  if (!list) return;

  const value = getMasterVolume();
  const muted = (game.audio as unknown as { globalMute?: boolean }).globalMute ?? false;
  const icon = muted ? "fa-volume-xmark" : "fa-volume-low";

  // Match the core channel rows exactly: a flexrow of <label> + volume-icon +
  // <range-picker>. The range-picker web component is what the core CSS sizes
  // (flex: 2), so the slider lines up with Music/Environment/Interface.
  const row = document.createElement("li");
  row.className = "flexrow";
  row.id = CONTROL_ID;
  row.innerHTML = `
    <label>${game.i18n.localize("SOUNDBARD.GlobalVolumeLabel")}</label>
    <i class="volume-icon fa-fw fa-solid ${icon}" inert></i>
    <range-picker class="global-volume-slider" name="soundbard-master-volume"
      value="${value}" min="0" max="1" step="0.05"></range-picker>
  `;
  list.appendChild(row);

  const picker = row.querySelector<HTMLElement & { valueAsNumber: number }>("range-picker");

  // While dragging, the inner range input bubbles "input" events — live-adjust
  // every currently playing SoundBard sound.
  picker?.addEventListener("input", (event) => {
    AudioManager.applyMasterVolume((event.target as HTMLInputElement).valueAsNumber);
  });

  // On release, range-picker fires "change" with its committed value — persist
  // it and keep the in-panel master volume slider in sync.
  picker?.addEventListener("change", () => {
    void saveMasterVolume(picker.valueAsNumber);
    SoundboardApp.refresh();
  });
}
