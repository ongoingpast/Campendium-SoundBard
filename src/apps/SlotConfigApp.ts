import { getActiveBank, saveSingleBank, getActiveBankId } from "../settings.ts";
import { MODULE_ID } from "../constants.ts";
import { emptySlot } from "../types.ts";
import { SoundboardApp } from "./SoundboardApp.ts";

const { ApplicationV2 } = foundry.applications.api;

/** Pre-banked emojis offered in the slot config dropdown. */
const EMOJI_BANK = [
  "💥", "🔥", "⚡", "💣", "⚔️", "🗡️", "🛡️", "🏹", "✨", "🔮",
  "🪄", "🌟", "🌙", "☀️", "🌧️", "⛈️", "🌊", "🌪️", "❄️", "🍃",
  "🐉", "🐺", "🐗", "🦅", "🐍", "🕷️", "🦇", "🐎", "🏰", "🏕️",
  "🚪", "🔔", "🎵", "🎺", "🥁", "🎲", "💰", "🗝️", "📜", "⏳",
  "💀", "☠️", "👻", "😱", "👣",
];

/** Build <option> markup for the emoji dropdown, marking the slot's current emoji selected. */
function renderEmojiOptions(current: string): string {
  const options = EMOJI_BANK.includes(current) || !current
    ? EMOJI_BANK
    : [current, ...EMOJI_BANK];
  const noneSelected = current ? "" : " selected";
  const none = `<option value=""${noneSelected}>${game.i18n.localize("SOUNDBARD.SlotEmojiNone")}</option>`;
  return none + options
    .map((e) => `<option value="${escapeAttr(e)}"${e === current ? " selected" : ""}>${e}</option>`)
    .join("");
}

export class SlotConfigApp extends ApplicationV2 {
  static override DEFAULT_OPTIONS = {
    id: "soundbard-slot-config",
    classes: ["soundbard-slot-config"],
    window: {
      title: "SOUNDBARD.SlotConfig",
      resizable: false,
    },
    position: {
      width: 420,
    },
  };

  private slotIndex: number;

  constructor(slotIndex: number) {
    super({});
    this.slotIndex = slotIndex;
  }

  override async _prepareContext(): Promise<object> {
    return {};
  }

  override async _renderHTML(_context: object, _options: object): Promise<string> {
    const bank = getActiveBank();
    const slot = bank.slots[this.slotIndex] ?? emptySlot(this.slotIndex);
    const slotNum = this.slotIndex + 1;

    // Current keybinding display for this bank's slot
    const activeBankId = getActiveBankId();
    const bindings = game.keybindings.get(MODULE_ID, `bank-${activeBankId}-slot-${this.slotIndex}`);
    const keyLabel = bindings.length > 0
      ? bindings.map(formatBinding).join(" / ")
      : game.i18n.localize("SOUNDBARD.NoKeyBound");
    const keyUnset = bindings.length === 0;

    const bankLabel = bank.name.trim() || `Bank ${bank.id}`;

    return `
      <form class="soundbard-slot-form standard-form">
        <div class="soundbard-slot-bank-context">
          <i class="fa-solid fa-layer-group"></i>
          <span>${bankLabel}</span>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("SOUNDBARD.SlotName")} (Slot ${slotNum})</label>
          <input type="text" name="name" value="${escapeAttr(slot.name)}" placeholder="Slot ${slotNum}">
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("SOUNDBARD.SlotSrc")}</label>
          <div class="form-fields">
            <input type="text" name="src" value="${escapeAttr(slot.src)}" placeholder="path/to/sound.ogg">
            <button type="button" class="soundbard-browse" title="${game.i18n.localize("SOUNDBARD.Browse")}">
              <i class="fa-solid fa-folder-open"></i>
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("SOUNDBARD.SlotEmoji")}</label>
          <select name="emoji" class="soundbard-emoji-select">${renderEmojiOptions(slot.emoji)}</select>
          <p class="hint">${game.i18n.localize("SOUNDBARD.SlotEmojiHint")}</p>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("SOUNDBARD.SlotVolume")}: <span class="soundbard-vol-label">${Math.round(slot.volume * 100)}%</span></label>
          <input type="range" name="volume" min="0" max="1" step="0.05" value="${slot.volume}">
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("SOUNDBARD.SlotLoop")}</label>
          <input type="checkbox" name="loop" ${slot.loop ? "checked" : ""}>
        </div>
        <div class="form-group soundbard-loop-delay"${slot.loop ? "" : ' style="display: none;"'}>
          <label>${game.i18n.localize("SOUNDBARD.SlotLoopDelay")}</label>
          <div class="form-fields">
            <input type="number" name="loopDelay" min="0" max="60" step="0.5" value="${slot.loopDelay ?? 0}">
            <span class="soundbard-loop-delay-unit">${game.i18n.localize("SOUNDBARD.Seconds")}</span>
          </div>
          <p class="hint">${game.i18n.localize("SOUNDBARD.SlotLoopDelayHint")}</p>
        </div>
        <details class="soundbard-fx">
          <summary class="soundbard-fx-summary">
            <i class="fa-solid fa-chevron-right soundbard-fx-chevron"></i>
            <span>${game.i18n.localize("SOUNDBARD.FXSection")}</span>
          </summary>
          <div class="soundbard-fx-body">
            <div class="form-group">
              <label>${game.i18n.localize("SOUNDBARD.SlotReverb")}: <span class="soundbard-vol-label soundbard-reverb-label">${Math.round((slot.reverb ?? 0) * 100)}%</span></label>
              <input type="range" name="reverb" min="0" max="1" step="0.05" value="${slot.reverb ?? 0}" style="--slider-color: var(--ring)">
            </div>
            ${eqSlider("eqLow", "SOUNDBARD.SlotEQLow", slot.eqLow ?? 0)}
            ${eqSlider("eqMid", "SOUNDBARD.SlotEQMid", slot.eqMid ?? 0)}
            ${eqSlider("eqHigh", "SOUNDBARD.SlotEQHigh", slot.eqHigh ?? 0)}
          </div>
        </details>
        <hr>
        <div class="form-group">
          <label>${game.i18n.localize("SOUNDBARD.KeybindingSection")}</label>
          <div class="soundbard-keybind-display">
            <span class="soundbard-key-badge${keyUnset ? " unset" : ""}">${keyLabel}</span>
            <button type="button" class="soundbard-configure-keys" title="${game.i18n.localize("SOUNDBARD.ConfigureControls")}">
              <i class="fa-solid fa-keyboard"></i> ${game.i18n.localize("SOUNDBARD.ConfigureControls")}
            </button>
          </div>
          <p class="hint">${game.i18n.localize("SOUNDBARD.KeybindingHint")}</p>
        </div>
        <footer class="sheet-footer flexrow">
          <button type="button" class="soundbard-save">
            <i class="fa-solid fa-save"></i> ${game.i18n.localize("Save")}
          </button>
          <button type="button" class="soundbard-clear">
            <i class="fa-solid fa-trash"></i> ${game.i18n.localize("SOUNDBARD.ClearSlot")}
          </button>
        </footer>
      </form>
    `;
  }

  override _replaceHTML(result: string, content: HTMLElement, _options: object): void {
    content.innerHTML = result;
  }

  override _onRender(_context: object, _options: object): void {
    const el = this.element;

    // Live volume label update
    const volumeInput = el.querySelector<HTMLInputElement>('[name="volume"]');
    const volLabel = el.querySelector<HTMLSpanElement>(".soundbard-vol-label:not(.soundbard-reverb-label)");
    if (volumeInput) volumeInput.style.setProperty("--fill", `${Math.round(Number(volumeInput.value) * 100)}%`);
    volumeInput?.addEventListener("input", () => {
      if (volLabel) volLabel.textContent = `${Math.round(Number(volumeInput.value) * 100)}%`;
      volumeInput.style.setProperty("--fill", `${Math.round(Number(volumeInput.value) * 100)}%`);
    });

    // Live reverb label update
    const reverbInput = el.querySelector<HTMLInputElement>('[name="reverb"]');
    const reverbLabel = el.querySelector<HTMLSpanElement>(".soundbard-reverb-label");
    if (reverbInput) reverbInput.style.setProperty("--fill", `${Math.round(Number(reverbInput.value) * 100)}%`);
    reverbInput?.addEventListener("input", () => {
      if (reverbLabel) reverbLabel.textContent = `${Math.round(Number(reverbInput.value) * 100)}%`;
      reverbInput.style.setProperty("--fill", `${Math.round(Number(reverbInput.value) * 100)}%`);
    });

    // Live EQ label + fill updates
    el.querySelectorAll<HTMLInputElement>('input[type="range"][name^="eq"]').forEach((input) => {
      const label = el.querySelector<HTMLSpanElement>(`.soundbard-eq-label[data-for="${input.name}"]`);
      input.style.setProperty("--fill", `${eqFill(Number(input.value))}%`);
      input.addEventListener("input", () => {
        const db = Number(input.value);
        if (label) label.textContent = formatDb(db);
        input.style.setProperty("--fill", `${eqFill(db)}%`);
      });
    });

    // Show/hide loop delay field with the loop checkbox
    const loopInput = el.querySelector<HTMLInputElement>('[name="loop"]');
    const loopDelayGroup = el.querySelector<HTMLElement>(".soundbard-loop-delay");
    loopInput?.addEventListener("change", () => {
      if (loopDelayGroup) loopDelayGroup.style.display = loopInput.checked ? "" : "none";
    });

    // FilePicker for audio browse
    el.querySelector(".soundbard-browse")?.addEventListener("click", () => {
      const srcInput = el.querySelector<HTMLInputElement>('[name="src"]');
      new FilePicker({
        type: "audio",
        current: srcInput?.value ?? "",
        callback: (path: string) => {
          if (srcInput) srcInput.value = path;
        },
      }).render(true);
    });

    // Open Configure Controls and navigate to this bank's slot
    el.querySelector(".soundbard-configure-keys")?.addEventListener("click", () => {
      const bankId = getActiveBankId();
      const actionId = `soundbard.bank-${bankId}-slot-${this.slotIndex}`;
      openControlsAtAction(actionId);
    });

    // Save
    el.querySelector(".soundbard-save")?.addEventListener("click", async () => {
      const form = el.querySelector<HTMLFormElement>("form");
      if (!form) return;
      const data = new FormData(form);

      const bank = getActiveBank();
      const slot = bank.slots[this.slotIndex] ?? emptySlot(this.slotIndex);

      slot.name = (data.get("name") as string) ?? "";
      slot.src = (data.get("src") as string) ?? "";
      slot.emoji = (data.get("emoji") as string) ?? "";
      slot.volume = Number(data.get("volume") ?? 1);
      slot.reverb = Number(data.get("reverb") ?? 0);
      slot.eqLow = Number(data.get("eqLow") ?? 0);
      slot.eqMid = Number(data.get("eqMid") ?? 0);
      slot.eqHigh = Number(data.get("eqHigh") ?? 0);
      slot.loop = el.querySelector<HTMLInputElement>('[name="loop"]')?.checked ?? false;
      slot.loopDelay = Math.max(0, Number(data.get("loopDelay") ?? 0) || 0);

      bank.slots[this.slotIndex] = slot;

      await saveSingleBank(bank);
      SoundboardApp.refresh();
      await this.close();
    });

    // Clear slot
    el.querySelector(".soundbard-clear")?.addEventListener("click", async () => {
      const bank = getActiveBank();
      bank.slots[this.slotIndex] = emptySlot(this.slotIndex);
      await saveSingleBank(bank);
      SoundboardApp.refresh();
      await this.close();
    });
  }
}

function openControlsAtAction(actionId: string): void {
  const navigate = (root: HTMLElement) => {
    // Switch to the SoundBard category tab — AppV2 nav buttons use data-action="changeTab"
    const tabBtn = root.querySelector<HTMLElement>(
      '[data-action="changeTab"][data-tab="soundbard"], [data-tab="soundbard"]:not(section)',
    );
    tabBtn?.click();

    requestAnimationFrame(() => {
      const entry = root.querySelector<HTMLElement>(`[data-action-id="${actionId}"]`);
      if (!entry) return;
      entry.scrollIntoView({ behavior: "smooth", block: "center" });
      entry.querySelector<HTMLButtonElement>('[data-action="addBinding"]')?.click();
    });
  };

  const existing = document.getElementById("controls-config");
  if (existing) {
    navigate(existing);
  } else {
    Hooks.once("renderControlsConfig", (_: unknown, element: unknown) => {
      const root = element instanceof HTMLElement ? element : (element as JQuery)[0];
      if (root) navigate(root);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (KeybindingsConfig as any)().render(true);
  }
}

// EQ gain range in dB (shared with audio graph)
const EQ_MIN = -12;
const EQ_MAX = 12;

function eqFill(db: number): number {
  return Math.round(((db - EQ_MIN) / (EQ_MAX - EQ_MIN)) * 100);
}

function formatDb(db: number): string {
  const sign = db > 0 ? "+" : "";
  return `${sign}${db} dB`;
}

function eqSlider(name: string, labelKey: string, value: number): string {
  return `
        <div class="form-group">
          <label>${game.i18n.localize(labelKey)}: <span class="soundbard-vol-label soundbard-eq-label" data-for="${name}">${formatDb(value)}</span></label>
          <input type="range" name="${name}" min="${EQ_MIN}" max="${EQ_MAX}" step="1" value="${value}" style="--slider-color: var(--ring)">
        </div>`;
}

function formatBinding(b: ClientKeybindings.KeybindingActionBinding): string {
  const key = b.key.startsWith("Key") ? b.key.slice(3)
    : b.key.startsWith("Digit") ? b.key.slice(5)
    : b.key;
  const parts = [
    ...(b.modifiers ?? []).map(m => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase()),
    key,
  ];
  return parts.join("+");
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
