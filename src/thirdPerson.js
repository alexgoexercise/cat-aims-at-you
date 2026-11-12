// Third-person view: an orbiting camera that shows the cat, a big "TV" carrying
// your front-camera feed, the laser line from the gun to your eyes, and the
// outline of your real screen.
//
// The TV is not just decoration: it's placed where the webcam's view frustum
// crosses your measured distance, at exactly the size the camera sees at that
// depth. Your face on the TV therefore sits at the same 3D point the cat is
// aiming at.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function noSignalTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 384;
  const g = c.getContext('2d');
  const img = g.createImageData(c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 40 + Math.random() * 90;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(96, 150, 320, 84);
  g.fillStyle = '#fff';
  g.font = '48px Anton, Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('NO SIGNAL', 256, 192);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * @param {object} o
 * @param {THREE.Scene} o.scene
 * @param {HTMLCanvasElement} o.canvas     renderer canvas (for orbit controls)
 * @param {HTMLVideoElement} o.video       webcam video (for its size)
 * @param {HTMLCanvasElement} o.tvCanvas   what to show on the TV (the unmirrored mugshot render)
 */
export function createThirdPerson({ scene, canvas, video, tvCanvas }) {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.005, 20);
  const controls = new OrbitControls(camera, canvas);
  controls.enabled = false;
  controls.enableDamping = true;
  controls.minDistance = 0.15;
  controls.maxDistance = 3;

  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // --- TV ---
  // The TV canvas can change size once the camera starts, and WebGL textures
  // can't be resized in place, so recreate the texture when that happens.
  let feedTex = null;
  let feedKey = '';
  const feedTexture = () => {
    const key = `${tvCanvas.width}x${tvCanvas.height}`;
    if (key !== feedKey) {
      feedTex?.dispose();
      feedTex = new THREE.CanvasTexture(tvCanvas);
      feedTex.colorSpace = THREE.SRGBColorSpace;
      feedKey = key;
    }
    feedTex.needsUpdate = true;
    return feedTex;
  };
  const staticTex = noSignalTexture();
  const screenMat = new THREE.MeshBasicMaterial({ map: staticTex, toneMapped: false });
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), screenMat);
  tvScreen.rotation.y = Math.PI; // face the cat (-z); the cat sees the un-mirrored feed, like a real camera
  const bezelMat = new THREE.MeshStandardMaterial({ color: 0x15151a, roughness: 0.5, metalness: 0.3 });
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bezelMat);
  const tv = new THREE.Group();
  tv.add(tvScreen, bezel);
  group.add(tv);

  // Red dot where your eyes are (on the TV, nudged toward the cat)
  const dot = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff2244 }));
  group.add(dot);

  // --- laser from the muzzle to your eyes ---
  const laserGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const laser = new THREE.Line(laserGeo, new THREE.LineBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.85 }));
  laser.frustumCulled = false;
  group.add(laser);

  // --- outline of your physical screen (the "window" the cat lives behind) ---
  const glassGeo = new THREE.BufferGeometry();
  const glass = new THREE.LineLoop(glassGeo, new THREE.LineBasicMaterial({ color: 0x7ff2c8, transparent: true, opacity: 0.8 }));
  group.add(glass);
  const glassPane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0x7ff2c8, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false })
  );
  group.add(glassPane);

  const muzzle = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let glassKey = '';

  /**
   * @param {object} s
   * @param {THREE.Vector3} s.eye      viewer eye position (world, meters)
   * @param {{w:number,h:number}} s.screen  physical screen size
   * @param {{x:number,y:number}} s.webcam  webcam position relative to screen centre
   * @param {number} s.fovDeg          webcam diagonal FOV
   * @param {boolean} s.live           whether the camera feed is running
   * @param {THREE.Object3D} s.muzzleObj
   */
  function update({ eye, screen, webcam, fovDeg, live, muzzleObj }) {
    // Screen outline
    const key = `${screen.w.toFixed(4)}|${screen.h.toFixed(4)}`;
    if (key !== glassKey) {
      glassKey = key;
      const hw = screen.w / 2;
      const hh = screen.h / 2;
      glassGeo.setFromPoints([new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0), new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0)]);
      glassPane.scale.set(screen.w, screen.h, 1);
    }

    // TV: the slice of the webcam's view at your distance
    const d = Math.max(eye.z, 0.15);
    let tw, th, cx, cy;
    if (live && video.videoWidth) {
      const W = video.videoWidth;
      const H = video.videoHeight;
      const f = Math.hypot(W, H) / 2 / Math.tan((fovDeg * Math.PI) / 360);
      tw = (d * W) / f;
      th = (d * H) / f;
      cx = webcam.x;
      cy = webcam.y;
      const tex = feedTexture();
      if (screenMat.map !== tex) { screenMat.map = tex; screenMat.needsUpdate = true; }
    } else {
      tw = 0.48;
      th = 0.36;
      cx = 0;
      cy = 0;
      if (screenMat.map !== staticTex) { screenMat.map = staticTex; screenMat.needsUpdate = true; }
    }
    tv.position.set(cx, cy, d);
    tvScreen.scale.set(tw, th, 1);
    const border = Math.max(tw, th) * 0.04;
    bezel.scale.set(tw + border * 2, th + border * 2, border * 0.6);
    bezel.position.z = border * 0.3 + 0.0005; // just behind the picture, from the cat's side

    dot.position.set(eye.x, eye.y, d - 0.002);
    dot.scale.setScalar(Math.max(tw, th) * 0.008);

    muzzleObj.getWorldPosition(muzzle);
    const pos = laserGeo.attributes.position;
    pos.setXYZ(0, muzzle.x, muzzle.y, muzzle.z);
    tmp.set(eye.x, eye.y, d - 0.002);
    pos.setXYZ(1, tmp.x, tmp.y, tmp.z);
    pos.needsUpdate = true;
  }

  /** Put the camera behind and beside the cat, looking toward the TV. */
  function frame(catPos, eye) {
    const target = catPos.clone().lerp(new THREE.Vector3(eye.x, eye.y, Math.max(eye.z, 0.15)), 0.45);
    const span = Math.max(eye.z, 0.15) - catPos.z;
    camera.position.set(catPos.x + span * 0.55, catPos.y + span * 0.35, catPos.z - span * 0.7);
    controls.target.copy(target);
    controls.update();
  }

  function setActive(on) {
    group.visible = on;
    controls.enabled = on;
  }

  function resize(w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  return { camera, controls, update, frame, setActive, resize };
}
