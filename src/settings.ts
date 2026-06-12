import {
  MODULE_ID, BANK_SETTING, MASTER_VOLUME_SETTING, MASTER_REVERB_SETTING,
  ACTIVE_BANK_SETTING, DEFAULT_COLUMNS, DEFAULT_ROWS, NUM_BANKS,
} from "./constants.ts";
import { AllBanksData, Bank, SlotData, emptySlot, makeAllBanks, makeSingleBank } from "./types.ts";

let _onResize: (() => void) | null = null;
export function setResizeCallback(fn: () => void): void {
  _onResize = fn;
}

export function registerSettings(): void {
  game.settings.register(MODULE_ID, BANK_SETTING, {
    name: "Sound Banks",
    scope: "client",
    config: false,
    type: Object,
    default: makeAllBanks(NUM_BANKS, DEFAULT_COLUMNS, DEFAULT_ROWS),
  });

  game.settings.register(MODULE_ID, ACTIVE_BANK_SETTING, {
    name: "Active Bank",
    scope: "client",
    config: false,
    type: Number,
    default: 1,
  });

  game.settings.register(MODULE_ID, MASTER_VOLUME_SETTING, {
    name: "Master Volume",
    scope: "client",
    config: false,
    type: Number,
    default: 1.0,
  });

  game.settings.register(MODULE_ID, MASTER_REVERB_SETTING, {
    name: "Master Reverb",
    scope: "client",
    config: false,
    type: Number,
    default: 0,
  });

  game.settings.register(MODULE_ID, "columns", {
    name: game.i18n.localize("SOUNDBARD.SettingsColumns"),
    hint: game.i18n.localize("SOUNDBARD.SettingsColumnsHint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 2, max: 8, step: 1 },
    default: DEFAULT_COLUMNS,
    onChange: (value: number) => {
      const rows = game.settings.get(MODULE_ID, "rows") as number;
      void resizeGrid(value, rows);
    },
  });

  game.settings.register(MODULE_ID, "rows", {
    name: game.i18n.localize("SOUNDBARD.SettingsRows"),
    hint: game.i18n.localize("SOUNDBARD.SettingsRowsHint"),
    scope: "client",
    config: true,
    type: Number,
    range: { min: 2, max: 8, step: 1 },
    default: DEFAULT_ROWS,
    onChange: (value: number) => {
      const columns = game.settings.get(MODULE_ID, "columns") as number;
      void resizeGrid(columns, value);
    },
  });
}

export function getMasterVolume(): number {
  return game.settings.get(MODULE_ID, MASTER_VOLUME_SETTING) as number;
}

export async function saveMasterVolume(value: number): Promise<void> {
  await game.settings.set(MODULE_ID, MASTER_VOLUME_SETTING, value);
}

export function getMasterReverb(): number {
  return game.settings.get(MODULE_ID, MASTER_REVERB_SETTING) as number;
}

export async function saveMasterReverb(value: number): Promise<void> {
  await game.settings.set(MODULE_ID, MASTER_REVERB_SETTING, value);
}

export function getActiveBankId(): number {
  return (game.settings.get(MODULE_ID, ACTIVE_BANK_SETTING) as number) ?? 1;
}

export async function setActiveBankId(id: number): Promise<void> {
  await game.settings.set(MODULE_ID, ACTIVE_BANK_SETTING, id);
}

interface LegacyBankData {
  columns: number;
  rows: number;
  slots: SlotData[];
}

export function getAllBanks(): AllBanksData {
  const raw = game.settings.get(MODULE_ID, BANK_SETTING) as AllBanksData | LegacyBankData;

  // Migrate from old single-bank format ({ columns, rows, slots })
  if ("slots" in raw && Array.isArray((raw as LegacyBankData).slots) && !("banks" in raw)) {
    const legacy = raw as LegacyBankData;
    const cols = (game.settings.get(MODULE_ID, "columns") as number) ?? DEFAULT_COLUMNS;
    const rows = (game.settings.get(MODULE_ID, "rows") as number) ?? DEFAULT_ROWS;
    const migrated = makeAllBanks(NUM_BANKS, cols, rows);
    migrated.banks[0].slots = legacy.slots;
    void saveAllBanks(migrated);
    return migrated;
  }

  const data = raw as AllBanksData;

  // Expand if NUM_BANKS was increased after initial save
  if (data.banks.length < NUM_BANKS) {
    const cols = (game.settings.get(MODULE_ID, "columns") as number) ?? DEFAULT_COLUMNS;
    const rows = (game.settings.get(MODULE_ID, "rows") as number) ?? DEFAULT_ROWS;
    for (let i = data.banks.length + 1; i <= NUM_BANKS; i++) {
      data.banks.push(makeSingleBank(i, cols, rows));
    }
    void saveAllBanks(data);
  }

  return data;
}

export async function saveAllBanks(data: AllBanksData): Promise<void> {
  await game.settings.set(MODULE_ID, BANK_SETTING, data);
}

export function getActiveBank(): Bank {
  const all = getAllBanks();
  const id = getActiveBankId();
  return all.banks.find(b => b.id === id) ?? all.banks[0];
}

export async function saveSingleBank(bank: Bank): Promise<void> {
  const all = getAllBanks();
  const idx = all.banks.findIndex(b => b.id === bank.id);
  if (idx >= 0) all.banks[idx] = bank;
  await saveAllBanks(all);
}

async function resizeGrid(columns: number, rows: number): Promise<void> {
  const all = getAllBanks();
  const newCount = columns * rows;
  for (const bank of all.banks) {
    const old = bank.slots;
    bank.slots = Array.from({ length: newCount }, (_, i) => old[i] ?? emptySlot(i));
  }
  await saveAllBanks(all);
  _onResize?.();
}
