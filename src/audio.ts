import { SlotData } from "./types.ts";
import { getMasterVolume, getMasterReverb } from "./settings.ts";
import { MODULE_ID } from "./constants.ts";

let _refreshPanel: (() => void) | null = null;
export function setRefreshCallback(fn: () => void): void {
  _refreshPanel = fn;
}

function silentStop(sound: foundry.audio.Sound): void {
  try { void sound.stop(); } catch { /* already ended */ }
}

interface ReverbNodes {
  dryGain: GainNode;
  wetGain: GainNode;
  convolver: ConvolverNode;
}

interface EQNodes {
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
}

// Center frequencies for the 3-band EQ
const EQ_LOW_FREQ = 250;
const EQ_MID_FREQ = 1000;
const EQ_HIGH_FREQ = 4000;

// Cached impulse response buffer — regenerated only if sampleRate changes
let _impulseBuffer: AudioBuffer | null = null;

function getImpulseBuffer(ctx: AudioContext): AudioBuffer {
  if (!_impulseBuffer || _impulseBuffer.sampleRate !== ctx.sampleRate) {
    const sr = ctx.sampleRate;
    const length = Math.floor(sr * 2.5);
    const buf = ctx.createBuffer(2, length, sr);
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
      }
    }
    _impulseBuffer = buf;
  }
  return _impulseBuffer;
}

function teardownReverb(nodes: ReverbNodes | undefined): void {
  if (!nodes) return;
  try { nodes.dryGain.disconnect(); } catch { /* already disconnected */ }
  try { nodes.wetGain.disconnect(); } catch { /* already disconnected */ }
  try { nodes.convolver.disconnect(); } catch { /* already disconnected */ }
}

function teardownEQ(nodes: EQNodes | undefined): void {
  if (!nodes) return;
  try { nodes.low.disconnect(); } catch { /* already disconnected */ }
  try { nodes.mid.disconnect(); } catch { /* already disconnected */ }
  try { nodes.high.disconnect(); } catch { /* already disconnected */ }
}

export class AudioManager {
  private static activeSounds = new Map<number, { sound: foundry.audio.Sound; slotVolume: number; slotReverb: number; reverbNodes?: ReverbNodes; eqNodes?: EQNodes; loopTimer?: ReturnType<typeof setTimeout> }>();

  // Live values kept in sync with the sliders — used when starting new sounds so
  // they respect the current slider position even before settings.set() completes.
  private static _liveVolume: number | null = null;
  private static _liveReverb: number | null = null;

  static getLiveVolume(): number {
    return AudioManager._liveVolume ?? getMasterVolume();
  }
  static getLiveReverb(): number {
    return AudioManager._liveReverb ?? getMasterReverb();
  }

  static async play(slot: SlotData, broadcast = true): Promise<void> {
    if (broadcast) {
      (game.socket as unknown as { emit(event: string, data: unknown): void })
        ?.emit(`module.${MODULE_ID}`, { action: "play", slot });
    }

    // Stop old sound immediately — fire and forget, never let it block the new play
    const existing = AudioManager.activeSounds.get(slot.id);
    AudioManager.activeSounds.delete(slot.id);
    if (existing) {
      if (existing.loopTimer) clearTimeout(existing.loopTimer);
      teardownReverb(existing.reverbNodes);
      teardownEQ(existing.eqNodes);
      silentStop(existing.sound);
    }

    // Resume AudioContext before async work
    const ctx = (game.audio as unknown as { context?: AudioContext }).context;
    if (ctx?.state === "suspended") await ctx.resume();

    // Always create a fresh Sound via the constructor to bypass game.audio.create() caching
    const SoundClass = foundry.audio.Sound as unknown as new (src: string) => foundry.audio.Sound;
    const sound = new SoundClass(slot.src);

    try {
      await sound.load();
    } catch {
      ui.notifications?.error(
        game.i18n.format("SOUNDBARD.ErrorLoadFailed", { name: slot.name || slot.src })
      );
      return;
    }

    // Native (gapless) loop only when there's no delay; a positive delay is handled
    // manually by re-triggering after the sound ends (see the "end" listener below).
    const loopDelayMs = Math.max(0, slot.loopDelay ?? 0) * 1000;
    const manualLoop = slot.loop && loopDelayMs > 0;

    try {
      await sound.play({ volume: slot.volume * AudioManager.getLiveVolume() * AudioManager.muteFactor(), loop: slot.loop && !manualLoop });
    } catch {
      ui.notifications?.error(
        game.i18n.format("SOUNDBARD.ErrorLoadFailed", { name: slot.name || slot.src })
      );
      return;
    }

    // Always wire the FX graph so the live panel sliders can adjust already-playing sounds.
    // Signal chain: gainNode -> [EQ low -> mid -> high] -> dry/wet reverb split -> destination
    const slotReverb = slot.reverb ?? 0;
    let reverbNodes: ReverbNodes | undefined;
    let eqNodes: EQNodes | undefined;
    if (ctx) {
      const soundAny = sound as unknown as { gainNode: GainNode };
      const gainNode = soundAny.gainNode;
      // Connect to the raw AudioContext destination, NOT sound.destination.
      // A Sound created without an explicit context defaults to game.audio.music,
      // whose .destination is the Music-bus gain node (the global Music slider).
      // Routing to ctx.destination bypasses that bus so SoundBard volume is
      // governed solely by our own master slider and per-slot gain.
      const destination: AudioNode = ctx.destination;

      // 3-band EQ
      const low = ctx.createBiquadFilter();
      low.type = "lowshelf";
      low.frequency.value = EQ_LOW_FREQ;
      low.gain.value = slot.eqLow ?? 0;

      const mid = ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = EQ_MID_FREQ;
      mid.Q.value = 1.0;
      mid.gain.value = slot.eqMid ?? 0;

      const high = ctx.createBiquadFilter();
      high.type = "highshelf";
      high.frequency.value = EQ_HIGH_FREQ;
      high.gain.value = slot.eqHigh ?? 0;

      // Reverb dry/wet
      const convolver = ctx.createConvolver();
      convolver.buffer = getImpulseBuffer(ctx);

      const dryGain = ctx.createGain();
      dryGain.gain.value = 1.0;
      const wetGain = ctx.createGain();
      wetGain.gain.value = Math.min(1, slotReverb + AudioManager.getLiveReverb());

      gainNode.disconnect();
      gainNode.connect(low);
      low.connect(mid);
      mid.connect(high);
      high.connect(dryGain);
      dryGain.connect(destination);
      high.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(destination);

      reverbNodes = { dryGain, wetGain, convolver };
      eqNodes = { low, mid, high };
    }

    const entry = { sound, slotVolume: slot.volume, slotReverb, reverbNodes, eqNodes } as {
      sound: foundry.audio.Sound; slotVolume: number; slotReverb: number;
      reverbNodes?: ReverbNodes; eqNodes?: EQNodes; loopTimer?: ReturnType<typeof setTimeout>;
    };
    AudioManager.activeSounds.set(slot.id, entry);
    _refreshPanel?.();

    sound.addEventListener("end", () => {
      // If this entry was already replaced or stopped, this is a stale end — ignore it
      // (a manual stop deletes the entry before the "end" event fires).
      if (AudioManager.activeSounds.get(slot.id) !== entry) return;

      if (manualLoop) {
        // Keep the slot marked active during the gap, then re-trigger after the delay.
        teardownReverb(entry.reverbNodes);
        teardownEQ(entry.eqNodes);
        entry.loopTimer = setTimeout(() => {
          if (AudioManager.activeSounds.get(slot.id) !== entry) return;
          void AudioManager.play(slot, false);
        }, loopDelayMs);
      } else {
        AudioManager.activeSounds.delete(slot.id);
        _refreshPanel?.();
      }
    });
  }

  static async stop(slotId: number, broadcast = true): Promise<void> {
    if (broadcast) {
      (game.socket as unknown as { emit(event: string, data: unknown): void })
        ?.emit(`module.${MODULE_ID}`, { action: "stop", slotId });
    }
    const entry = AudioManager.activeSounds.get(slotId);
    AudioManager.activeSounds.delete(slotId);
    if (entry) {
      if (entry.loopTimer) clearTimeout(entry.loopTimer);
      teardownReverb(entry.reverbNodes);
      teardownEQ(entry.eqNodes);
      silentStop(entry.sound);
    }
  }

  static stopAll(broadcast = true): void {
    if (broadcast) {
      (game.socket as unknown as { emit(event: string, data: unknown): void })
        ?.emit(`module.${MODULE_ID}`, { action: "stopAll" });
    }
    for (const entry of AudioManager.activeSounds.values()) {
      if (entry.loopTimer) clearTimeout(entry.loopTimer);
      teardownReverb(entry.reverbNodes);
      teardownEQ(entry.eqNodes);
      silentStop(entry.sound);
    }
    AudioManager.activeSounds.clear();
    _refreshPanel?.();
  }

  static isPlaying(slotId: number): boolean {
    return AudioManager.activeSounds.has(slotId);
  }

  // SoundBard bypasses Foundry's audio buses (see play()), so it must honor the
  // global mute itself: 0 when muted, 1 otherwise.
  static muteFactor(): number {
    return (game.audio as unknown as { globalMute?: boolean }).globalMute ? 0 : 1;
  }

  static applyMasterVolume(masterVolume: number): void {
    AudioManager._liveVolume = masterVolume;
    const mute = AudioManager.muteFactor();
    for (const { sound, slotVolume } of AudioManager.activeSounds.values()) {
      sound.volume = slotVolume * masterVolume * mute;
    }
  }

  // Re-apply gains when Foundry's global mute toggles. There is no dedicated mute
  // hook; toggling it fires the global*VolumeChanged hooks, which call this.
  static applyGlobalMute(): void {
    const volume = AudioManager.getLiveVolume();
    const mute = AudioManager.muteFactor();
    for (const { sound, slotVolume } of AudioManager.activeSounds.values()) {
      sound.volume = slotVolume * volume * mute;
    }
  }

  static applyMasterReverb(masterReverb: number): void {
    AudioManager._liveReverb = masterReverb;
    for (const { slotReverb, reverbNodes } of AudioManager.activeSounds.values()) {
      if (reverbNodes) {
        reverbNodes.wetGain.gain.value = Math.min(1, slotReverb + masterReverb);
      }
    }
  }
}
