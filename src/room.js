// A neon "box" behind the screen. With head-coupled perspective it makes the
// screen feel like a window into a small room the cat is standing in.
import * as THREE from 'three';

export function createRoom(w, h, d) {
  const group = new THREE.Group();
  const wallMat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });

  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat(0x2a1d4a));
  back.position.z = -d;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), wallMat(0x3a2860));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -h / 2, -d / 2);
  floor.receiveShadow = true;

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), wallMat(0x1f1538));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, h / 2, -d / 2);

  const left = new THREE.Mesh(new THREE.PlaneGeometry(d, h), wallMat(0x251a42));
  left.rotation.y = Math.PI / 2;
  left.position.set(-w / 2, 0, -d / 2);

  const right = left.clone();
  right.rotation.y = -Math.PI / 2;
  right.position.x = w / 2;

  group.add(back, floor, ceil, left, right);

  // Grid lines
  const pts = [];
  const seg = (a, b) => pts.push(new THREE.Vector3(...a), new THREE.Vector3(...b));
  const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
  const rings = 6;
  for (let i = 1; i <= rings; i++) {
    const z = (-d * i) / rings;
    seg([x0, y0, z], [x1, y0, z]); seg([x1, y0, z], [x1, y1, z]);
    seg([x1, y1, z], [x0, y1, z]); seg([x0, y1, z], [x0, y0, z]);
  }
  const cols = 8, rows = 6;
  for (let i = 0; i <= cols; i++) {
    const x = x0 + (w * i) / cols;
    seg([x, y0, 0], [x, y0, -d]); seg([x, y1, 0], [x, y1, -d]); seg([x, y0, -d], [x, y1, -d]);
  }
  for (let j = 0; j <= rows; j++) {
    const y = y0 + (h * j) / rows;
    seg([x0, y, 0], [x0, y, -d]); seg([x1, y, 0], [x1, y, -d]); seg([x0, y, -d], [x1, y, -d]);
  }
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xff4fd8, transparent: true, opacity: 0.35 })
  );
  // nudge lines off the walls so they don't z-fight
  lines.scale.setScalar(0.999);
  group.add(lines);

  function dispose() {
    group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }

  return { group, dispose };
}
