type Tone = { freq: number; dur: number; type?: OscillatorType; delay?: number; gain?: number };

let ctx: AudioContext | null = null;
let muted = false;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(value: boolean) {
  muted = value;
  if (typeof window !== "undefined") window.localStorage.setItem("ludo-muted", value ? "1" : "0");
}

export function isMuted() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("ludo-muted") === "1";
}

function play(tones: Tone[]) {
  if (muted || isMuted()) return;
  const ac = audio();
  if (!ac) return;
  for (const tone of tones) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = tone.type ?? "triangle";
    osc.frequency.value = tone.freq;
    const start = ac.currentTime + (tone.delay ?? 0);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(tone.gain ?? 0.12, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + tone.dur + 0.05);
  }
}

export const sfx = {
  click: () => play([{ freq: 620, dur: 0.08, type: "square", gain: 0.05 }]),
  dice: () =>
    play([
      { freq: 300, dur: 0.07, type: "square", gain: 0.06 },
      { freq: 420, dur: 0.07, type: "square", delay: 0.08, gain: 0.06 },
      { freq: 560, dur: 0.12, type: "square", delay: 0.17, gain: 0.07 },
    ]),
  step: () => play([{ freq: 740, dur: 0.06, gain: 0.06 }]),
  capture: () =>
    play([
      { freq: 220, dur: 0.16, type: "sawtooth", gain: 0.09 },
      { freq: 160, dur: 0.22, type: "sawtooth", delay: 0.1, gain: 0.08 },
    ]),
  home: () =>
    play([
      { freq: 660, dur: 0.14 },
      { freq: 880, dur: 0.2, delay: 0.12 },
    ]),
  win: () =>
    play([
      { freq: 523, dur: 0.18 },
      { freq: 659, dur: 0.18, delay: 0.16 },
      { freq: 784, dur: 0.22, delay: 0.32 },
      { freq: 1046, dur: 0.4, delay: 0.5 },
    ]),
  message: () => play([{ freq: 880, dur: 0.08, gain: 0.05 }]),
};