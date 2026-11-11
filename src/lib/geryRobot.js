// GERY: robot pemandu 3D untuk halaman "Discuss with GERY".
// Mesin ini hanya mengurus gambar 3D (robot, ekspresi, gerak, partikel). Data dan teks diurus halaman React-nya.
import * as THREE from 'three';

const V3 = THREE.Vector3;
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
function radialTex(inner, outer) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }

// lingkungan studio buatan, supaya cangkang robot memantulkan cahaya dan terlihat mengkilap
function makeEnv(R) {
  const es = new THREE.Scene();
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#d6e6ff'); gr.addColorStop(0.5, '#f4ede4'); gr.addColorStop(1, '#6f7f95'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  es.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.BackSide })));
  const panel = (w, h, x, y, z, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
  panel(14, 8, 10, 12, 14, 7); panel(5, 11, -16, 4, 6, 4.5); panel(11, 4, 0, 17, -8, 3.5); panel(8, 3, 6, -6, 16, 2);
  const pm = new THREE.PMREMGenerator(R); const t = pm.fromScene(es, 0.03).texture; pm.dispose();
  return t;
}

export function webglOk() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; }
}

// opts: { canvas, board, link: { path, dot, dot2 }, getAccent(), onFps(fps, degraded), onGreet() }
export function createGery(opts) {
  const { canvas, board, link, getAccent, onFps, onGreet } = opts;
  let R;
  try { R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch { return null; }
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.12;
  const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200); cam.position.set(0, 0.3, 15);
  const envTex = makeEnv(R); scene.environment = envTex;
  const acc = new THREE.Color(getAccent());
  const S = { mode: '3d', dark: false, expr: 'neutral', speaking: false, focusEl: null, focusSide: 0 };
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(4, 7, 9); scene.add(key);
  const rim = new THREE.DirectionalLight(acc, 1.6); rim.position.set(-6, 3, -6); scene.add(rim); scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const mats = {
    shell: new THREE.MeshPhysicalMaterial({ color: 0xf1f4f8, roughness: 0.27, metalness: 0.06, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.15 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x04070d, roughness: 0.05, metalness: 0.75, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.5 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xaab5c4, metalness: 1, roughness: 0.28, envMapIntensity: 1.2 }),
    accent: new THREE.MeshStandardMaterial({ color: acc, emissive: acc, emissiveIntensity: 1.3, roughness: 0.35 }),
  };
  const disposables = [envTex];
  const track = (o) => { disposables.push(o); return o; };
  const geo = (g) => track(g);

  // wajah (layar kaca di kepala) dan layar dada digambar di canvas supaya bisa berubah ekspresi
  const face = { c: document.createElement('canvas'), t: null }, chest = { c: document.createElement('canvas'), t: null };
  face.c.width = 512; face.c.height = 256; chest.c.width = 256; chest.c.height = 128;
  const look = { x: 0, y: 0 };
  const accCss = () => getAccent();
  function drawFace(s) {
    const g = face.c.getContext('2d'), W = 512, H = 256, a = accCss(); g.clearRect(0, 0, W, H);
    const blink = (s % 4.3) > 4.15 ? 0.12 : 1; g.save(); g.translate(W / 2 + look.x * 26, H * 0.46 + look.y * -16);
    g.shadowColor = a; g.shadowBlur = 30; g.fillStyle = '#ffffff'; g.strokeStyle = '#ffffff'; g.lineCap = 'round';
    [-1, 1].forEach((sd) => {
      g.save(); g.translate(sd * 96, 0);
      if (S.expr === 'happy') { g.lineWidth = 20; g.beginPath(); g.arc(0, 22, 36, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      else {
        const w = 52, h = (S.expr === 'alert' ? 86 : S.expr === 'worried' ? 62 : 72) * blink; rr(g, -w / 2, -h / 2, w, h, 24); g.fill();
        if (S.expr === 'worried') { g.shadowBlur = 0; g.strokeStyle = a; g.lineWidth = 12; g.beginPath(); g.moveTo(-sd * 44, -66); g.lineTo(sd * 44, -70); g.stroke(); }
      }
      g.restore();
    });
    if (S.expr === 'think') { g.shadowBlur = 14; [0, 1, 2].forEach((i) => { g.beginPath(); g.arc(-40 + i * 40, 92, 7 + (Math.sin(s * 5 + i) + 1) * 2, 0, 6.3); g.fill(); }); }
    if (S.speaking) { g.shadowBlur = 16; const mw = 44 + Math.abs(Math.sin(s * 11)) * 56; rr(g, -mw / 2, 82, mw, 14, 7); g.fill(); }
    g.restore(); if (face.t) face.t.needsUpdate = true;
  }
  function drawChest(s) {
    const g = chest.c.getContext('2d'), W = 256, H = 128, a = accCss(); g.fillStyle = '#050c16'; g.fillRect(0, 0, W, H);
    g.fillStyle = a; g.font = '800 40px system-ui,sans-serif'; g.textAlign = 'left'; g.fillText('GERY', 16, 52);
    for (let i = 0; i < 16; i++) { const v = S.speaking ? 0.2 + 0.8 * Math.abs(Math.sin(s * 9 + i * 0.8)) : 0.12 + 0.1 * Math.sin(s * 2 + i); g.fillRect(16 + i * 14, 108 - v * 44, 9, v * 44); }
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '600 13px system-ui,sans-serif'; g.textAlign = 'right'; g.fillText('SALES · AI', W - 14, 28); if (chest.t) chest.t.needsUpdate = true;
  }

  const robot = new THREE.Group(); scene.add(robot);
  const head = new THREE.Group(); head.position.y = 1.5; robot.add(head);
  const sh = new THREE.Mesh(geo(new THREE.SphereGeometry(0.95, 56, 40)), mats.shell); sh.scale.set(1.02, 0.93, 0.98); head.add(sh);
  const sy = [1.02, 0.93, 0.98], phi0 = Math.PI / 2 - 1.02, thetaMid = Math.PI / 2 - 0.1;
  const plate = new THREE.Mesh(geo(new THREE.SphereGeometry(0.962, 56, 32, phi0, 2.04, thetaMid - 0.52, 1.04)), mats.glass); plate.scale.set(...sy); head.add(plate);
  face.t = track(new THREE.CanvasTexture(face.c)); face.t.encoding = THREE.sRGBEncoding; face.t.anisotropy = 4;
  const screen = new THREE.Mesh(geo(new THREE.SphereGeometry(0.97, 56, 32, phi0, 2.04, thetaMid - 0.52, 1.04)), new THREE.MeshBasicMaterial({ map: face.t, transparent: true, depthWrite: false, toneMapped: false })); screen.scale.set(...sy); head.add(screen);
  [-1, 1].forEach((sd) => {
    const ear = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 32)), mats.metal); ear.rotation.z = Math.PI / 2; ear.position.set(sd * 0.98, 0, 0); head.add(ear);
    const er = new THREE.Mesh(geo(new THREE.TorusGeometry(0.17, 0.028, 12, 40)), mats.accent); er.rotation.y = Math.PI / 2; er.position.set(sd * 1.09, 0, 0); head.add(er);
  });
  const ant = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.025, 0.03, 0.5, 12)), mats.metal); ant.position.set(0.25, 1.0, 0); ant.rotation.z = -0.25; head.add(ant);
  const tip = new THREE.Mesh(geo(new THREE.SphereGeometry(0.095, 20, 16)), mats.accent); tip.position.set(0.36, 1.26, 0); head.add(tip);
  const ring1 = new THREE.Mesh(geo(new THREE.TorusGeometry(1.42, 0.03, 12, 100)), new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.8 })); ring1.rotation.x = 1.3; head.add(ring1);
  const ring2 = new THREE.Mesh(geo(new THREE.TorusGeometry(1.7, 0.018, 12, 100)), new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.4 })); ring2.rotation.set(0.45, 0.3, 0); head.add(ring2);
  const neck = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.3, 0.38, 0.28, 28)), mats.metal); neck.position.y = 0.68; robot.add(neck);
  const torso = new THREE.Mesh(geo(new THREE.SphereGeometry(0.95, 56, 40)), mats.shell); torso.scale.set(0.84, 1.0, 0.72); torso.position.y = -0.55; robot.add(torso);
  const cframe = new THREE.Mesh(geo(new THREE.PlaneGeometry(0.7, 0.42)), mats.glass); cframe.position.set(0, -0.4, 0.69); robot.add(cframe);
  chest.t = track(new THREE.CanvasTexture(chest.c)); chest.t.encoding = THREE.sRGBEncoding;
  const csr = new THREE.Mesh(geo(new THREE.PlaneGeometry(0.64, 0.36)), new THREE.MeshBasicMaterial({ map: chest.t, toneMapped: false })); csr.position.set(0, -0.4, 0.695); robot.add(csr);
  const belt = new THREE.Mesh(geo(new THREE.TorusGeometry(0.76, 0.055, 14, 60)), mats.metal); belt.rotation.x = Math.PI / 2; belt.position.y = -1.12; belt.scale.set(1, 0.74, 1); robot.add(belt);
  const pod = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.52, 0.3, 0.42, 36)), mats.metal); pod.position.y = -1.62; robot.add(pod);
  const thruster = new THREE.Mesh(geo(new THREE.ConeGeometry(0.34, 0.62, 28, 1, true)), new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); thruster.position.y = -2.1; thruster.rotation.x = Math.PI; robot.add(thruster);

  // lengan dua ruas: sikut mengikuti target supaya gerakannya natural
  const arms = [-1, 1].map((sd) => {
    const Sp = new V3(sd * 0.93, -0.2, 0.02);
    const sj = new THREE.Mesh(geo(new THREE.SphereGeometry(0.2, 28, 20)), mats.metal); sj.position.copy(Sp); robot.add(sj);
    const sr = new THREE.Mesh(geo(new THREE.TorusGeometry(0.22, 0.025, 10, 36)), mats.accent); sr.position.copy(Sp); sr.rotation.y = Math.PI / 2; robot.add(sr);
    const up = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.115, 0.1, 1, 24)), mats.shell), fo = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.1, 0.085, 1, 24)), mats.shell), el = new THREE.Mesh(geo(new THREE.SphereGeometry(0.135, 24, 18)), mats.metal);
    const hand = new THREE.Group(); const palm = new THREE.Mesh(geo(new THREE.SphereGeometry(0.17, 28, 20)), mats.shell); const core = new THREE.Mesh(geo(new THREE.SphereGeometry(0.075, 18, 14)), mats.accent); core.position.set(0, 0.1, 0.1);
    const fg = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.036, 0.03, 0.34, 14)), mats.accent); fg.position.y = 0.26; hand.add(palm, core, fg);
    [up, fo, el, hand].forEach((m) => robot.add(m));
    return { sd, S: Sp, up, fo, el, hand, tgt: Sp.clone().add(new V3(sd * 0.45, -0.95, 0.3)) };
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: track(radialTex('#fff', 'rgba(255,255,255,0)')), color: acc, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.4 })); halo.scale.set(6, 6, 1); halo.position.set(0, 1.5, -0.8); robot.add(halo);
  const shadow = new THREE.Mesh(geo(new THREE.PlaneGeometry(4, 4)), new THREE.MeshBasicMaterial({ map: track(radialTex('rgba(0,0,0,.28)', 'rgba(0,0,0,0)')), transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = -3.05; scene.add(shadow);
  const floor = new THREE.Mesh(geo(new THREE.TorusGeometry(1.55, 0.03, 8, 80)), new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.6 })); floor.rotation.x = Math.PI / 2; floor.position.y = -3.03; scene.add(floor);
  const ripple = new THREE.Mesh(geo(new THREE.TorusGeometry(1.5, 0.04, 8, 90)), new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0 })); ripple.rotation.x = Math.PI / 2; ripple.position.y = -3.02; scene.add(ripple);
  const N = 80, pg = geo(new THREE.BufferGeometry()); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3).fill(999), 3));
  const parts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.16, map: track(radialTex('#fff', 'rgba(255,255,255,0)')), color: acc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); parts.frustumCulled = false; scene.add(parts);
  const P = { v: new Float32Array(N * 3), life: new Float32Array(N), n: N, i: 0 };
  const sp = new Float32Array(160 * 3); for (let i = 0; i < 160; i++) { sp[i * 3] = (Math.random() - 0.5) * 34; sp[i * 3 + 1] = (Math.random() - 0.5) * 18; sp[i * 3 + 2] = -10 - Math.random() * 14; }
  const sg = geo(new THREE.BufferGeometry()); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.09, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); scene.add(stars);

  function place(mesh, A, B) { const v = B.clone().sub(A), len = v.length(); mesh.position.copy(A).add(B).multiplyScalar(0.5); mesh.quaternion.setFromUnitVectors(new V3(0, 1, 0), v.normalize()); mesh.scale.set(1, len, 1); }
  function solveArm(a, target) {
    const Sp = a.S, d = target.clone().sub(Sp), dist = d.length(), dir = d.normalize(), L = 0.78, c = Math.min(Math.max(dist, 0.4), 2 * L - 0.03);
    const cosA = (L * L + c * c - L * L) / (2 * L * c), sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const pole = new V3(a.sd * 0.6, -1, -0.5).normalize(), ortho = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const elbow = Sp.clone().add(dir.clone().multiplyScalar(L * cosA)).add(ortho.multiplyScalar(L * sinA)), hand = Sp.clone().add(dir.clone().multiplyScalar(c));
    place(a.up, Sp, elbow); place(a.fo, elbow, hand); a.el.position.copy(elbow); a.hand.position.copy(hand); a.hand.quaternion.copy(a.fo.quaternion);
  }
  arms.forEach((a) => solveArm(a, a.tgt));

  const wtmp = new V3();
  function burst(pos, n = 26) { const arr = parts.geometry.attributes.position.array; for (let k = 0; k < n; k++) { const i = P.i++ % P.n; arr[i * 3] = pos.x; arr[i * 3 + 1] = pos.y; arr[i * 3 + 2] = pos.z; P.v[i * 3] = (Math.random() - 0.5) * 2.4; P.v[i * 3 + 1] = Math.random() * 2.2 + 0.2; P.v[i * 3 + 2] = (Math.random() - 0.3) * 1.6; P.life[i] = 0.7 + Math.random() * 0.5; } }
  function applyColors() {
    const c = new THREE.Color(getAccent()); mats.accent.color.copy(c); mats.accent.emissive.copy(c);
    [ring1, ring2, floor, ripple, thruster].forEach((m) => m.material.color.copy(c)); halo.material.color.copy(c); rim.color.copy(c); parts.material.color.copy(c);
    shadow.material.opacity = S.dark ? 0.7 : 1; stars.material.opacity = S.dark ? 0.85 : 0;
  }

  // ----- ukuran dan kamera -----
  let camBase = 15;
  function resize() {
    const w = board.clientWidth, h = board.clientHeight; if (!w || !h) return;
    R.setSize(w, h, false); cam.aspect = w / h;
    const robotH = 6.8, fov = cam.fov * Math.PI / 180, frac = S.mode === 'lite' ? 0.9 : 0.78; camBase = (robotH / frac) / (2 * Math.tan(fov / 2)); cam.position.z = camBase; cam.updateProjectionMatrix();
  }

  // ----- interaksi pointer: kepala mengikuti kursor, seret untuk memutar, klik untuk menyapa -----
  const pointer = { x: 0, y: 0, inside: false };
  let dragging = false, dragX0 = 0, dragMoved = 0, lastDrag = 0, dragYaw = 0, waveT = 0, hopT = 0, hopY = 0, rippleT = 0;
  const ptr = (e) => { const r = board.getBoundingClientRect(); pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1; pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1); pointer.inside = true; };
  const nearRobot = (e) => { const r = canvas.getBoundingClientRect(); wtmp.set(0, 0.4, 0); robot.localToWorld(wtmp); wtmp.project(cam); const x = (wtmp.x * 0.5 + 0.5) * r.width + r.left, y = (-wtmp.y * 0.5 + 0.5) * r.height + r.top; return Math.hypot(e.clientX - x, e.clientY - y) < r.height * 0.28; };
  const onMove = (e) => { ptr(e); if (dragging) { const dx = e.clientX - dragX0; dragMoved += Math.abs(dx); dragX0 = e.clientX; dragYaw = Math.max(-1.4, Math.min(1.4, dragYaw + dx * 0.012)); lastDrag = performance.now(); } else canvas.style.cursor = nearRobot(e) ? 'grab' : 'default'; };
  const onLeave = () => { pointer.inside = false; };
  const onDown = (e) => { if (nearRobot(e)) { dragging = true; dragMoved = 0; dragX0 = e.clientX; try { canvas.setPointerCapture(e.pointerId); } catch { /* abaikan */ } canvas.style.cursor = 'grabbing'; } };
  const onUp = () => { if (!dragging) return; dragging = false; canvas.style.cursor = 'grab'; if (dragMoved < 6) { waveT = 1.6; hopT = 1; S.expr = 'happy'; arms[1].hand.getWorldPosition(wtmp); burst(wtmp.clone(), 24); if (onGreet) onGreet(); } };
  board.addEventListener('pointermove', onMove); board.addEventListener('pointerleave', onLeave); canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp);

  // ----- loop gambar -----
  let raf = 0, tm = 0, nFrame = 0, fCount = 0, fLast = performance.now(), fpsLow = 0, degraded = false, alive = true;
  function frame(t) {
    if (!alive) return; raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = Math.min(0.05, (t - (tm || t)) / 1000 || 0.016); tm = t; const s = t / 1000, k = (r) => Math.min(1, dt * r);
    const fx = S.focusEl && S.mode !== 'lite' ? S.focusSide : 0;
    if (hopT > 0) hopT = Math.max(0, hopT - dt * 1.7); hopY = Math.sin(Math.PI * (1 - hopT)) * (hopT > 0 ? 0.42 : 0);
    if (!dragging && performance.now() - lastDrag > 200) dragYaw += (0 - dragYaw) * k(1.6);
    robot.position.x += (fx * 0.6 - robot.position.x) * k(3); robot.position.y = Math.sin(s * 1.6) * 0.08 + hopY;
    const yawT = fx * 0.42 + dragYaw + (pointer.inside && !S.focusEl ? pointer.x * 0.3 : 0) + (S.speaking ? Math.sin(s * 3) * 0.05 : 0);
    robot.rotation.y += (yawT - robot.rotation.y) * k(4); robot.rotation.z = Math.sin(s * 1.1) * 0.03 - fx * 0.05; robot.rotation.x = Math.sin(s * 0.9) * 0.02 + hopY * 0.25;
    cam.position.x += ((-fx * 1.0 + (pointer.inside ? pointer.x * 0.5 : 0)) - cam.position.x) * k(2); cam.position.y += ((0.25 + (pointer.inside ? pointer.y * 0.25 : 0)) - cam.position.y) * k(2); cam.position.z = camBase + (S.focusEl ? -0.4 : 0); cam.lookAt(0, 0.1, 0); cam.updateMatrixWorld();
    robot.updateMatrixWorld();
    let tx = 0, ty = 0, world = null; const hp = new V3(); head.getWorldPosition(hp); hp.project(cam);
    const br = board.getBoundingClientRect();
    if (S.focusEl && S.mode !== 'lite') {
      const r = S.focusEl.getBoundingClientRect();
      const nx = ((r.left + (S.focusSide < 0 ? r.width : 0) - br.left) / br.width) * 2 - 1, ny = -(((r.top + r.height * 0.4 - br.top) / br.height) * 2 - 1);
      tx = (nx - hp.x) * 1.4; ty = (ny - hp.y) * 1.6; world = new V3(nx, ny, 0.5).unproject(cam); const dir = world.sub(cam.position).normalize(); world = cam.position.clone().add(dir.multiplyScalar((0.7 - cam.position.z) / dir.z));
    } else if (pointer.inside) { tx = (pointer.x - hp.x) * 1.2; ty = (pointer.y - hp.y) * 1.2; } else { tx = Math.sin(s * 0.6) * 0.4; ty = Math.sin(s * 0.45) * 0.2; }
    look.x += (Math.max(-1, Math.min(1, tx)) - look.x) * k(6); look.y += (Math.max(-1, Math.min(1, ty)) - look.y) * k(6);
    head.rotation.y = look.x * 0.5; head.rotation.x = -look.y * 0.32 + (S.speaking ? Math.sin(s * 8) * 0.03 : 0); head.rotation.z = -look.x * 0.06;
    ring1.rotation.z += dt * 0.9; ring2.rotation.z -= dt * 0.5; tip.scale.setScalar(1 + Math.sin(s * 5) * 0.25); thruster.scale.set(1, 0.85 + Math.sin(s * 22) * 0.12 + Math.sin(s * 9) * 0.08, 1); floor.scale.setScalar(1 + Math.sin(s * 1.6) * 0.04);
    if (waveT > 0) waveT -= dt;
    arms.forEach((a) => {
      let want;
      if (world && a.sd === S.focusSide) want = robot.worldToLocal(world.clone());
      else if (waveT > 0 && a.sd === 1) want = a.S.clone().add(new V3(0.5, 0.6 + Math.sin(s * 13) * 0.2, 0.35));
      else { want = a.S.clone().add(new V3(a.sd * 0.42, -0.95, 0.28)); if (S.speaking) want.add(new V3(a.sd * 0.1, Math.sin(s * 6 + a.sd) * 0.12, Math.cos(s * 5) * 0.08)); want.y += Math.sin(s * 1.6 + a.sd) * 0.04; }
      a.tgt.lerp(want, k(world && a.sd === S.focusSide ? 7 : 5)); solveArm(a, a.tgt);
    });
    // garis penghubung dari tangan ke panel, dengan titik yang mengalir
    const pa = world && arms[S.focusSide > 0 ? 1 : 0];
    if (link && pa && S.focusEl) {
      pa.hand.getWorldPosition(wtmp); const q = wtmp.clone().project(cam), r0 = canvas.getBoundingClientRect();
      const ax = (q.x * 0.5 + 0.5) * r0.width + r0.left - br.left, ay = (-q.y * 0.5 + 0.5) * r0.height + r0.top - br.top; const r = S.focusEl.getBoundingClientRect();
      const bx = S.focusSide < 0 ? r.right - br.left : r.left - br.left, by = r.top + r.height * 0.4 - br.top;
      link.path.setAttribute('d', `M${ax},${ay} C${ax + (bx - ax) * 0.2},${Math.min(ay, by) - 60} ${ax + (bx - ax) * 0.8},${Math.min(ay, by) - 60} ${bx},${by}`); link.path.classList.add('on');
      link.dot.setAttribute('cx', bx); link.dot.setAttribute('cy', by); link.dot.classList.add('on');
      const len = link.path.getTotalLength(), p2 = link.path.getPointAtLength(((s * 0.9) % 1) * len); link.dot2.setAttribute('cx', p2.x); link.dot2.setAttribute('cy', p2.y); link.dot2.classList.add('on');
    } else if (link) { link.path.classList.remove('on'); link.dot.classList.remove('on'); link.dot2.classList.remove('on'); }
    if (rippleT > 0) { rippleT = Math.max(0, rippleT - dt * 0.9); const q = 1 - rippleT; ripple.scale.setScalar(1 + q * 2.4); ripple.material.opacity = rippleT * 0.55; }
    const arr = parts.geometry.attributes.position.array;
    for (let i = 0; i < P.n; i++) { if (P.life[i] > 0) { P.life[i] -= dt; arr[i * 3] += P.v[i * 3] * dt; arr[i * 3 + 1] += P.v[i * 3 + 1] * dt; arr[i * 3 + 2] += P.v[i * 3 + 2] * dt; P.v[i * 3 + 1] -= 2.2 * dt; if (P.life[i] <= 0) arr[i * 3] = arr[i * 3 + 1] = arr[i * 3 + 2] = 999; } }
    parts.geometry.attributes.position.needsUpdate = true; stars.rotation.y = s * 0.01;
    if (!(nFrame++ % 2)) { drawFace(s); drawChest(s); }
    R.render(scene, cam); fCount++;
    if (t - fLast > 900) {
      const fps = Math.round(fCount * 1000 / (t - fLast)); fCount = 0; fLast = t;
      if (fps < 22 && !degraded) { if (++fpsLow >= 2) { degraded = true; R.setPixelRatio(1); mats.shell.clearcoat = 0; mats.glass.clearcoat = 0; mats.shell.needsUpdate = true; mats.glass.needsUpdate = true; resize(); } } else if (fps >= 22) fpsLow = 0;
      if (onFps) onFps(fps, degraded);
    }
  }
  applyColors(); resize(); drawFace(0); drawChest(0); raf = requestAnimationFrame(frame);

  return {
    resize,
    setMode(m) { S.mode = m; resize(); },
    setTheme(dark) { S.dark = !!dark; applyColors(); },
    refreshColors: applyColors,
    setExpr(e) { S.expr = e || 'neutral'; },
    setSpeaking(b) { S.speaking = !!b; },
    // pindah fokus ke panel: robot melompat, menunjuk, dan memercikkan cahaya
    setFocus(el, side) {
      S.focusEl = el || null; S.focusSide = el ? side : 0; hopT = 1; rippleT = 1;
      const a = arms[side > 0 ? 1 : 0]; a.hand.getWorldPosition(wtmp); burst(wtmp.clone(), 30);
    },
    greet() { waveT = 1.6; hopT = 1; },
    get degraded() { return degraded; },
    destroy() {
      alive = false; cancelAnimationFrame(raf);
      board.removeEventListener('pointermove', onMove); board.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp);
      Object.values(mats).forEach((m) => m.dispose()); disposables.forEach((d) => { try { d.dispose(); } catch { /* abaikan */ } });
      scene.traverse((o) => { if (o.material && !Object.values(mats).includes(o.material)) { try { if (o.material.map && !disposables.includes(o.material.map)) o.material.map.dispose(); o.material.dispose(); } catch { /* abaikan */ } } });
      R.dispose(); try { R.forceContextLoss(); } catch { /* abaikan */ }
    },
  };
}
