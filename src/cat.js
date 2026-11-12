// A procedurally built cartoon cat holding a pistol with both paws.
// Built from primitives so there are no model files to load; swap in a GLB later if you like.
// Local units: the cat is ~3.4 units tall, feet at y ≈ -1.15. Its front faces +Z.
import * as THREE from 'three';

const gradient = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();
const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: gradient });

const MAT = {
  fur: toon(0xf2a65a),
  stripe: toon(0xc4672a),
  white: toon(0xfff4e6),
  pink: toon(0xff9aa2),
  black: new THREE.MeshBasicMaterial({ color: 0x111111 }),
  shine: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  gun: toon(0x34343e),
  gunDark: toon(0x1a1a20),
  gunAccent: toon(0xffcc33),
};

function mesh(geo, mat, { pos, scale, rot } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (scale) m.scale.set(...scale);
  if (rot) m.rotation.set(...rot);
  m.castShadow = true;
  return m;
}

const sphere = (r = 1) => new THREE.SphereGeometry(r, 32, 24);

function buildHead() {
  const head = new THREE.Group();
  head.add(mesh(sphere(0.8), MAT.fur, { scale: [1.15, 0.95, 1] }));

  // Ears
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.3, 0.6, 24), MAT.fur, { pos: [0.5 * s, 0.62, -0.05], rot: [0, 0, -0.4 * s] });
    ear.add(mesh(new THREE.ConeGeometry(0.17, 0.38, 24), MAT.pink, { pos: [0, -0.06, 0.14], scale: [1, 1, 0.5] }));
    head.add(ear);
  }

  // Forehead tabby stripes
  for (const x of [-0.14, 0, 0.14]) {
    head.add(mesh(new THREE.BoxGeometry(0.06, 0.22, 0.05), MAT.stripe, { pos: [x, 0.52, 0.57], rot: [-0.8, 0, x * -1.5] }));
  }

  // Eyes (each in a group so we can blink by squashing Y)
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(0.32 * s, 0.1, 0.62);
    eye.add(mesh(sphere(0.22), MAT.white, { scale: [1, 1, 0.6] }));
    eye.add(mesh(sphere(0.095), MAT.black, { pos: [0, 0, 0.12] }));
    eye.add(mesh(sphere(0.03), MAT.shine, { pos: [0.03, 0.04, 0.2] }));
    head.add(eye);
    eyes.push(eye);

    // Angry eyebrows (inner end lower)
    head.add(mesh(new THREE.BoxGeometry(0.34, 0.07, 0.08), MAT.stripe, { pos: [0.32 * s, 0.38, 0.72], rot: [0, 0, 0.35 * s] }));

    // Cheeks / muzzle puffs
    head.add(mesh(sphere(0.2), MAT.white, { pos: [0.14 * s, -0.24, 0.66], scale: [1, 0.8, 0.7] }));

    // Whiskers
    const pts = [];
    for (let k = -1; k <= 1; k++) {
      pts.push(new THREE.Vector3(0.28 * s, -0.22 + k * 0.03, 0.74), new THREE.Vector3(1.0 * s, -0.16 + k * 0.1, 0.55));
    }
    head.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x222222 })));
  }

  // Nose and grumpy mouth
  head.add(mesh(sphere(0.07), MAT.pink, { pos: [0, -0.1, 0.82], scale: [1.3, 0.9, 0.8] }));
  head.add(mesh(new THREE.TorusGeometry(0.08, 0.016, 8, 20, Math.PI), MAT.black, { pos: [0, -0.4, 0.74] }));

  return { head, eyes };
}

function buildGun() {
  // Barrel points along +Z. Origin is roughly the middle of the gun.
  const gun = new THREE.Group();
  gun.add(mesh(new THREE.BoxGeometry(0.16, 0.17, 0.8), MAT.gun, { pos: [0, 0.08, 0.12] })); // slide
  gun.add(mesh(new THREE.BoxGeometry(0.15, 0.09, 0.6), MAT.gunDark, { pos: [0, -0.04, 0.08] })); // frame
  gun.add(mesh(new THREE.BoxGeometry(0.14, 0.4, 0.18), MAT.gunDark, { pos: [0, -0.24, -0.18], rot: [0.3, 0, 0] })); // grip
  gun.add(mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 20), MAT.gunDark, { pos: [0, -0.13, -0.01], rot: [0, Math.PI / 2, 0] })); // trigger guard
  gun.add(mesh(new THREE.BoxGeometry(0.03, 0.06, 0.03), MAT.gunAccent, { pos: [0, -0.12, 0.0] })); // trigger
  gun.add(mesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), MAT.gunAccent, { pos: [0, 0.185, 0.48] })); // front sight
  gun.add(mesh(new THREE.BoxGeometry(0.1, 0.05, 0.04), MAT.gunDark, { pos: [0, 0.185, -0.24] })); // rear sight
  const barrel = new THREE.CylinderGeometry(0.055, 0.055, 0.08, 20).rotateX(Math.PI / 2);
  gun.add(mesh(barrel, MAT.gunDark, { pos: [0, 0.08, 0.55] }));
  const hole = new THREE.CircleGeometry(0.035, 20);
  gun.add(mesh(hole, MAT.black, { pos: [0, 0.08, 0.592] }));

  // Muzzle flash
  const muzzle = new THREE.Group();
  muzzle.position.set(0, 0.08, 0.6);
  const flash = new THREE.Group();
  flash.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xffb020 })));
  flash.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.11), new THREE.MeshBasicMaterial({ color: 0xffffee })));
  flash.scale.set(1, 1, 2);
  flash.position.z = 0.25;
  flash.visible = false;
  muzzle.add(flash);
  const light = new THREE.PointLight(0xffaa44, 0, 0, 2);
  muzzle.add(light);
  gun.add(muzzle);

  // Where the paws grab the grip (gun-local)
  const grips = [new THREE.Vector3(-0.12, -0.2, -0.16), new THREE.Vector3(0.12, -0.2, -0.16)];
  return { gun, muzzle, flash, light, grips };
}

export function createCat() {
  const root = new THREE.Group();
  const torso = new THREE.Group(); // yaws a little toward the target
  root.add(torso);

  // Body
  torso.add(mesh(sphere(1), MAT.fur, { scale: [0.85, 1, 0.75] }));
  torso.add(mesh(sphere(1), MAT.white, { pos: [0, -0.15, 0.4], scale: [0.55, 0.7, 0.4] }));
  for (const s of [-1, 1]) {
    root.add(mesh(sphere(1), MAT.white, { pos: [0.42 * s, -0.98, 0.3], scale: [0.28, 0.17, 0.38] }));
  }

  // Tail
  const tail = new THREE.Group();
  tail.position.set(0, -0.7, -0.55);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.3, -0.2, -0.4),
    new THREE.Vector3(0.7, 0.2, -0.6),
    new THREE.Vector3(0.8, 1.0, -0.5),
    new THREE.Vector3(0.6, 1.5, -0.3),
  ]);
  tail.add(mesh(new THREE.TubeGeometry(curve, 48, 0.11, 12), MAT.fur));
  tail.add(mesh(sphere(0.11), MAT.stripe, { pos: [0.6, 1.5, -0.3] }));
  root.add(tail);

  // Head on a neck pivot
  const neck = new THREE.Group();
  neck.position.set(0, 1.0, 0);
  const { head, eyes } = buildHead();
  head.position.y = 0.3;
  neck.add(head);
  torso.add(neck);

  // Gun, held out in front of the chest
  const gunPivot = new THREE.Group();
  gunPivot.position.set(0, 0.42, 0.35);
  const { gun, muzzle, flash, light, grips } = buildGun();
  const GUN_REST_Z = 0.95;
  gun.position.z = GUN_REST_Z;
  gunPivot.add(gun);
  torso.add(gunPivot);

  // Arms: shoulder pivots that stretch to reach the grip
  const armGeo = new THREE.CylinderGeometry(0.13, 0.15, 1, 16).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const arms = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.62 * s, 0.45, 0.25);
    const arm = mesh(armGeo, MAT.fur);
    const paw = mesh(sphere(0.17), MAT.white);
    pivot.add(arm, paw);
    torso.add(pivot);
    return { pivot, arm, paw };
  });

  // --- animation state ---
  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();
  const tmpLocal = new THREE.Vector3();
  let recoil = 0;
  let nextBlink = 2 + Math.random() * 3;
  let blinkT = 0;

  function smoothLookAt(obj, target, alpha) {
    tmpQ.copy(obj.quaternion);
    obj.lookAt(target);
    obj.quaternion.copy(tmpQ.slerp(obj.quaternion, alpha));
  }

  function update(dt, t, target) {
    root.updateMatrixWorld(true);

    // Torso turns a bit toward the target, head and gun do the rest.
    tmpLocal.copy(target);
    root.worldToLocal(tmpLocal);
    const yaw = Math.atan2(tmpLocal.x, Math.max(0.1, tmpLocal.z)) * 0.35;
    torso.rotation.y += (yaw - torso.rotation.y) * (1 - Math.exp(-dt * 6));
    torso.scale.y = 1 + Math.sin(t * 2.2) * 0.012; // breathing
    torso.updateMatrixWorld(true);

    smoothLookAt(neck, target, 1 - Math.exp(-dt * 10));
    smoothLookAt(gunPivot, target, 1 - Math.exp(-dt * 16));

    // Recoil
    recoil = Math.max(0, recoil - dt * 6);
    const r = recoil * recoil;
    gun.position.z = GUN_REST_Z - 0.2 * r;
    gun.rotation.x = -0.55 * r;
    flash.visible = recoil > 0.7;
    flash.rotation.z = Math.random() * Math.PI;
    light.intensity = recoil > 0.6 ? 0.6 : 0;
    gunPivot.updateMatrixWorld(true);

    // Arms reach for the grip
    arms.forEach(({ pivot, arm, paw }, i) => {
      gun.localToWorld(tmpV.copy(grips[i]));
      pivot.lookAt(tmpV);
      pivot.updateMatrixWorld(true);
      pivot.worldToLocal(tmpV);
      const len = tmpV.length();
      arm.scale.set(1, 1, len);
      paw.position.set(0, 0, len);
    });

    // Tail sway and blinking
    tail.rotation.z = Math.sin(t * 1.6) * 0.15;
    tail.rotation.y = Math.sin(t * 1.1) * 0.2;
    nextBlink -= dt;
    if (nextBlink <= 0) { blinkT = 0.14; nextBlink = 2 + Math.random() * 4; }
    blinkT = Math.max(0, blinkT - dt);
    const lid = blinkT > 0 ? 0.1 : 1;
    eyes.forEach((e) => (e.scale.y = lid));
  }

  function fire() {
    recoil = 1;
  }

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return { root, update, fire, height: 3.4, width: 2.4, minY: -1.15, muzzle };
}
