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

// Head roll is copied mirror-style: tilt toward your right shoulder and the cat's
// head tilts toward the right of the screen. Flip if it goes the wrong way.
const ROLL_SIGN = 1;
const MAX_ROLL = (40 * Math.PI) / 180;

/**
 * Head roll from MediaPipe's facial transformation matrix, returned as the
 * rotation (radians, about the cat's forward axis) to apply to the cat's head.
 */
export function rollFromFaceMatrix(m) {
  if (!m || m.length < 16) return 0;
  // Translation z is clearly non-zero; use it to tell column-major from row-major.
  const colMajor = Math.abs(m[14]) >= Math.abs(m[11]);
  const upX = colMajor ? m[4] : m[1];
  const upY = m[5]; // same index in both layouts
  // In camera space the top of your head moves toward -x (image left) when you tilt
  // to your right; in the mirror view that's screen-right, i.e. a negative rotation
  // about the cat's forward axis.
  const roll = ROLL_SIGN * -Math.atan2(-upX, upY);
  return Math.max(-MAX_ROLL, Math.min(MAX_ROLL, roll));
}

/** @returns cat expression values, or null if there's nothing to copy */
export function faceToCatExpression(blendshapes, poseMatrix) {
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
    roll: rollFromFaceMatrix(poseMatrix),
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
  if (Math.abs(e.roll) > 0.4) return ['WHY IS YOUR HEAD TILTED', 'CONFUSED?'];
  return null;
}
