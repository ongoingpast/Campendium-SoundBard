import {
  getAllBanks, getActiveBank, getActiveBankId, setActiveBankId, saveAllBanks,
  getMasterVolume, saveMasterVolume, getMasterReverb, saveMasterReverb,
} from "../settings.ts";
import { AudioManager } from "../audio.ts";
import { MODULE_ID, MAX_SLOTS } from "../constants.ts";

const { ApplicationV2 } = foundry.applications.api;

export class SoundboardApp extends ApplicationV2 {
  static override DEFAULT_OPTIONS = {
    id: "soundbard-panel",
    classes: ["soundbard-app"],
    window: {
      title: "SOUNDBARD.Title",
      resizable: false,
      minimizable: true,
    },
    position: {
      width: 510,
      height: "auto" as const,
    },
  };

  private static instance: SoundboardApp | null = null;

  // Set when a cross-bank search result jumps to another bank; the target slot
  // is flashed once the new bank finishes rendering.
  private static pendingFlash: { bankId: number; slotIndex: number } | null = null;

  static open(): SoundboardApp | null {
    if (!game.user?.isGM) return null;
    if (!SoundboardApp.instance || !SoundboardApp.instance.rendered) {
      SoundboardApp.instance = new SoundboardApp();
      void SoundboardApp.instance.render({ force: true });
    } else {
      SoundboardApp.instance.bringToTop();
    }
    return SoundboardApp.instance;
  }

  static refresh(): void {
    if (SoundboardApp.instance?.rendered) {
      void SoundboardApp.instance.render({ force: false });
    }
  }

  override async _prepareContext(): Promise<object> {
    return {};
  }

  override async _renderHTML(_context: object, _options: object): Promise<string> {
    const columns = game.settings.get(MODULE_ID, "columns") as number;
    const rows = game.settings.get(MODULE_ID, "rows") as number;
    const masterVolume = getMasterVolume();
    const masterReverb = getMasterReverb();
    const activeBankId = getActiveBankId();
    const all = getAllBanks();
    const activeBank = all.banks.find(b => b.id === activeBankId) ?? all.banks[0];
    const { slots } = activeBank;

    // Bank sidebar items
    const bankItems = all.banks.map(bank => {
      const isActive = bank.id === activeBankId;
      const displayName = escapeHtml(bank.name || `Bank ${bank.id}`);
      return `<div class="soundbard-bank-item${isActive ? " active" : ""}" data-bank-id="${bank.id}">
        <span class="soundbard-bank-num">${bank.id}</span>
        <span class="soundbard-bank-name">${displayName}</span>
      </div>`;
    }).join("");

    // Cross-bank search results (every named sound, filtered live by JS)
    const searchResults = all.banks.flatMap(bank => {
      const bankLabel = escapeHtml(bank.name || `Bank ${bank.id}`);
      return bank.slots
        .map((slot, i) => ({ slot, i }))
        .filter(({ slot }) => slot.src && slot.name)
        .map(({ slot, i }) => {
          const emoji = slot.emoji ? `<span class="soundbard-search-emoji">${escapeHtml(slot.emoji)}</span>` : "";
          return `<div class="soundbard-search-result" data-bank-id="${bank.id}" data-slot-index="${i}" data-name="${escapeHtml(slot.name.toLowerCase())}">
            ${emoji}
            <span class="soundbard-search-name">${escapeHtml(slot.name)}</span>
            <span class="soundbard-search-bank">${bankLabel}</span>
          </div>`;
        });
    }).join("");

    // Grid slot buttons
    const buttons = slots.map((slot, i) => {
      const uid = activeBankId * MAX_SLOTS + i;
      const isPlaying = AudioManager.isPlaying(uid);
      const hasSound = !!slot.src;

      let label: string;
      if (slot.emoji) label = slot.emoji;
      else if (slot.name) label = slot.name;
      else label = String(i + 1);

      const slotBindings = game.keybindings.get(MODULE_ID, `bank-${activeBankId}-slot-${i}`) ?? [];
      const keyLabel = slotBindings.length > 0 ? formatBindingShort(slotBindings[0]!) : "";

      const classes = ["soundbard-slot", hasSound ? "has-sound" : "empty", isPlaying ? "playing" : ""]
        .filter(Boolean).join(" ");

      return `<button
        class="${classes}"
        data-slot-index="${i}"
        data-uid="${uid}"
        data-name="${escapeHtml((slot.name || "").toLowerCase())}"
        title="${escapeHtml(slot.name || `Slot ${i + 1}`)}"
        ${!hasSound ? "disabled" : ""}
      >${label}${keyLabel ? `<span class="soundbard-slot-keybind">${escapeHtml(keyLabel)}</span>` : ""}</button>`;
    }).join("");

    return `
      <div class="soundbard-layout">
        <aside class="soundbard-sidebar">
          <input class="soundbard-bank-search" type="text" placeholder="Search sounds…" autocomplete="off">
          <div class="soundbard-bank-list">
            ${bankItems}
          </div>
          <div class="soundbard-search-results" style="display: none;">
            ${searchResults}
            <div class="soundbard-search-empty" style="display: none;">${game.i18n.localize("SOUNDBARD.NoResults")}</div>
          </div>
        </aside>
        <div class="soundbard-main">
          <div class="soundbard-grid" style="--columns: ${columns}; --rows: ${rows};">
            ${buttons}
          </div>
          <div class="soundbard-footer">
            <div class="soundbard-volume-row">
              <i class="fa-solid fa-volume-low"></i>
              <input type="range" class="soundbard-master-volume" min="0" max="1" step="0.01"
                value="${masterVolume}" title="Master Volume">
              <i class="fa-solid fa-volume-high"></i>
              <span class="soundbard-vol-pct">${Math.round(masterVolume * 100)}%</span>
            </div>
            <div class="soundbard-reverb-row">
              <i class="fa-solid fa-water"></i>
              <input type="range" class="soundbard-master-reverb" min="0" max="1" step="0.01"
                value="${masterReverb}" title="Reverb">
              <span class="soundbard-reverb-label">Reverb</span>
              <span class="soundbard-reverb-pct">${Math.round(masterReverb * 100)}%</span>
            </div>
            <button class="soundbard-stop-all" title="${game.i18n.localize("SOUNDBARD.StopAll")}">
              <i class="fa-solid fa-stop"></i> ${game.i18n.localize("SOUNDBARD.StopAll")}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  override _replaceHTML(result: string, content: HTMLElement, _options: object): void {
    content.innerHTML = result;
  }

  override _getHeaderControls() {
    return [
      ...super._getHeaderControls(),
      {
        icon: "fa-solid fa-circle-info",
        label: "Info",
        action: "soundbard-info",
        onClick: () => showInfoModal(),
      },
    ];
  }

  override _onRender(_context: object, _options: object): void {
    const el = this.element;

    // === Slot buttons ===
    el.querySelectorAll<HTMLButtonElement>(".soundbard-slot").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.slotIndex);
        const uid = Number(btn.dataset.uid);
        const slot = getActiveBank().slots[idx];
        if (slot?.src) void AudioManager.play({ ...slot, id: uid });
      });

      btn.addEventListener("contextmenu", async (e) => {
        e.preventDefault();
        const idx = Number(btn.dataset.slotIndex);
        const { SlotConfigApp } = await import("./SlotConfigApp.ts");
        new SlotConfigApp(idx).render({ force: true });
      });
    });

    // === Stop All ===
    el.querySelector(".soundbard-stop-all")?.addEventListener("click", () => {
      AudioManager.stopAll();
    });

    // === Volume slider ===
    const volumeSlider = el.querySelector<HTMLInputElement>(".soundbard-master-volume");
    const volPct = el.querySelector<HTMLSpanElement>(".soundbard-vol-pct");
    if (volumeSlider) volumeSlider.style.setProperty("--fill", `${Math.round(Number(volumeSlider.value) * 100)}%`);
    volumeSlider?.addEventListener("input", () => {
      const val = Number(volumeSlider.value);
      if (volPct) volPct.textContent = `${Math.round(val * 100)}%`;
      volumeSlider.style.setProperty("--fill", `${Math.round(val * 100)}%`);
      AudioManager.applyMasterVolume(val);
    });
    volumeSlider?.addEventListener("change", () => {
      void saveMasterVolume(Number(volumeSlider.value));
    });

    // === Reverb slider ===
    const reverbSlider = el.querySelector<HTMLInputElement>(".soundbard-master-reverb");
    const reverbPct = el.querySelector<HTMLSpanElement>(".soundbard-reverb-pct");
    if (reverbSlider) reverbSlider.style.setProperty("--fill", `${Math.round(Number(reverbSlider.value) * 100)}%`);
    reverbSlider?.addEventListener("input", () => {
      const val = Number(reverbSlider.value);
      if (reverbPct) reverbPct.textContent = `${Math.round(val * 100)}%`;
      reverbSlider.style.setProperty("--fill", `${Math.round(val * 100)}%`);
      AudioManager.applyMasterReverb(val);
    });
    reverbSlider?.addEventListener("change", () => {
      void saveMasterReverb(Number(reverbSlider.value));
    });

    // === Bank list ===
    const bankListItems = el.querySelectorAll<HTMLDivElement>(".soundbard-bank-item");

    bankListItems.forEach(item => {
      const bankId = Number(item.dataset.bankId);

      // Single click: switch bank
      item.addEventListener("click", (e) => {
        if (item.classList.contains("active")) return;
        if (e.target instanceof HTMLInputElement) return;
        void setActiveBankId(bankId).then(() => SoundboardApp.refresh());
      });

      // Double click on active item: rename inline
      item.addEventListener("dblclick", (e) => {
        if (!item.classList.contains("active")) return;
        if (e.target instanceof HTMLInputElement) return;
        this._startInlineRename(item, bankId);
      });

      // Right-click: context menu with Rename option
      item.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        showBankContextMenu(e.clientX, e.clientY, () => this._startInlineRename(item, bankId));
      });
    });

    // === Sound search ===
    // Typing searches sound names across ALL banks: the bank list is swapped for a
    // results panel, and matching slots in the *current* bank are also highlighted.
    const searchInput = el.querySelector<HTMLInputElement>(".soundbard-bank-search");
    const slotButtons = el.querySelectorAll<HTMLButtonElement>(".soundbard-slot");
    const bankList = el.querySelector<HTMLElement>(".soundbard-bank-list");
    const resultsPanel = el.querySelector<HTMLElement>(".soundbard-search-results");
    const resultItems = el.querySelectorAll<HTMLElement>(".soundbard-search-result");
    const emptyMsg = el.querySelector<HTMLElement>(".soundbard-search-empty");

    searchInput?.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();

      // Highlight matches within the current bank's grid
      slotButtons.forEach(btn => {
        if (!q) { btn.classList.remove("search-dim"); return; }
        const name = btn.dataset.name ?? "";
        btn.classList.toggle("search-dim", !(name.length > 0 && name.includes(q)));
      });

      // Swap bank list <-> cross-bank results
      if (!q) {
        if (bankList) bankList.style.display = "";
        if (resultsPanel) resultsPanel.style.display = "none";
        return;
      }
      if (bankList) bankList.style.display = "none";
      if (resultsPanel) resultsPanel.style.display = "";

      let anyMatch = false;
      resultItems.forEach(item => {
        const match = (item.dataset.name ?? "").includes(q);
        item.style.display = match ? "" : "none";
        if (match) anyMatch = true;
      });
      if (emptyMsg) emptyMsg.style.display = anyMatch ? "none" : "";
    });

    // Enter jumps to the first visible result
    searchInput?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const first = resultsPanel?.querySelector<HTMLElement>(
        '.soundbard-search-result:not([style*="display: none"])',
      );
      first?.click();
    });

    // Clicking a result jumps to its bank and flashes the slot
    resultItems.forEach(item => {
      item.addEventListener("click", () => {
        const bankId = Number(item.dataset.bankId);
        const slotIndex = Number(item.dataset.slotIndex);
        if (getActiveBankId() === bankId) {
          SoundboardApp._flashSlot(el, slotIndex);
        } else {
          SoundboardApp.pendingFlash = { bankId, slotIndex };
          void setActiveBankId(bankId).then(() => SoundboardApp.refresh());
        }
      });
    });

    // Flash a slot after a cross-bank jump finishes rendering
    if (SoundboardApp.pendingFlash) {
      const { bankId, slotIndex } = SoundboardApp.pendingFlash;
      SoundboardApp.pendingFlash = null;
      if (getActiveBankId() === bankId) SoundboardApp._flashSlot(el, slotIndex);
    }

    // Scroll active bank into view
    el.querySelector(".soundbard-bank-item.active")?.scrollIntoView({ block: "nearest" });
  }

  private static _flashSlot(root: HTMLElement, slotIndex: number): void {
    const btn = root.querySelector<HTMLButtonElement>(`.soundbard-slot[data-slot-index="${slotIndex}"]`);
    if (!btn) return;
    btn.scrollIntoView({ block: "nearest" });
    btn.classList.remove("search-flash");
    void btn.offsetWidth; // force reflow so the animation restarts
    btn.classList.add("search-flash");
    btn.addEventListener("animationend", () => btn.classList.remove("search-flash"), { once: true });
  }

  private _startInlineRename(item: HTMLDivElement, bankId: number): void {
    const nameSpan = item.querySelector<HTMLSpanElement>(".soundbard-bank-name");
    if (!nameSpan) return;

    const all = getAllBanks();
    const bank = all.banks.find(b => b.id === bankId);
    if (!bank) return;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "soundbard-bank-rename";
    input.value = bank.name;
    input.placeholder = `Bank ${bankId}`;
    input.maxLength = 30;
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    let done = false;
    const commit = async () => {
      if (done) return;
      done = true;
      const freshAll = getAllBanks();
      const b = freshAll.banks.find(b => b.id === bankId);
      if (b) {
        b.name = input.value.trim();
        await saveAllBanks(freshAll);
      }
      SoundboardApp.refresh();
    };
    const cancel = () => {
      if (done) return;
      done = true;
      SoundboardApp.refresh();
    };

    input.addEventListener("blur", () => void commit());
    input.addEventListener("keydown", (ke) => {
      if (ke.key === "Enter") { ke.preventDefault(); void commit(); }
      if (ke.key === "Escape") { ke.preventDefault(); cancel(); }
    });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatBindingShort(b: ClientKeybindings.KeybindingActionBinding): string {
  const key = b.key.startsWith("Key") ? b.key.slice(3)
    : b.key.startsWith("Digit") ? b.key.slice(5)
    : b.key;
  const modMap: Record<string, string> = { control: "Ctrl", alt: "Alt", shift: "⇧", meta: "⌘" };
  const parts = [...(b.modifiers ?? []).map(m => modMap[m.toLowerCase()] ?? m), key];
  return parts.join("+");
}

function showBankContextMenu(x: number, y: number, onRename: () => void): void {
  document.querySelectorAll(".soundbard-ctx-menu").forEach(m => m.remove());

  const menu = document.createElement("div");
  menu.className = "soundbard-ctx-menu";
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  const renameItem = document.createElement("div");
  renameItem.className = "soundbard-ctx-item";
  renameItem.innerHTML = '<i class="fa-solid fa-pencil"></i> ' + game.i18n.localize("SOUNDBARD.RenameBank");
  renameItem.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.remove();
    onRename();
  });

  menu.appendChild(renameItem);
  document.body.appendChild(menu);

  const dismiss = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      menu.remove();
      document.removeEventListener("click", dismiss);
    }
  };
  setTimeout(() => document.addEventListener("click", dismiss), 0);
}

function showInfoModal(): void {
  document.querySelectorAll(".soundbard-info-overlay").forEach(m => m.remove());

  const overlay = document.createElement("div");
  overlay.className = "soundbard-info-overlay";

  const modal = document.createElement("div");
  modal.className = "soundbard-info-modal";

  modal.innerHTML = `
    <button class="soundbard-info-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    <div class="soundbard-info-logo">
      <i class="fa-solid fa-music"></i>
      <span class="soundbard-info-title">SoundBard</span>
    </div>
    <p class="soundbard-info-byline">By <a href="https://campendium.io" target="_blank" rel="noopener noreferrer">Campendium</a></p>
    <p class="soundbard-info-desc">A digital toolkit for TTRPG GMs and worldbuilders alike.</p>
    <a class="soundbard-info-link" href="https://campendium.io" target="_blank" rel="noopener noreferrer">
      <i class="fa-solid fa-arrow-up-right-from-square"></i> campendium.io
    </a>
  `;

  modal.querySelector(".soundbard-info-close")?.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}
