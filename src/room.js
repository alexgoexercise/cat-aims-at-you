// A neon room behind the screen, built in "gravity space": +y is real-world up,
// the floor is the plane y = 0, and -z points horizontally into the screen.
// The room is deliberately built a little past the screen and then clipped at the
// screen plane, so it stays a clean "window" however the screen is tilted.
import * as THREE from 'three';

/**
 * @param {object} o
 * @param {number} o.halfW  half width of the room (x)
 * @param {number} o.ceil   ceiling height above the floor
 * @param {number} o.zBack  back wall position (negative)
 * @param {number} o.zFront front edge (positive; clipped by the screen)
 * @param {THREE.Plane[]} o.clippingPlanes  world-space planes that cut off everything in front of the screen
 */
export function createRoom({ halfW, ceil, zBack, zFront, clippingPlanes }) {
  const group = new THREE.Group();
  const len = zFront - zBack;
  const zMid = (zFront + zBack) / 2;
  const wallMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, clippingPlanes });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, len), wallMat(0x3a2860));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, zMid);
  floor.receiveShadow = true;

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, len), wallMat(0x1f1538));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, ceil, zMid);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, ceil), wallMat(0x2a1d4a));
  back.position.set(0, ceil / 2, zBack);

  const left = new THREE.Mesh(new THREE.PlaneGeometry(len, ceil), wallMat(0x251a42));
  left.rotation.y = Math.PI / 2;
  left.position.set(-halfW, ceil / 2, zMid);

  const right = new THREE.Mesh(new THREE.PlaneGeometry(len, ceil), wallMat(0x251a42));
  right.rotation.y = -Math.PI / 2;
  right.position.set(halfW, ceil / 2, zMid);

  group.add(floor, ceiling, back, left, right);

  // Neon grid. Rings every `step` along the depth, plus lines running into the screen.
  const pts = [];
  const seg = (a, b) => pts.push(new THREE.Vector3(...a), new THREE.Vector3(...b));
  const x0 = -halfW, x1 = halfW, y0 = 0, y1 = ceil;
  const depth = -zBack;
  const step = depth / 6;
  for (let z = zBack; z <= zFront; z += step) {
    seg([x0, y0, z], [x1, y0, z]); seg([x1, y0, z], [x1, y1, z]);
    seg([x1, y1, z], [x0, y1, z]); seg([x0, y1, z], [x0, y0, z]);
  }
  const cols = Math.max(4, Math.round((halfW * 2) / step));
  const rows = Math.max(3, Math.round(ceil / step));
  for (let i = 0; i <= cols; i++) {
    const x = x0 + ((x1 - x0) * i) / cols;
    seg([x, y0, zFront], [x, y0, zBack]); seg([x, y1, zFront], [x, y1, zBack]); seg([x, y0, zBack], [x, y1, zBack]);
  }
  for (let j = 0; j <= rows; j++) {
    const y = y0 + ((y1 - y0) * j) / rows;
    seg([x0, y, zFront], [x0, y, zBack]); seg([x1, y, zFront], [x1, y, zBack]); seg([x0, y, zBack], [x1, y, zBack]);
  }
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.35, clippingPlanes })
  );
  // Pull the lines in a hair so they don't z-fight with the walls.
  lines.scale.set(0.999, 0.999, 1);
  lines.position.y = ceil * 0.0005;
  group.add(lines);

  function dispose() {
    group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }

  return { group, dispose };
}
