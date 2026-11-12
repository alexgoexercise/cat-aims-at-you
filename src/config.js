// Tunables. Most can be overridden with URL params, e.g. ?fov=78&parallax=0
const params = new URLSearchParams(location.search);
const num = (key, fallback) => (params.has(key) && !isNaN(+params.get(key)) ? +params.get(key) : fallback);

const isTouch = matchMedia('(pointer: coarse)').matches;

export const CONFIG = {
  // Physical size of one CSS pixel, used to estimate the screen's real size in meters.
  // ~0.21 mm on laptops, ~0.18 mm on phones.
  metersPerCssPixel: num('mpp', isTouch ? 0.00018 : 0.00021),

  // Diagonal field of view of the front camera. Laptop webcams ~70-78°, phones ~75-85°.
  cameraDiagonalFovDeg: num('fov', isTouch ? 78 : 72),

  // Average adult interpupillary distance, used to estimate how far your face is.
  ipdMeters: 0.063,

  // Where we assume your eyes are before / without tracking (meters from screen center).
  defaultEyeDistance: num('dist', isTouch ? 0.35 : 0.55),

  // Laptop lid tilt back from vertical, in degrees. Leave null to estimate it
  // automatically; ?tilt=20 forces a value.
  manualTiltDeg: params.has('tilt') ? num('tilt', null) : null,

  // Head-coupled perspective: the 3D scene behaves like a window you look through.
  headCoupledPerspective: params.get('parallax') !== '0',

  // One-euro filter (jitter vs. latency). Higher beta = snappier when you move fast.
  filter: { minCutoff: 1.0, beta: 4.0, dCutoff: 1.0 },

  mediapipe: {
    wasmUrl: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
    modelUrl:
      'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  },
};
