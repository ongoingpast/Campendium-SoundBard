export interface SlotData {
  id: number;
  name: string;
  src: string;
  emoji: string;
  volume: number;
  loop: boolean;
  // Seconds to pause between loop iterations. 0 = continuous (gapless) loop.
  loopDelay: number;
  reverb: number;
  // 3-band EQ gains in dB, range -12..+12, 0 = flat
  eqLow: number;
  eqMid: number;
  eqHigh: number;
}

export interface Bank {
  id: number;    // 1-based
  name: string;  // empty string means "Bank {id}"
  slots: SlotData[];
}

export interface AllBanksData {
  banks: Bank[];
}

export function emptySlot(id: number): SlotData {
  return { id, name: "", src: "", emoji: "", volume: 1, loop: false, loopDelay: 0, reverb: 0, eqLow: 0, eqMid: 0, eqHigh: 0 };
}

export function makeSingleBank(id: number, columns: number, rows: number): Bank {
  const count = columns * rows;
  return {
    id,
    name: "",
    slots: Array.from({ length: count }, (_, i) => emptySlot(i)),
  };
}

export function makeAllBanks(numBanks: number, columns: number, rows: number): AllBanksData {
  return {
    banks: Array.from({ length: numBanks }, (_, i) => makeSingleBank(i + 1, columns, rows)),
  };
}
