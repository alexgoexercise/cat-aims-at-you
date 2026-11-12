// Turns MediaPipe face blendshapes into expression values for the cat, so it
// copies your face like a mirror: close your left eye and the cat closes the
// eye on the left of the screen.

// MediaPipe names eyes from the subject's point of view (eyeBlinkLeft = your
// left eye), which appears on the left of a selfie-style mirror. If winks come
// out on the wrong side on some device, flip this.
const SWAP_EYES = false;

// Raw scores rarely sit at exactly 0 or 1, so each one is remapped from a
// [lo, hi] band to 0..1. Raise `lo` if the cat twitches, lower `hi` if it
// never goes all the way.
const BANDS = {
  blink: [0.2, 0.65],
  jaw: [0.08, 0.55],
  smile: [0.2, 0.65],
  browUp: [0.25, 0.7],
  browDown: [0.15, 0.55],
  puff: [0.15, 0.55],
  pucker: [0.35, 0.85],
};

const band = (v, [lo, hi]) => Math.min(1, Math.max(0, (v - lo) / (hi - lo)));

/** @returns cat expression values, or null if there's nothing to copy */
export function faceToCatExpression(blendshapes) {
  if (!blendshapes?.length) return null;
  const s = {};
  for (const c of blendshapes) s[c.categoryName] = c.score;
  const g = (name) => s[name] ?? 0;

  const left = band(g('eyeBlinkLeft'), BANDS.blink);
  const right = band(g('eyeBlinkRight'), BANDS.blink);
  return {
    eyeL: SWAP_EYES ? right : left,
    eyeR: SWAP_EYES ? left : right,
    jaw: band(g('jawOpen'), BANDS.jaw),
    smile: band((g('mouthSmileLeft') + g('mouthSmileRight')) / 2, BANDS.smile),
    browUp: band(g('browInnerUp'), BANDS.browUp),
    browDown: band((g('browDownLeft') + g('browDownRight')) / 2, BANDS.browDown),
    puff: band(g('cheekPuff'), BANDS.puff),
    pucker: band(g('mouthPucker'), BANDS.pucker),
  };
}

/** A meme caption reacting to what your face is doing, or null. */
export function reactionCaption(e) {
  if (!e) return null;
  if (e.jaw > 0.6) return ['AM I BORING YOU?', 'YAWN AGAIN. I DARE YOU'];
  if (Math.abs(e.eyeL - e.eyeR) > 0.6 && Math.max(e.eyeL, e.eyeR) > 0.7) return ['DID YOU JUST WINK AT ME', ''];
  if (e.pucker > 0.6) return ['UGH. NO.', ''];
  if (e.puff > 0.6) return ['STOP HOLDING YOUR BREATH', ''];
  if (e.smile > 0.6) return ['SOMETHING FUNNY?', ''];
  return null;
}
