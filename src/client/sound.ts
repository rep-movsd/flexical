// Tiny WebAudio blips — no asset files. The AudioContext is created lazily on
// the first user gesture so browser autoplay policies don't block it.

const SOUND_KEY = "flexical:sound";

let ctx: AudioContext | null = null;
let enabled = readEnabled();

function readEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Whether sound effects are currently enabled. */
export function isSoundOn(): boolean {
  return enabled;
}

/** Enable or disable sound effects (persisted locally). */
export function setSoundOn(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // ignore (private mode, quota, …)
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function blip(freq: number, type: OscillatorType, peak: number, duration: number): void {
  if (!enabled) return;
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

// CDEFGAB, three octaves up from the octave below middle C (C3 → B5). The note
// for a keystroke is picked from the input's current length (stateless).
const SEMITONES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const NOTES: number[] = [];
for (let octave = 3; octave <= 5; octave++) {
  const base = 261.63 * 2 ** (octave - 4); // C4 = middle C
  for (const semi of SEMITONES) NOTES.push(base * 2 ** (semi / 12));
}

/** Play the scale note for a 0-based position, clamping at the top note. */
export function click(index: number): void {
  blip(NOTES[Math.max(0, Math.min(index, NOTES.length - 1))], "square", 0.05, 0.06);
}

/** A low buzz for a rejected word or a disallowed key. */
export function beep(): void {
  blip(150, "sawtooth", 0.08, 0.18);
}
