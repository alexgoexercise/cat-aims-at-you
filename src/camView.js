// Draws the front-camera preview in one of three styles:
//   live     - mirrored video with a crosshair between your eyes
//   mugshot  - black & white booking photo: height chart, burglar mask, placard
//   data     - the raw tracking output: face mesh, iris points, pose, blendshapes
// Everything is drawn into one canvas, mirrored like a selfie camera, so text
// stays readable.
import { FaceLandmarker } from '@mediapipe/tasks-vision';

// Ordered outline of the face (MediaPipe face mesh indices).
const FACE_OUTLINE = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const IRIS_A = { center: 468, ring: [469, 470, 471, 472] };
const IRIS_B = { center: 473, ring: [474, 475, 476, 477] };
const CHIN = 152;
const FACE_LEFT = 234;
const FACE_RIGHT = 454;
const FOREHEAD = 10;

const DEG = 180 / Math.PI;

export class CameraView {
  /**
   * @param {object} o
   * @param {HTMLVideoElement} o.video
   * @param {HTMLCanvasElement} o.canvas   where to draw
   * @param {HTMLElement} [o.container]   preview box to show/hide and resize (optional)
   * @param {boolean} [o.mirror]          selfie-mirror the picture (true for the on-screen preview)
   */
  constructor({ video, canvas, container = null, mirror = true }) {
    this.video = video;
    this.canvas = canvas;
    this.container = container;
    this.mirror = mirror;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.mode = 'off';
    this.detections = [];
    this.chart = document.createElement('canvas');
    this.booking = String(Math.floor(100000 + Math.random() * 900000));
  }

  setMode(mode) {
    this.mode = mode;
    this.container?.classList.toggle('collapsed', mode === 'off');
    this.container?.classList.toggle('large', mode === 'mugshot' || mode === 'data');
  }

  /** Call whenever the tracker produced a new result, to measure tracking FPS. */
  noteDetection(now) {
    this.detections.push(now);
    while (this.detections.length && now - this.detections[0] > 1000) this.detections.shift();
  }

  draw(face, info = {}) {
    if (this.mode === 'off') return;
    const v = this.video;
    if (!v.videoWidth) return;
    const scale = Math.min(1, 640 / v.videoWidth);
    const W = Math.round(v.videoWidth * scale);
    const H = Math.round(v.videoHeight * scale);
    if (this.canvas.width !== W || this.canvas.height !== H) {
      this.canvas.width = W;
      this.canvas.height = H;
      if (this.container) this.container.style.aspectRatio = `${W} / ${H}`;
    }
    const ctx = this.ctx;
    ctx.save();
    if (this.mirror) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, W, H);
    ctx.restore();

    // Landmark -> canvas pixels (text is always drawn unflipped, so it stays readable)
    const m = this.mirror;
    const P = face?.landmarks ? (i) => ({ x: (m ? 1 - face.landmarks[i].x : face.landmarks[i].x) * W, y: face.landmarks[i].y * H }) : null;
    const u = W / 360; // one "CSS-ish" pixel at the default preview size

    if (this.mode === 'live') this.#drawLive(P, u);
    else if (this.mode === 'mugshot') this.#drawMugshot(P, W, H, u);
    else if (this.mode === 'data') this.#drawData(face, P, W, H, u, info);
  }

  // ---------- live ----------
  #drawLive(P, u) {
    if (!P) return;
    const a = P(IRIS_A.center);
    const b = P(IRIS_B.center);
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    const ctx = this.ctx;
    ctx.strokeStyle = '#ff3355';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.arc(x, y, 14 * u, 0, Math.PI * 2);
    ctx.moveTo(x - 24 * u, y); ctx.lineTo(x + 24 * u, y);
    ctx.moveTo(x, y - 24 * u); ctx.lineTo(x, y + 24 * u);
    ctx.stroke();
  }

  // ---------- mugshot ----------
  #drawMugshot(P, W, H, u) {
    const ctx = this.ctx;

    // Gritty black & white: grayscale, contrast and film grain in one pass.
    const img = ctx.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      let g = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
      g = (g - 128) * 1.35 + 136 + (Math.random() - 0.5) * 26;
      d[i] = d[i + 1] = d[i + 2] = g;
    }
    ctx.putImageData(img, 0, 0);

    const face = P ? this.#faceGeometry(P) : null;
    this.#drawHeightChart(face, W, H, u);
    if (face) {
      this.#drawMask(P, face, u);
      this.#drawPlacard(face, W, H, u);
    }
    this.#drawStamp(W, u);

    // Vignette
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  #faceGeometry(P) {
    const chin = P(CHIN);
    const top = P(FOREHEAD);
    const l = P(FACE_LEFT);
    const r = P(FACE_RIGHT);
    const fw = Math.hypot(r.x - l.x, r.y - l.y);
    const fh = Math.hypot(chin.x - top.x, chin.y - top.y);
    const cx = (l.x + r.x) / 2;
    const cy = (top.y + chin.y) / 2;
    return { chin, top, fw, fh, cx, cy };
  }

  #drawHeightChart(face, W, H, u) {
    // Draw the chart on its own layer, then erase a rough silhouette of the
    // person so the lines look like they're on the wall behind you.
    const c = this.chart;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    const rows = 12;
    const labels = ['7\'0"', '6\'9"', '6\'6"', '6\'3"', '6\'0"', '5\'9"', '5\'6"', '5\'3"', '5\'0"', '4\'9"', '4\'6"', '4\'3"'];
    g.font = `${10 * u}px "Courier New", monospace`;
    g.textBaseline = 'middle';
    for (let i = 0; i < rows; i++) {
      const y = ((i + 0.5) / rows) * H;
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = (i % 2 ? 1 : 2) * u;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.3)';
      g.lineWidth = u;
      const yh = y + H / rows / 2;
      g.beginPath(); g.moveTo(0, yh); g.lineTo(18 * u, yh); g.moveTo(W - 18 * u, yh); g.lineTo(W, yh); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.textAlign = 'left';
      g.fillText(labels[i], 4 * u, y - 7 * u);
      g.textAlign = 'right';
      g.fillText(labels[i], W - 4 * u, y - 7 * u);
    }
    if (face) {
      const { cx, cy, fw, fh, chin } = face;
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = '#000';
      // head (with some room for hair) and shoulders
      g.beginPath();
      g.ellipse(cx, cy - fh * 0.08, fw * 0.62, fh * 0.68, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(cx - fw * 0.32, chin.y - fh * 0.15);
      g.lineTo(cx + fw * 0.32, chin.y - fh * 0.15);
      g.lineTo(cx + fw * 0.38, chin.y + fh * 0.3);
      g.quadraticCurveTo(cx + fw * 1.4, chin.y + fh * 0.35, cx + fw * 1.55, chin.y + fh * 0.9);
      g.lineTo(cx + fw * 1.7, H);
      g.lineTo(cx - fw * 1.7, H);
      g.lineTo(cx - fw * 1.55, chin.y + fh * 0.9);
      g.quadraticCurveTo(cx - fw * 1.4, chin.y + fh * 0.35, cx - fw * 0.38, chin.y + fh * 0.3);
      g.closePath();
      g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    this.ctx.drawImage(c, 0, 0);
  }

  #drawMask(P, face, u) {
    // A black domino mask across the eyes, following head position and roll.
    let a = P(IRIS_A.center);
    let b = P(IRIS_B.center);
    if (a.x > b.x) [a, b] = [b, a];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const ctx = this.ctx;
    ctx.save();
    ctx.translate((a.x + b.x) / 2, (a.y + b.y) / 2);
    ctx.rotate(ang);
    const w = d * 1.1;
    const h = d * 0.34;
    // ties running back toward the ears
    ctx.strokeStyle = '#0d0d0d';
    ctx.lineWidth = d * 0.06;
    ctx.beginPath();
    ctx.moveTo(-w, -h * 0.1); ctx.lineTo(-face.fw * 0.52, -h * 0.25);
    ctx.moveTo(w, -h * 0.1); ctx.lineTo(face.fw * 0.52, -h * 0.25);
    ctx.stroke();
    // mask with eye holes
    ctx.beginPath();
    ctx.moveTo(-w, -h * 0.55);
    ctx.bezierCurveTo(-w * 0.5, -h * 1.25, -w * 0.15, -h * 0.9, 0, -h * 0.55);
    ctx.bezierCurveTo(w * 0.15, -h * 0.9, w * 0.5, -h * 1.25, w, -h * 0.55);
    ctx.bezierCurveTo(w * 1.12, h * 0.4, w * 0.6, h * 1.2, w * 0.25, h * 0.75);
    ctx.quadraticCurveTo(0, h * 0.35, -w * 0.25, h * 0.75);
    ctx.bezierCurveTo(-w * 0.6, h * 1.2, -w * 1.12, h * 0.4, -w, -h * 0.55);
    ctx.closePath();
    ctx.ellipse(-d / 2, 0, d * 0.21, d * 0.13, 0, 0, Math.PI * 2);
    ctx.ellipse(d / 2, 0, d * 0.21, d * 0.13, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.2 * u;
    ctx.stroke();
    ctx.restore();
  }

  #drawPlacard(face, W, H, u) {
    const ctx = this.ctx;
    const pw = Math.min(W * 0.7, face.fw * 2.1);
    const ph = pw * 0.38;
    const x = Math.min(Math.max(face.cx - pw / 2, 6 * u), W - pw - 6 * u);
    const y = Math.min(face.chin.y + face.fh * 0.4, H - ph - 6 * u);
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(x, y, pw, ph);
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = Math.max(1, pw * 0.008);
    ctx.strokeRect(x + pw * 0.025, y + ph * 0.06, pw * 0.95, ph * 0.88);
    ctx.fillStyle = '#f2f2f2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    ctx.font = `${ph * 0.2}px Anton, Impact, sans-serif`;
    ctx.fillText('CAT COUNTY POLICE DEPT', x + pw / 2, y + ph * 0.26);
    ctx.font = `bold ${ph * 0.14}px "Courier New", monospace`;
    ctx.fillText(`BOOKING #${this.booking}   ${date}`, x + pw / 2, y + ph * 0.52);
    ctx.fillText('CHARGE: STARING AT THE CAT', x + pw / 2, y + ph * 0.74);
  }

  #drawStamp(W, u) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(W - 62 * u, 30 * u);
    ctx.rotate(0.18);
    ctx.strokeStyle = 'rgba(230,40,50,0.9)';
    ctx.fillStyle = 'rgba(230,40,50,0.9)';
    ctx.lineWidth = 2.2 * u;
    ctx.strokeRect(-46 * u, -14 * u, 92 * u, 28 * u);
    ctx.font = `${17 * u}px Anton, Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BOOKED', 0, 1 * u);
    ctx.restore();
  }

  // ---------- tracking data ----------
  #drawData(face, P, W, H, u, info) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(4,8,20,0.6)';
    ctx.fillRect(0, 0, W, H);
    const fps = this.detections.length;

    if (P) {
      const lm = face.landmarks;
      const lines = (conns, style, width) => {
        ctx.strokeStyle = style;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (const { start, end } of conns) {
          const a = P(start);
          const b = P(end);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      };
      lines(FaceLandmarker.FACE_LANDMARKS_TESSELATION, 'rgba(80,220,255,0.22)', 0.6 * u);
      const feature = 'rgba(120,255,200,0.9)';
      lines(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, feature, 1.2 * u);
      lines(FaceLandmarker.FACE_LANDMARKS_LIPS, feature, 1.2 * u);
      lines(FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, feature, 1.2 * u);
      lines(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, feature, 1.2 * u);
      lines(FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, feature, 1.2 * u);
      lines(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, feature, 1.2 * u);

      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < lm.length; i++) {
        const p = P(i);
        ctx.fillRect(p.x - 0.6 * u, p.y - 0.6 * u, 1.2 * u, 1.2 * u);
      }

      // Irises: ring points, fitted circle, centre, raw coordinates
      ctx.font = `${8.5 * u}px ui-monospace, Menlo, monospace`;
      ctx.textBaseline = 'middle';
      const centers = [];
      for (const iris of [IRIS_A, IRIS_B]) {
        const c = P(iris.center);
        centers.push(c);
        const r = iris.ring.reduce((s, i) => s + Math.hypot(P(i).x - c.x, P(i).y - c.y), 0) / 4;
        ctx.strokeStyle = '#ff4fd8';
        ctx.lineWidth = 1.4 * u;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.moveTo(c.x - r * 1.8, c.y); ctx.lineTo(c.x + r * 1.8, c.y);
        ctx.moveTo(c.x, c.y - r * 1.8); ctx.lineTo(c.x, c.y + r * 1.8);
        ctx.stroke();
        ctx.fillStyle = '#ffd36e';
        for (const i of iris.ring) {
          const p = P(i);
          ctx.beginPath(); ctx.arc(p.x, p.y, 1.6 * u, 0, Math.PI * 2); ctx.fill();
        }
        const raw = lm[iris.center];
        const right = c.x > W / 2;
        ctx.textAlign = right ? 'left' : 'right';
        ctx.fillStyle = '#ffd36e';
        ctx.fillText(`#${iris.center}`, c.x + (right ? 1 : -1) * r * 2.1, c.y - 6 * u);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(`${raw.x.toFixed(3)}, ${raw.y.toFixed(3)}, ${raw.z.toFixed(3)}`, c.x + (right ? 1 : -1) * r * 2.1, c.y + 6 * u);
      }
      // Eye-distance baseline used for depth
      const [a, b] = centers;
      ctx.strokeStyle = 'rgba(255,211,110,0.8)';
      ctx.setLineDash([4 * u, 3 * u]);
      ctx.lineWidth = u;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd36e';
      ctx.fillText(`IPD ${face.ipdPx.toFixed(1)} px`, (a.x + b.x) / 2, (a.y + b.y) / 2 - 22 * u);
    }

    // Readout panel
    const rows = [['LANDMARKS', P ? `${face.landmarks.length}` : '-', 'FPS', `${fps}`]];
    if (face) {
      const pose = headAngles(face.poseMatrix);
      rows.push(['EYES cm', `x ${sgn(face.x * 100)}  y ${sgn(face.y * 100)}  z ${(face.z * 100).toFixed(1)}`]);
      rows.push(['IPD', `${face.ipdPx.toFixed(1)} px  @ f ${face.focalPx.toFixed(0)} px`]);
      if (pose) rows.push(['HEAD', `yaw ${sgn(pose.yaw, 0)}°  pitch ${sgn(pose.pitch, 0)}°  roll ${sgn(pose.roll, 0)}°`]);
    }
    if (info.lidTiltDeg != null) rows.push(['LID TILT', `${info.lidTiltDeg.toFixed(0)}°  (${info.lidSource})`]);
    if (!face) rows.push(['STATUS', 'no face detected']);

    ctx.font = `${9 * u}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const lh = 12 * u;
    const pad = 6 * u;
    const pw = 210 * u;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(pad, pad, pw, rows.length * lh + pad);
    rows.forEach((r, i) => {
      const y = pad * 1.5 + i * lh;
      ctx.fillStyle = '#7ff2c8';
      ctx.fillText(r[0], pad * 2, y);
      ctx.fillStyle = '#fff';
      ctx.fillText(r[1], pad * 2 + 62 * u, y);
      if (r[2]) {
        ctx.fillStyle = '#7ff2c8';
        ctx.fillText(r[2], pad * 2 + 120 * u, y);
        ctx.fillStyle = '#fff';
        ctx.fillText(r[3], pad * 2 + 145 * u, y);
      }
    });

    // Strongest expression values (blendshapes)
    if (face?.blendshapes?.length) {
      const top = face.blendshapes
        .filter((c) => c.categoryName !== '_neutral')
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      const bw = 120 * u;
      const by = H - pad - top.length * lh;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(pad, by - pad / 2, bw + 92 * u, top.length * lh + pad);
      top.forEach((c, i) => {
        const y = by + i * lh;
        ctx.fillStyle = '#fff';
        ctx.fillText(c.categoryName, pad * 2, y + 1 * u);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(pad * 2 + 88 * u, y + 2 * u, bw - 8 * u, 7 * u);
        ctx.fillStyle = '#ff4fd8';
        ctx.fillRect(pad * 2 + 88 * u, y + 2 * u, (bw - 8 * u) * c.score, 7 * u);
      });
    }
  }
}

const sgn = (v, digits = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(digits)}`;

/** Yaw / pitch / roll in degrees from MediaPipe's facial transformation matrix. */
function headAngles(m) {
  if (!m || m.length < 16) return null;
  const colMajor = Math.abs(m[14]) >= Math.abs(m[11]);
  const col = (j) => (colMajor ? [m[j * 4], m[j * 4 + 1], m[j * 4 + 2]] : [m[j], m[4 + j], m[8 + j]]);
  const up = col(1);
  const fwd = col(2);
  return {
    yaw: Math.atan2(fwd[0], fwd[2]) * DEG,
    pitch: Math.atan2(-up[2], up[1]) * DEG,
    roll: Math.atan2(-up[0], up[1]) * DEG,
  };
}
