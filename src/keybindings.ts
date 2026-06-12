import { MODULE_ID, MAX_SLOTS, DEFAULT_COLUMNS, DEFAULT_ROWS, NUM_BANKS } from "./constants.ts";
import { getActiveBankId, setActiveBankId, getAllBanks } from "./settings.ts";
import { AudioManager } from "./audio.ts";
import { SoundboardApp } from "./apps/SoundboardApp.ts";

export function registerKeybindings(): void {
  const columns = (game.settings.get(MODULE_ID, "columns") as number) ?? DEFAULT_COLUMNS;
  const rows = (game.settings.get(MODULE_ID, "rows") as number) ?? DEFAULT_ROWS;
  const gridSize = Math.min(columns * rows, MAX_SLOTS);

  for (let b = 1; b <= NUM_BANKS; b++) {
    const bankId = b;
    for (let i = 0; i < gridSize; i++) {
      const slotIndex = i;
      game.keybindings.register(MODULE_ID, `bank-${bankId}-slot-${slotIndex}`, {
        name: `Slot ${slotIndex + 1}`,
        editable: [],
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
        onDown: () => {
          if (!game.user?.isGM) return false;
          const all = getAllBanks();
          const bank = all.banks.find(b => b.id === bankId);
          const slot = bank?.slots[slotIndex];
          if (slot?.src) {
            if (getActiveBankId() !== bankId) {
              void setActiveBankId(bankId).then(() => SoundboardApp.refresh());
            }
            const uid = bankId * MAX_SLOTS + slotIndex;
            void AudioManager.play({ ...slot, id: uid });
            return true;
          }
          return false;
        },
      });
    }
  }
}

export function injectSoundbardKeybindGroups(root: HTMLElement): void {
  const allBanks = getAllBanks();

  const slotRows = Array.from(
    root.querySelectorAll<HTMLElement>('[data-action-id^="soundbard.bank-"]'),
  );
  if (!slotRows.length) return;

  if (root.querySelector(".soundbard-keybind-group-header")) return;

  let lastBankId = -1;

  for (const el of slotRows) {
    const actionId = el.dataset.actionId ?? "";
    // Format: "soundbard.bank-{bankId}-slot-{slotIndex}"
    const afterBank = actionId.split(".bank-")[1] ?? "";
    const bankId = parseInt(afterBank.split("-slot-")[0] ?? "0", 10);

    if (bankId === lastBankId) continue;

    const bank = allBanks.banks.find(b => b.id === bankId);
    const label = bank?.name ? `Bank ${bankId} — ${bank.name}` : `Bank ${bankId}`;

    const header = document.createElement("div");
    header.className = "soundbard-keybind-group-header";
    header.innerHTML = `<span>${label}</span>`;
    el.parentElement?.insertBefore(header, el);

    lastBankId = bankId;
  }
}
