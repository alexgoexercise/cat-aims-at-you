// Works out which way is "up" in the real world, expressed in screen coordinates
// (+x right along the screen, +y up along the screen, +z out of the screen).
//
// - Phones / tablets: the gravity sensor (DeviceOrientation), including landscape.
// - Laptops: browsers can't read the hinge angle, so we estimate how far the lid
//   is tilted back from the head pose seen by the webcam (assuming your head is
//   roughly upright), heavily smoothed. Laptops that do have a motion sensor in
//   the lid (some 2-in-1s) use the sensor instead. A manual override is available.
import * as THREE from 'three';

const DEG = Math.PI / 180;

export function detectDeviceKind() {
  const ua = navigator.userAgent;
  if (navigator.userAgentData?.mobile) return 'mobile';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return 'mobile';
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'mobile'; // iPadOS
  return 'laptop';
}

/** Up vector for a laptop lid tilted back by `tilt` radians from vertical. */
const upFromTilt = (tilt, out = new THREE.Vector3()) => out.set(0, Math.cos(tilt), Math.sin(tilt));

export class LevelSensor {
  constructor({ kind, defaultTiltDeg = 15, manualTiltDeg = null }) {
    this.kind = kind;
    this.defaultTilt = defaultTiltDeg * DEG;
    this.manualTilt = manualTiltDeg == null ? null : manualTiltDeg * DEG;
    this.faceTilt = null; // smoothed estimate from head pose (radians)
    this.sensorUp = null;
    this.sensorTime = -Infinity;
    this.source = 'default'; // 'sensor' | 'face' | 'manual' | 'default'
    this.up = kind === 'laptop' ? upFromTilt(this.defaultTilt) : new THREE.Vector3(0, 1, 0);
    this._target = new THREE.Vector3();
    this.needsPermission = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
    window.addEventListener('deviceorientation', (e) => this.#onOrientation(e));
  }

  /** iOS needs an explicit permission request from a user gesture. */
  async requestPermission() {
    if (!this.needsPermission) return 'granted';
    try {
      const state = await DeviceOrientationEvent.requestPermission();
      if (state === 'granted') this.needsPermission = false;
      return state;
    } catch (err) {
      console.warn('Motion permission request failed', err);
      return 'denied';
    }
  }

  #onOrientation(e) {
    if (e.beta == null || e.gamma == null) return; // desktop browsers fire with nulls
    const b = e.beta * DEG;
    const g = e.gamma * DEG;
    // World "up" expressed in the device frame (W3C Z-X'-Y'' Euler angles).
    let x = -Math.cos(b) * Math.sin(g);
    let y = Math.sin(b);
    const z = Math.cos(b) * Math.cos(g);
    // Device frame -> screen frame for landscape orientations.
    const a = (screen.orientation?.angle ?? window.orientation ?? 0) * DEG;
    [x, y] = [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    this.sensorUp = new THREE.Vector3(x, y, z).normalize();
    this.sensorTime = performance.now();
  }

  /** Feed the lid tilt estimated from one face-tracking frame (radians). */
  addFaceSample(tilt, dt) {
    if (!Number.isFinite(tilt)) return;
    const clamped = THREE.MathUtils.clamp(tilt, -10 * DEG, 55 * DEG);
    // Very slow smoothing: the lid rarely moves, heads move all the time.
    this.faceTilt = this.faceTilt == null ? clamped : this.faceTilt + (clamped - this.faceTilt) * (1 - Math.exp(-dt / 2.5));
  }

  setManualTilt(deg) {
    this.manualTilt = deg == null ? null : deg * DEG;
  }

  get hasSensor() {
    return performance.now() - this.sensorTime < 1000;
  }

  /** Lid tilt back from vertical in degrees (laptop terms). */
  get tiltDeg() {
    return Math.atan2(this.up.z, this.up.y) / DEG;
  }

  /** Advance smoothing; returns the current up vector (screen coordinates). */
  update(dt) {
    const t = this._target;
    if (this.manualTilt != null) {
      upFromTilt(this.manualTilt, t);
      this.source = 'manual';
    } else if (this.hasSensor) {
      t.copy(this.sensorUp);
      this.source = 'sensor';
    } else if (this.kind === 'laptop' && this.faceTilt != null) {
      upFromTilt(this.faceTilt, t);
      this.source = 'face';
    } else {
      if (this.kind === 'laptop') upFromTilt(this.defaultTilt, t);
      else t.set(0, 1, 0);
      this.source = 'default';
    }
    // Keep the floor usable: never let "up" point more than 60° out of the screen
    // (e.g. a phone lying flat), or behind it by more than 30°.
    const maxOut = Math.sin(60 * DEG);
    const minOut = -Math.sin(30 * DEG);
    if (t.z > maxOut || t.z < minOut) {
      const z = THREE.MathUtils.clamp(t.z, minOut, maxOut);
      const k = Math.sqrt((1 - z * z) / Math.max(t.x * t.x + t.y * t.y, 1e-6));
      t.set(t.x * k, t.y * k, z);
      if (t.lengthSq() < 0.5) t.set(0, Math.sqrt(1 - z * z), z);
    }
    const speed = this.source === 'sensor' ? 8 : 3;
    this.up.lerp(t, 1 - Math.exp(-dt * speed)).normalize();
    return this.up;
  }
}

/**
 * Lid tilt from MediaPipe's facial transformation matrix (face pose in camera
 * space, camera looking down -Z, +Y up). If the head is upright, the face's up
 * axis leans away from the camera by the same angle the lid leans back.
 */
export function tiltFromFaceMatrix(data) {
  if (!data || data.length < 16) return NaN;
  // Translation z should be clearly negative (face in front of the camera);
  // use it to tell column-major from row-major layout.
  const colMajor = Math.abs(data[14]) >= Math.abs(data[11]);
  const up = colMajor ? [data[4], data[5], data[6]] : [data[1], data[5], data[9]];
  return Math.atan2(-up[2], up[1]);
}
