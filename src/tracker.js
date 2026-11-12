// Face tracking with MediaPipe Face Landmarker, plus a metric 3D estimate of
// where your eyes are relative to the webcam (pinhole camera model).
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Iris centres in the 478-point face mesh.
const LEFT_IRIS = 468;
const RIGHT_IRIS = 473;

export class FaceTracker {
  constructor(video, config) {
    this.video = video;
    this.config = config;
    this.landmarker = null;
    this.lastVideoTime = -1;
    /** Latest result: { x, y, z } meters in webcam space (+x your right, +y up, +z toward you), u/v normalised image coords. Null if no face. */
    this.face = null;
  }

  async startCamera() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera needs HTTPS (or http://localhost).');
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();
  }

  async loadModel() {
    const { wasmUrl, modelUrl } = this.config.mediapipe;
    const fileset = await FilesetResolver.forVisionTasks(wasmUrl);
    const make = (delegate) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelUrl, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFacialTransformationMatrixes: true, // head pose, used to estimate the laptop lid angle
        outputFaceBlendshapes: true, // expression values, shown in the tracking-data view
      });
    try {
      this.landmarker = await make('GPU');
    } catch (err) {
      console.warn('GPU delegate failed, falling back to CPU', err);
      this.landmarker = await make('CPU');
    }
  }

  /** Run detection if a new video frame is available. Returns true when `face` was updated. */
  update(nowMs) {
    const v = this.video;
    if (!this.landmarker || v.readyState < 2 || v.currentTime === this.lastVideoTime) return false;
    this.lastVideoTime = v.currentTime;

    const res = this.landmarker.detectForVideo(v, nowMs);
    const lm = res.faceLandmarks?.[0];
    if (!lm || lm.length <= RIGHT_IRIS) {
      this.face = null;
      return true;
    }
    this.face = this.#estimate(lm, v.videoWidth, v.videoHeight);
    this.face.poseMatrix = res.facialTransformationMatrixes?.[0]?.data ?? null;
    this.face.landmarks = lm;
    this.face.blendshapes = res.faceBlendshapes?.[0]?.categories ?? [];
    return true;
  }

  #estimate(lm, W, H) {
    const { cameraDiagonalFovDeg, ipdMeters } = this.config;
    // Focal length in pixels from the diagonal FOV (works for portrait and landscape).
    const diag = Math.hypot(W, H);
    const f = diag / 2 / Math.tan((cameraDiagonalFovDeg * Math.PI) / 360);

    const L = lm[LEFT_IRIS];
    const R = lm[RIGHT_IRIS];
    // Landmark z is roughly in the same scale as x (image width), so including it
    // compensates for head turn shrinking the apparent eye distance.
    const ipdPx = Math.hypot((L.x - R.x) * W, (L.y - R.y) * H, (L.z - R.z) * W);
    const z = (f * ipdMeters) / Math.max(ipdPx, 1);

    const cx = ((L.x + R.x) / 2) * W;
    const cy = ((L.y + R.y) / 2) * H;
    // The raw (unmirrored) image shows you moving left when you move to your right.
    const x = (-(cx - W / 2) * z) / f;
    const y = (-(cy - H / 2) * z) / f;

    return { x, y, z, u: cx / W, v: cy / H, ipdPx, focalPx: f };
  }
}
