// The scripted demo, run inside the page by record.mjs. Each scene is marked so
// captions can be timed to it. Uses the window.__cat debug hooks.
async function runDemo() {
  const c = window.__cat;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const anim = (ms, fn) =>
    new Promise((resolve) => {
      const t0 = performance.now();
      const step = () => {
        const p = Math.min(1, (performance.now() - t0) / ms);
        fn(p);
        p < 1 ? requestAnimationFrame(step) : resolve();
      };
      requestAnimationFrame(step);
    });
  const marks = {};
  const mark = (name) => (marks[name] = performance.now());

  // Expression override: lets the script "pull faces" for the cat to copy
  const setExpr = c.cat.setExpression;
  let face = null;
  c.cat.setExpression = (v) => setExpr(face ?? v);

  const Z = c.CONFIG.defaultEyeDistance;
  const center = { x: 0, y: 0.02, z: Z };
  c.driveEye(center);

  mark('title');
  await sleep(3500);

  mark('aim'); // gentle side-to-side: the cat follows
  await anim(6000, (p) => {
    const a = p * Math.PI * 2;
    c.driveEye({ x: Math.sin(a) * 0.12, y: 0.02 + Math.sin(a * 2) * 0.05, z: Z });
  });

  mark('window'); // big head moves: head-coupled parallax
  await anim(6500, (p) => {
    const a = p * Math.PI * 2;
    c.driveEye({ x: Math.sin(a) * 0.28, y: 0.05 + Math.cos(a) * 0.07, z: Z - 0.14 * Math.sin(a * 2) });
  });
  c.driveEye(center);

  mark('blink'); // blink -> bang
  for (let i = 0; i < 3; i++) {
    await sleep(450);
    face = { eyeL: 1, eyeR: 1 };
    await sleep(150);
    c.fire();
    await sleep(120);
    face = null;
    await sleep(650);
  }

  mark('expr'); // wink, yawn, smile, head tilt, kiss
  face = { eyeL: 1 };
  await sleep(1400);
  face = null;
  await sleep(250);
  face = { jaw: 1, eyeL: 0.55, eyeR: 0.55, browUp: 0.6 };
  await sleep(1700);
  face = null;
  await sleep(250);
  face = { smile: 1 };
  await sleep(1300);
  await anim(2200, (p) => (face = { smile: 0.6, roll: Math.sin(p * Math.PI * 2) * 0.45 }));
  face = { pucker: 1, puff: 0.3 };
  await sleep(1100);
  face = null;
  await sleep(400);

  mark('poke'); // click reactions
  c.poke('nose');
  await sleep(1700);
  c.poke('belly');
  await sleep(1400);
  c.poke('gun');
  await sleep(1200);
  c.poke('feet');
  await sleep(900);
  c.poke('earR');
  await sleep(900);

  mark('level'); // lid tilt, then a simulated phone roll
  await anim(3600, (p) => c.level.setManualTilt(12 + Math.sin(p * Math.PI) * 15));
  await anim(3200, (p) =>
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 78, gamma: Math.sin(p * Math.PI * 2) * 28 }))
  );
  await sleep(1300); // sensor goes stale -> back to the lid tilt
  c.level.setManualTilt(12);

  mark('third'); // orbiting third-person view with the TV
  c.setView('third');
  {
    // Gentle scripted orbit: swing the camera around the target and back.
    const cam = c.third.camera;
    const target = c.third.controls.target.clone();
    const start = cam.position.clone().sub(target);
    await anim(7500, (p) => {
      const ang = Math.sin(p * Math.PI * 2) * 0.45;
      const off = start.clone().applyAxisAngle({ x: 0, y: 1, z: 0, isVector3: true }, ang);
      cam.position.copy(target).add(off);
      cam.lookAt(target);
      c.driveEye({ x: Math.sin(p * Math.PI * 2) * 0.12, y: 0.02, z: Z });
    });
  }

  mark('outro');
  await sleep(4500);
  mark('end');
  return marks;
}
