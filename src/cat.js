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
  mouth: new THREE.MeshBasicMaterial({ color: 0x3a0f16 }),
  lips: toon(0xe0566e),
  hitbox: new THREE.MeshBasicMaterial({ visible: false }), // invisible, but still clickable
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
  head.userData.part = 'head'; // clickable parts are tagged; the nearest tagged ancestor wins
  head.add(mesh(sphere(0.8), MAT.fur, { scale: [1.15, 0.95, 1] }));

  // Ears (index 0 = left of the screen)
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.3, 0.6, 24), MAT.fur, { pos: [0.5 * s, 0.62, -0.05], rot: [0, 0, -0.4 * s] });
    ear.add(mesh(new THREE.ConeGeometry(0.17, 0.38, 24), MAT.pink, { pos: [0, -0.06, 0.14], scale: [1, 1, 0.5] }));
    ear.userData.part = s < 0 ? 'earL' : 'earR';
    ear.userData.baseRotZ = ear.rotation.z;
    head.add(ear);
    ears.push(ear);
  }

  // Forehead tabby stripes
  for (const x of [-0.14, 0, 0.14]) {
    head.add(mesh(new THREE.BoxGeometry(0.06, 0.22, 0.05), MAT.stripe, { pos: [x, 0.52, 0.57], rot: [-0.8, 0, x * -1.5] }));
  }

  // Face rig. Index 0 of each pair is the cat's right side, which is on the
  // left of the screen (the cat faces the viewer).
  const eyes = [];
  const brows = [];
  const cheeks = [];
  for (const s of [-1, 1]) {
    // Eyes (each in a group so we can blink / wink by squashing Y)
    const eye = new THREE.Group();
    eye.position.set(0.32 * s, 0.1, 0.62);
    eye.add(mesh(sphere(0.22), MAT.white, { scale: [1, 1, 0.6] }));
    eye.add(mesh(sphere(0.095), MAT.black, { pos: [0, 0, 0.12] }));
    eye.add(mesh(sphere(0.03), MAT.shine, { pos: [0.03, 0.04, 0.2] }));
    head.add(eye);
    eyes.push(eye);

    // Angry eyebrows (inner end lower)
    const brow = mesh(new THREE.BoxGeometry(0.34, 0.07, 0.08), MAT.stripe, { pos: [0.32 * s, 0.38, 0.72], rot: [0, 0, 0.35 * s] });
    head.add(brow);
    brows.push(brow);

    // Cheeks / muzzle puffs
    const cheek = mesh(sphere(0.2), MAT.white, { pos: [0.14 * s, -0.24, 0.66], scale: [1, 0.8, 0.7] });
    head.add(cheek);
    cheeks.push(cheek);

    // Whiskers
    const pts = [];
    for (let k = -1; k <= 1; k++) {
      pts.push(new THREE.Vector3(0.28 * s, -0.22 + k * 0.03, 0.74), new THREE.Vector3(1.0 * s, -0.16 + k * 0.1, 0.55));
    }
    head.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x222222 })));
  }

  // Nose, with a larger invisible hit area so it's easy to boop
  const nose = mesh(sphere(0.07), MAT.pink, { pos: [0, -0.1, 0.82], scale: [1.3, 0.9, 0.8] });
  nose.userData.part = 'nose';
  head.add(nose);
  const noseHit = new THREE.Mesh(sphere(0.13), MAT.hitbox);
  noseHit.position.set(0, -0.1, 0.84);
  noseHit.userData.part = 'nose';
  head.add(noseHit);

  // Mouth shapes, blended by the expression values
  const arc = new THREE.TorusGeometry(0.08, 0.016, 8, 20, Math.PI);
  const frown = mesh(arc, MAT.black, { pos: [0, -0.4, 0.74] }); // ∩
  const smile = mesh(arc, MAT.black, { pos: [0, -0.36, 0.745], rot: [0, 0, Math.PI] }); // ∪
  smile.scale.set(1.25, 1.1, 1);
  const open = new THREE.Group(); // open mouth for yawns
  open.position.set(0, -0.42, 0.68);
  open.add(mesh(sphere(0.14), MAT.mouth, { scale: [1, 1, 0.4] }));
  open.add(mesh(sphere(0.08), MAT.pink, { pos: [0, -0.07, 0.03], scale: [1.1, 0.5, 0.6] })); // tongue
  const pucker = new THREE.Group(); // kiss "o": puckered lips around a dark centre
  pucker.position.set(0, -0.38, 0.76);
  pucker.add(mesh(new THREE.TorusGeometry(0.07, 0.035, 12, 28), MAT.lips));
  pucker.add(mesh(new THREE.CircleGeometry(0.045, 20), MAT.mouth, { pos: [0, 0, 0.01] }));
  head.add(frown, smile, open, pucker);

  return { head, eyes, ears, nose, rig: { eyes, brows, cheeks, frown, smile, open, pucker } };
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
  const root = new THREE.Group(); // placed by main.js
  const body = new THREE.Group(); // everything, so the cat can hop
  root.add(body);
  const torso = new THREE.Group(); // yaws a little toward the target
  torso.userData.part = 'body';
  body.add(torso);

  // Body
  torso.add(mesh(sphere(1), MAT.fur, { scale: [0.85, 1, 0.75] }));
  const belly = mesh(sphere(1), MAT.white, { pos: [0, -0.15, 0.4], scale: [0.55, 0.7, 0.4] });
  belly.userData.part = 'belly';
  torso.add(belly);
  for (const s of [-1, 1]) {
    const foot = mesh(sphere(1), MAT.white, { pos: [0.42 * s, -0.98, 0.3], scale: [0.28, 0.17, 0.38] });
    foot.userData.part = 'feet';
    body.add(foot);
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
  tail.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.24, 8), MAT.hitbox)); // easier to click
  tail.add(mesh(sphere(0.11), MAT.stripe, { pos: [0.6, 1.5, -0.3] }));
  tail.userData.part = 'tail';
  body.add(tail);

  // Head on a neck pivot
  const neck = new THREE.Group();
  neck.position.set(0, 1.0, 0);
  const { head, eyes, ears, nose, rig } = buildHead();
  head.position.y = 0.3;
  neck.add(head);
  torso.add(neck);

  // Gun, held out in front of the chest
  const gunPivot = new THREE.Group();
  gunPivot.position.set(0, 0.42, 0.35);
  const { gun, muzzle, flash, light, grips } = buildGun();
  const GUN_REST_Z = 0.95;
  gun.position.z = GUN_REST_Z;
  gun.userData.part = 'gun';
  // The model sits in a "spinner" pivoting at the trigger guard, so it can do a
  // trick spin while the paws (which follow `gun`) stay put.
  const spinner = new THREE.Group();
  spinner.position.y = -0.12;
  while (gun.children.length) {
    const c = gun.children[0];
    c.position.y += 0.12;
    spinner.add(c);
  }
  gun.add(spinner);
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

  // Expression state (0..1 each). eyeL/eyeR are the eyes on the left/right of the SCREEN.
  // `roll` is in radians: the head tilt about the cat's forward axis.
  const EXPR_KEYS = ['eyeL', 'eyeR', 'jaw', 'smile', 'browUp', 'browDown', 'puff', 'pucker', 'roll'];
  const expr = Object.fromEntries(EXPR_KEYS.map((k) => [k, 0]));
  const exprTarget = { ...expr };
  let faceDriven = false;

  /** Copy a face: pass expression values (0..1), or null to go back to the default grumpy face. */
  function setExpression(values) {
    faceDriven = !!values;
    for (const k of EXPR_KEYS) exprTarget[k] = values?.[k] ?? 0;
  }

  const show = (obj, amount) => {
    obj.visible = amount > 0.02;
    return obj.visible;
  };

  function applyExpression(dt, autoBlink, overlay, overlayAmount) {
    const a = 1 - Math.exp(-dt * 18);
    for (const k of EXPR_KEYS) expr[k] += (exprTarget[k] - expr[k]) * a;
    // A click reaction can push expressions on top of whatever the face is doing.
    const eff = { ...expr };
    if (overlay) for (const k in overlay) eff[k] = Math.max(eff[k], overlay[k] * overlayAmount);
    const { eyeL, eyeR, jaw, smile, browUp, browDown, puff, pucker, roll } = eff;

    // Head tilt (roll), on top of the neck that keeps the face pointed at you
    head.rotation.z = roll;

    // Eyes: blink/wink, plus a slight happy squint when smiling
    [eyeL, eyeR].forEach((closed, i) => {
      const c = Math.min(1, Math.max(closed, autoBlink) + smile * 0.25);
      rig.eyes[i].scale.y = 1 - 0.9 * c;
    });

    // Brows: base angle is angry; raising relaxes them, frowning deepens them
    rig.brows.forEach((b, i) => {
      const s = i === 0 ? -1 : 1;
      b.rotation.z = 0.35 * s * (1 - 1.3 * browUp - 0.7 * smile + 0.6 * browDown);
      b.position.y = 0.38 + 0.1 * browUp - 0.05 * browDown;
    });

    // Cheeks puff out and lift with a smile
    rig.cheeks.forEach((c) => {
      const k = 1 + 0.8 * puff;
      c.scale.set(k, 0.8 * k, 0.7 + 0.9 * puff);
      c.position.y = -0.24 + 0.05 * smile;
    });

    // Mouth: open (yawn) > pucker (kiss) > smile > default frown
    const open = Math.min(1, jaw);
    const kiss = pucker * (1 - open);
    const grin = smile * (1 - open) * (1 - kiss);
    if (show(rig.open, open)) {
      rig.open.scale.set(1 + 0.2 * open, 0.15 + 1.3 * open, 1);
      rig.open.position.y = -0.42 - 0.05 * open;
    }
    if (show(rig.pucker, kiss)) rig.pucker.scale.setScalar(kiss);
    if (show(rig.smile, grin)) rig.smile.scale.set(1.25 * grin, 1.1 * grin, 1);
    const sulk = 1 - Math.max(open, kiss, grin);
    if (show(rig.frown, sulk)) rig.frown.scale.setScalar(sulk);
  }

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
    // The cat blinks on its own only when it isn't copying your face.
    nextBlink -= dt;
    if (nextBlink <= 0) { blinkT = 0.14; nextBlink = 2 + Math.random() * 4; }
    blinkT = Math.max(0, blinkT - dt);

    const { overlay, amount } = animateReaction(dt);
    applyExpression(dt, !faceDriven && blinkT > 0 ? 1 : 0, overlay, amount);
  }

  function fire() {
    recoil = 1;
  }

  // --- click reactions ---
  const REACTIONS = {
    head: { dur: 1.1, caption: ['...FINE. ONE PAT.', ''], expr: { eyeL: 1, eyeR: 1, smile: 1 } },
    nose: { dur: 1.2, caption: ['ACHOO', "THAT ONE'S ON YOU"], expr: { eyeL: 1, eyeR: 1, browUp: 0.8 } },
    earL: { dur: 0.7, caption: ['WHAT?', ''], expr: { browUp: 0.7 } },
    earR: { dur: 0.7, caption: ['WHAT?', ''], expr: { browUp: 0.7 } },
    belly: { dur: 1.4, caption: ['NOT THE BELLY', ''], expr: { eyeL: 1, eyeR: 1, smile: 1, jaw: 0.4 } },
    tail: { dur: 1.6, caption: ['HSSSS', ''], expr: { browDown: 1, jaw: 0.5 } },
    gun: { dur: 0.9, caption: ["DON'T TOUCH THE MERCHANDISE", ''], expr: { smile: 0.6 } },
    feet: { dur: 0.6, caption: ['WATCH THE TOES', ''], expr: { eyeL: 0.6, eyeR: 0.6, jaw: 0.6, browUp: 1 } },
    body: { dur: 0.5, caption: ['HANDS OFF', ''], expr: { browDown: 0.8 } },
  };
  let reaction = null;
  const NOSE_SCALE = nose.scale.clone();

  /** Start the reaction for a clicked part. Returns { caption, duration } for the UI. */
  function react(part) {
    const def = REACTIONS[part] ?? REACTIONS.body;
    reaction = { part: REACTIONS[part] ? part : 'body', def, t: 0, sneezed: false };
    return { caption: def.caption, duration: def.dur + 0.4 };
  }

  function animateReaction(dt) {
    // Rest pose for everything a reaction might touch
    head.scale.set(1, 1, 1);
    head.rotation.x = 0;
    nose.scale.copy(NOSE_SCALE);
    ears.forEach((e) => (e.rotation.z = e.userData.baseRotZ));
    torso.scale.x = torso.scale.z = 1;
    torso.position.x = 0;
    tail.scale.setScalar(1);
    spinner.rotation.x = 0;
    body.position.y = 0;
    if (!reaction) return { overlay: null, amount: 0 };

    reaction.t += dt;
    const { part, def, t: rt } = reaction;
    const p = rt / def.dur;
    if (p >= 1) {
      reaction = null;
      return { overlay: null, amount: 0 };
    }
    const env = 1 - p; // fades out over the reaction

    switch (part) {
      case 'head': { // squash for a pat
        const w = Math.sin(rt * 22) * env;
        head.scale.set(1 + 0.07 * w, 1 - 0.12 * Math.abs(w), 1 + 0.07 * w);
        break;
      }
      case 'nose': { // wind up, sneeze, accidental shot
        const windUp = 0.45;
        if (rt < windUp) {
          const k = rt / windUp;
          head.rotation.x = -0.35 * k;
          nose.scale.copy(NOSE_SCALE).multiplyScalar(1 + 0.6 * k);
        } else {
          if (!reaction.sneezed) {
            reaction.sneezed = true;
            api.onSneeze?.();
          }
          head.rotation.x = 0.3 * Math.exp(-(rt - windUp) * 8) * Math.cos((rt - windUp) * 20);
        }
        break;
      }
      case 'earL':
      case 'earR': { // flick that ear
        const ear = ears[part === 'earL' ? 0 : 1];
        ear.rotation.z = ear.userData.baseRotZ + Math.sin(rt * 45) * 0.6 * env;
        break;
      }
      case 'belly': { // jiggle
        const w = Math.sin(rt * 28) * 0.07 * env;
        torso.scale.x = 1 + w;
        torso.scale.z = 1 - w;
        break;
      }
      case 'tail': // puff up and whip
        tail.scale.setScalar(1 + 0.8 * Math.min(1, rt * 8) * env);
        tail.rotation.y += Math.sin(rt * 30) * 0.5 * env;
        break;
      case 'gun': { // two trick spins around the trigger guard
        const e = 1 - Math.pow(1 - p, 3);
        spinner.rotation.x = -Math.PI * 4 * e;
        break;
      }
      case 'feet': // hop
        body.position.y = Math.sin(Math.PI * p) * 0.55;
        break;
      default: // flinch
        torso.position.x = Math.sin(rt * 55) * 0.06 * env;
    }
    return { overlay: def.expr, amount: Math.min(1, env * 3) };
  }

  /** Which tagged body part (if any) a raycaster hits. */
  function partAt(raycaster) {
    for (const hit of raycaster.intersectObject(root, true)) {
      for (let o = hit.object; o && o !== root; o = o.parent) {
        if (o.userData.part) return o.userData.part;
      }
    }
    return null;
  }

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  const api = {
    root, update, fire, setExpression, expr, react, partAt,
    onSneeze: null, // set by main.js: what happens when a sneeze sets the gun off
    height: 3.4, width: 2.4, minY: -1.15, muzzle,
  };
  return api;
}
