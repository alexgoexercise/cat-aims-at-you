// Tiny synthesized "pew" so there are no audio files to ship.
let ctx = null;

export function unlockAudio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

export function pew() {
  unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1100, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.18);
  gain.gain.setValueAtTime(0.18, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.22);
}
