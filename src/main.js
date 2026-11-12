import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createCat } from './cat.js';
import { createRoom } from './room.js';
import { FaceTracker } from './tracker.js';
import { OneEuroVec3 } from './filter.js';
import { pew, unlockAudio } from './sfx.js';
import { LevelSensor, detectDeviceKind, tiltFromFaceMatrix } from './level.js';

// World space = physical meters, origin at the centre of the screen,
// +x right, +y up along the screen, +z out of the screen toward the viewer.
// The room and cat live in a child "gravity" group whose +y is real-world up.

const $ = (id) => document.getElementById(id);
const ui = {
  canvas: $('scene'),
  capTop: $('capTop'),
  capBottom: $('capBottom'),
  flash: $('flash'),
  intro: $('intro'),
  startBtn: $('startBtn'),
  mouseBtn: $('mouseBtn'),
  introStatus: $('introStatus'),
  status: $('status'),
  pipBtn: $('pipBtn'),
  pip: $('pip'),
  video: $('video'),
  pipOverlay: $('pipOverlay'),
  levelBtn: $('levelBtn'),
  levelPanel: $('levelPanel'),
  tiltRow: $('tiltRow'),
  tiltRange: $('tiltRange'),
  tiltOut: $('tiltOut'),
  tiltAuto: $('tiltAuto'),
  motionBtn: $('motionBtn'),
  levelNote: $('levelNote'),
};

const deviceKind = detectDeviceKind();
const level = new LevelSensor({ kind: deviceKind, manualTiltDeg: CONFIG.manualTiltDeg });

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1430);

const camera = new THREE.PerspectiveCamera();
camera.matrixAutoUpdate = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x44336a, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.bias = -0.0005;

// Everything that should obey real-world gravity hangs off this group.
const gravity = new THREE.Group();
scene.add(gravity);
gravity.add(sun, sun.target);

const cat = createCat();
gravity.add(cat.root);

// Only keep room geometry behind the glass (screen-space z <= 0).
const screenClip = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];

const screen = { w: 0.3, h: 0.2 };
let room = null;
let layoutKey = '';

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  screen.w = w * CONFIG.metersPerCssPixel;
  screen.h = h * CONFIG.metersPerCssPixel;
  layoutKey = ''; // force a rebuild
}
window.addEventListener('resize', resize);
window.screen.orientation?.addEventListener?.('change', resize);
resize();

/**
 * Place the gravity group so its floor is level with the real world:
 * - laptop: the floor plane runs through the hinge, i.e. level with the keyboard;
 * - phone: the floor stays parallel to the horizon and sits at the lowest point of the screen.
 */
const _q = new THREE.Quaternion();
const _lx = new THREE.Vector3();
const _lz = new THREE.Vector3();
const _corner = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

function layoutWorld(up) {
  _q.setFromUnitVectors(Y, up);
  _lx.set(1, 0, 0).applyQuaternion(_q);
  _lz.set(0, 0, 1).applyQuaternion(_q);

  // Heights (along real "up") and sideways extents of the four screen corners.
  let minH = Infinity, maxH = -Infinity, halfW = 0;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      _corner.set((sx * screen.w) / 2, (sy * screen.h) / 2, 0);
      const hgt = _corner.dot(up);
      minH = Math.min(minH, hgt);
      maxH = Math.max(maxH, hgt);
      halfW = Math.max(halfW, Math.abs(_corner.dot(_lx)));
    }
  }
  // Laptops: the keyboard deck sits about a bezel below the visible screen edge.
  const floorH = minH - (deviceKind === 'laptop' ? 0.012 : 0);
  const ceil = maxH - floorH;
  const m = Math.max(screen.w, screen.h);
  const depth = m * 0.8;

  gravity.quaternion.copy(_q);
  gravity.position.copy(up).multiplyScalar(floorH); // point on the floor plane under the screen centre

  // Rebuild the room only when the geometry meaningfully changes.
  const key = [halfW, ceil, depth].map((v) => v.toFixed(3)).join('|');
  if (key !== layoutKey) {
    layoutKey = key;
    if (room) {
      gravity.remove(room.group);
      room.dispose();
    }
    room = createRoom({ halfW, ceil, zBack: -depth, zFront: m, clippingPlanes: screenClip });
    gravity.add(room.group);
  }

  // Cat: standing on the floor, scaled to fit, and fully behind the glass.
  const s = Math.min((0.62 * screen.h) / cat.height, (0.7 * screen.w) / cat.width, (0.8 * ceil) / cat.height);
  cat.root.scale.setScalar(s);
  const catH = cat.height * s;
  const margin = 0.01;
  // screen-space z of a gravity-space point (x, y, z) = gravity.z + y*up.z + z*lz.z
  const zFrontLimit = (-margin - gravity.position.z - catH * up.z) / Math.max(_lz.z, 0.2) - 0.9 * s;
  const zCat = THREE.MathUtils.clamp(Math.min(-depth * 0.45, zFrontLimit), -depth + 1.3 * s, 0);
  cat.root.position.set(0, -cat.minY * s, zCat);

  sun.position.set(m * 0.4, ceil + m * 0.9, zCat + m * 0.6);
  sun.target.position.set(0, 0, zCat);
  Object.assign(sun.shadow.camera, { left: -m, right: m, top: m, bottom: -m, near: 0.001, far: m * 4 });
  sun.shadow.camera.updateProjectionMatrix();
  gravity.updateMatrixWorld(true);
}

/**
 * Off-axis ("window") projection: the camera sits where your eyes are and the
 * frustum passes exactly through the edges of the physical screen.
 */
function updateCamera(eyePos) {
  const near = 0.01;
  const far = 20;
  const ez = Math.max(eyePos.z, 0.12);
  const k = near / ez;
  camera.position.set(eyePos.x, eyePos.y, ez);
  camera.quaternion.identity();
  camera.updateMatrixWorld(true);
  camera.projectionMatrix.makePerspective(
    (-screen.w / 2 - eyePos.x) * k,
    (screen.w / 2 - eyePos.x) * k,
    (screen.h / 2 - eyePos.y) * k,
    (-screen.h / 2 - eyePos.y) * k,
    near,
    far
  );
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

// ---------- input state ----------
let mode = 'idle'; // 'idle' | 'face' | 'pointer'
const defaultEye = new THREE.Vector3(0, 0, CONFIG.defaultEyeDistance);
const eye = defaultEye.clone(); // estimated viewer eye position (world)
const prevEye = eye.clone();
const pointerEye = defaultEye.clone();
let pointerActive = false;
let speed = 0;
let lastFaceSeen = -Infinity;
let faceRaw = null;

const tracker = new FaceTracker(ui.video, CONFIG);
const eyeFilter = new OneEuroVec3(CONFIG.filter);

window.addEventListener('pointermove', (e) => {
  const nx = (e.clientX / window.innerWidth) * 2 - 1;
  const ny = -((e.clientY / window.innerHeight) * 2 - 1);
  pointerEye.set(nx * screen.w * 0.8, ny * screen.h * 0.8, CONFIG.defaultEyeDistance);
  pointerActive = true;
});

// Webcam sits just above the top edge of the screen (laptops and phones in portrait).
const webcamOffset = () => ({ x: 0, y: screen.h / 2 + 0.008 });

// ---------- firing ----------
function fire() {
  cat.fire();
  pew();
  ui.flash.classList.remove('on');
  void ui.flash.offsetWidth; // restart animation
  ui.flash.classList.add('on');
  shotsFired++;
}
let shotsFired = 0;
ui.canvas.addEventListener('pointerdown', (e) => {
  if (mode === 'idle') return;
  e.preventDefault();
  fire();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && mode !== 'idle') {
    e.preventDefault();
    fire();
  }
});

// ---------- captions ----------
function setCaption(top, bottom = '') {
  if (ui.capTop.textContent !== top) ui.capTop.textContent = top;
  if (ui.capBottom.textContent !== bottom) ui.capBottom.textContent = bottom;
}

function updateCaptions(t, faceVisible) {
  if (mode === 'idle') return setCaption('LET ME SEE YOU');
  if (mode === 'face' && !faceVisible) return setCaption("WHERE'D YOU GO", 'I KNOW YOU\'RE THERE');
  if (eye.z < 0.25) return setCaption('BACK UP', 'PERSONAL SPACE PLEASE');
  if (speed > 0.35) return setCaption("I SAID DON'T MOVE");
  if (shotsFired > 0 && t % 8 < 2) return setCaption('THAT WAS A WARNING SHOT');
  setCaption("DON'T MOVE", mode === 'pointer' ? 'MOUSE MODE' : '');
}

// ---------- camera preview overlay ----------
const pipCtx = ui.pipOverlay.getContext('2d');
function drawPip() {
  if (ui.pip.classList.contains('collapsed')) return;
  const c = ui.pipOverlay;
  const w = (c.width = c.clientWidth * devicePixelRatio);
  const h = (c.height = c.clientHeight * devicePixelRatio);
  pipCtx.clearRect(0, 0, w, h);
  if (!faceRaw) return;
  // Canvas is CSS-mirrored like the video, so draw in raw image coordinates.
  const x = faceRaw.u * w;
  const y = faceRaw.v * h;
  pipCtx.strokeStyle = '#ff3355';
  pipCtx.lineWidth = 2 * devicePixelRatio;
  pipCtx.beginPath();
  pipCtx.arc(x, y, 14 * devicePixelRatio, 0, Math.PI * 2);
  pipCtx.moveTo(x - 24 * devicePixelRatio, y); pipCtx.lineTo(x + 24 * devicePixelRatio, y);
  pipCtx.moveTo(x, y - 24 * devicePixelRatio); pipCtx.lineTo(x, y + 24 * devicePixelRatio);
  pipCtx.stroke();
}

ui.pipBtn.addEventListener('click', () => {
  const collapsed = ui.pip.classList.toggle('collapsed');
  ui.pipBtn.textContent = collapsed ? 'Show camera' : 'Hide camera';
});

// ---------- level / tilt panel ----------
function renderLevelPanel() {
  const laptop = deviceKind === 'laptop';
  ui.tiltRow.hidden = !laptop;
  ui.motionBtn.hidden = !(level.needsPermission && !laptop);
  const auto = level.manualTilt == null;
  ui.tiltAuto.checked = auto;
  ui.tiltRange.disabled = auto;
  ui.levelNote.textContent = laptop
    ? {
        sensor: 'Using this laptop’s motion sensor.',
        face: 'Estimated from your head pose (assumes your head is upright). Untick Auto to set it by hand.',
        manual: 'Set by hand. The floor lines up with your keyboard at this lid angle.',
        default: 'Enable the camera to estimate it, or untick Auto to set it by hand.',
      }[level.source]
    : level.source === 'sensor'
      ? 'Using the gravity sensor: the floor stays level with the horizon.'
      : 'No motion data yet. Tap the button to allow the motion sensor.';
}

ui.levelBtn.addEventListener('click', () => {
  ui.levelPanel.hidden = !ui.levelPanel.hidden;
  renderLevelPanel();
});
ui.tiltAuto.addEventListener('change', () => {
  level.setManualTilt(ui.tiltAuto.checked ? null : +ui.tiltRange.value);
  renderLevelPanel();
});
ui.tiltRange.addEventListener('input', () => {
  level.setManualTilt(+ui.tiltRange.value);
  renderLevelPanel();
});
ui.motionBtn.addEventListener('click', async () => {
  await level.requestPermission();
  renderLevelPanel();
});
// Don't let clicks on the panel fire the gun.
ui.levelPanel.addEventListener('pointerdown', (e) => e.stopPropagation());

// ---------- start flow ----------
ui.startBtn.addEventListener('click', async () => {
  unlockAudio();
  if (deviceKind === 'mobile') level.requestPermission(); // must start inside the tap on iOS
  ui.levelBtn.hidden = false;
  ui.startBtn.disabled = ui.mouseBtn.disabled = true;
  try {
    ui.introStatus.textContent = 'Asking for camera access…';
    const cam = tracker.startCamera();
    ui.introStatus.textContent = 'Loading face tracking model (~4 MB)…';
    await Promise.all([cam, tracker.loadModel()]);
    mode = 'face';
    ui.intro.hidden = true;
    ui.pipBtn.hidden = false;
  } catch (err) {
    console.error(err);
    const denied = err?.name === 'NotAllowedError';
    ui.introStatus.textContent = denied
      ? 'Camera permission was denied. You can allow it in the browser address bar, or use the mouse.'
      : `Couldn't start face tracking: ${err?.message || err}`;
    ui.startBtn.disabled = ui.mouseBtn.disabled = false;
  }
});

ui.mouseBtn.addEventListener('click', () => {
  unlockAudio();
  if (deviceKind === 'mobile') level.requestPermission();
  ui.levelBtn.hidden = false;
  mode = 'pointer';
  ui.intro.hidden = true;
});

// ---------- main loop ----------
const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  const now = performance.now();

  if (mode === 'face' && tracker.update(now)) {
    faceRaw = tracker.face;
    if (faceRaw) {
      const off = webcamOffset();
      eyeFilter.filter(faceRaw.x + off.x, faceRaw.y + off.y, faceRaw.z, now, eye);
      lastFaceSeen = t;
      if (deviceKind === 'laptop') level.addFaceSample(tiltFromFaceMatrix(faceRaw.poseMatrix), dt);
    } else if (t - lastFaceSeen > 0.5) {
      eyeFilter.reset();
    }
  }

  const faceVisible = mode === 'face' && t - lastFaceSeen < 0.5;
  if (mode === 'pointer' || (mode === 'idle' && pointerActive)) {
    eye.lerp(pointerEye, 1 - Math.exp(-dt * 12));
  } else if (!faceVisible) {
    eye.lerp(defaultEye, 1 - Math.exp(-dt * 1.5));
  }

  const instSpeed = eye.distanceTo(prevEye) / Math.max(dt, 1e-3);
  speed += (instSpeed - speed) * (1 - Math.exp(-dt * 4));
  prevEye.copy(eye);

  const prevSource = level.source;
  layoutWorld(level.update(dt));
  updateCamera(CONFIG.headCoupledPerspective && mode !== 'pointer' ? eye : defaultEye);
  cat.update(dt, t, eye);
  updateCaptions(t, faceVisible);
  drawPip();

  const tilt = Math.round(level.tiltDeg);
  ui.levelBtn.textContent = deviceKind === 'laptop' ? `Lid tilt ${tilt}°` : level.source === 'sensor' ? 'Level: gravity' : 'Level';
  if (!ui.levelPanel.hidden) {
    ui.tiltOut.textContent = `${tilt}° (hinge ≈ ${90 + tilt}°)`;
    if (level.manualTilt == null) ui.tiltRange.value = tilt;
    if (prevSource !== level.source) renderLevelPanel();
  }

  ui.status.textContent =
    mode === 'face'
      ? faceVisible
        ? `tracking · ${(eye.z * 100).toFixed(0)} cm away`
        : 'looking for your face…'
      : mode === 'pointer'
        ? 'mouse mode'
        : '';

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for debugging in the console
window.__cat = { CONFIG, eye, screen, tracker, level, gravity, deviceKind };
