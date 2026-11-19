/* DI Flowers - scroll-driven coded rose. All motion driven by scroll progress t in [0,1]. */
(function () {
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;

  const BG = 0x050406;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.075);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);

  // ---------- lights ----------
  scene.add(new THREE.AmbientLight(0x1c1418, 0.8));
  const spot = new THREE.SpotLight(0xffeeda, 2.6, 30, 0.30, 0.7, 1.6);
  spot.position.set(0.9, 10, 2.6);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, 3.2, 0);
  scene.add(spotTarget);
  spot.target = spotTarget;
  scene.add(spot);
  const rim = new THREE.PointLight(0xff8fa3, 0.55, 16);
  rim.position.set(-2.8, 4.2, -2.0);
  scene.add(rim);
  const fill = new THREE.PointLight(0xffe6d2, 0.22, 14);
  fill.position.set(2.2, 2.2, 3.0);
  scene.add(fill);

  // ---------- volumetric beam ----------
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe9c9, transparent: true, opacity: 0.030,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.7, 10, 32, 1, true), beamMat);
  beam.position.set(0.42, 5.8, 1.15);
  beam.rotation.z = 0.07;
  scene.add(beam);

  // ---------- dust particles in the beam ----------
  const DUST = 220;
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = [];
  for (let i = 0; i < DUST; i++) {
    const y = 0.6 + Math.random() * 5.6;
    const r = (0.15 + (6.2 - y) * 0.12) * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    dustPos[i * 3] = Math.cos(a) * r + 0.3;
    dustPos[i * 3 + 1] = y;
    dustPos[i * 3 + 2] = Math.sin(a) * r + 0.8;
    dustSeed.push(Math.random() * 100);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xffe2b8, size: 0.016, transparent: true, opacity: 0.45,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  scene.add(dust);

  // ---------- soil ----------
  const soil = new THREE.Mesh(
    new THREE.CircleGeometry(7, 48),
    new THREE.MeshStandardMaterial({ color: 0x070506, roughness: 1 })
  );
  soil.rotation.x = -Math.PI / 2;
  scene.add(soil);
  const clumpGeo = new THREE.IcosahedronGeometry(1, 0);
  const clumpMat = new THREE.MeshStandardMaterial({ color: 0x0f0a09, roughness: 1 });
  for (let i = 0; i < 110; i++) {
    const c = new THREE.Mesh(clumpGeo, clumpMat);
    const a = Math.random() * Math.PI * 2;
    const r = 0.12 + Math.pow(Math.random(), 0.55) * 1.9;
    c.position.set(Math.cos(a) * r, 0.012, Math.sin(a) * r);
    c.scale.set(0.025 + Math.random() * 0.07, 0.015 + Math.random() * 0.04, 0.025 + Math.random() * 0.07);
    c.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    scene.add(c);
  }

  // ---------- stem (progressive reveal) ----------
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06, 0.9, 0.02),
    new THREE.Vector3(-0.05, 1.8, -0.02),
    new THREE.Vector3(0.02, 2.6, 0.01),
    new THREE.Vector3(0, 3.2, 0),
  ]);
  const stemGeo = new THREE.TubeGeometry(stemCurve, 220, 0.036, 8, false);
  const stemIndexCount = stemGeo.index.count;
  const stem = new THREE.Mesh(stemGeo, new THREE.MeshStandardMaterial({ color: 0x2e4223, roughness: 0.8 }));
  scene.add(stem);

  const stemPoint = (u) => stemCurve.getPoint(u);

  // ---------- leaf builder ----------
  function leafGeometry(len, wid, curl) {
    const NU = 16, NV = 8;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array((NU + 1) * (NV + 1) * 3);
    const col = new Float32Array((NU + 1) * (NV + 1) * 3);
    const idx = [];
    const base = new THREE.Color(0x2c421f), tip = new THREE.Color(0x4a6a33);
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      // pointed-oval blade with a sharp tip
      const w = Math.sin(Math.PI * Math.pow(u, 0.62)) * wid * (1 - 0.55 * Math.pow(u, 3));
      for (let j = 0; j <= NV; j++) {
        const v = (j / NV) * 2 - 1;
        const k = (i * (NV + 1) + j) * 3;
        pos[k] = v * w;
        pos[k + 1] = u * len;
        pos[k + 2] = curl * u * u + 0.05 * v * v * wid;
        const c = base.clone().lerp(tip, u * 0.85);
        col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
      }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = a + NV + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }

  const leafMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.6, side: THREE.DoubleSide,
  });

  const leafDefs = [
    { u: 0.28, az: 0.5, len: 0.92, wid: 0.16, curl: 0.42, t0: 0.14, t1: 0.40 },
    { u: 0.45, az: Math.PI + 0.45, len: 1.02, wid: 0.18, curl: 0.48, t0: 0.20, t1: 0.48 },
    { u: 0.62, az: -0.55, len: 0.84, wid: 0.15, curl: 0.44, t0: 0.28, t1: 0.56 },
    { u: 0.77, az: Math.PI - 0.5, len: 0.66, wid: 0.12, curl: 0.38, t0: 0.36, t1: 0.62 },
  ];
  const leaves = leafDefs.map(d => {
    const m = new THREE.Mesh(leafGeometry(d.len, d.wid, d.curl), leafMat);
    const p = stemPoint(d.u);
    m.position.copy(p);
    m.rotation.order = 'YXZ';
    m.rotation.y = d.az;
    m.rotation.z = 0.15;
    scene.add(m);
    return { mesh: m, def: d };
  });

  // ---------- petal parametric builder ----------
  // A petal is a curved sheet arcing out from the flower axis. theta(u) runs from
  // a0 (base angle from vertical) to a1 (tip angle); beyond u=0.72 the tip curls
  // further by tipCurl. Closed (openT=0) is a tight cone; open is a wide cup.
  function spinePoint(L, a0, a1, tipCurl, u) {
    const N = 24;
    let rad = 0, y = 0, prev = a0;
    let px = 0, py = 0, pth = a0;
    for (let s = 0; s <= N; s++) {
      const uu = (s / N) * u;
      let th = a0 + (a1 - a0) * uu;
      if (uu > 0.72) th += tipCurl * Math.pow((uu - 0.72) / 0.28, 2);
      const ds = (L / N);
      if (s > 0) { rad += Math.sin((prev + th) / 2) * ds; y += Math.cos((prev + th) / 2) * ds; }
      prev = th;
      px = rad; py = y; pth = th;
    }
    return { radial: px, y: py, theta: pth };
  }

  function buildPetalGeometry(p, openT) {
    const a0 = p.a0c + (p.a0o - p.a0c) * openT;
    const a1 = p.a1c + (p.a1o - p.a1c) * openT;
    const NU = 18, NV = 12;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array((NU + 1) * (NV + 1) * 3);
    const col = new Float32Array((NU + 1) * (NV + 1) * 3);
    const idx = [];
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      const sp = spinePoint(p.L, a0, a1, p.tipCurl * openT, u);
      const wProfile = p.W * (0.16 + 0.84 * Math.pow(Math.sin(Math.PI * Math.pow(u * 0.92, 0.55)), 0.8));
      const ruffle = 1 + 0.03 * Math.sin(3 * Math.PI * u + p.rufflePhase);
      const thHere = sp.theta;
      for (let j = 0; j <= NV; j++) {
        const v = (j / NV) * 2 - 1;
        const k = (i * (NV + 1) + j) * 3;
        const w = wProfile * ruffle * 0.5;
        // cup: edges roll back away from the axis as the bloom opens
        const cup = p.cup * v * v * wProfile * (0.3 + 0.7 * openT);
        pos[k] = sp.radial + cup * Math.sin(thHere);
        pos[k + 1] = sp.y - cup * Math.cos(thHere);
        pos[k + 2] = v * w;
        const c = p.cBase.clone().lerp(p.cTip, Math.pow(u, 1.25));
        col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
      }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = a + NV + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }

  const C_IN = new THREE.Color(0x9c4660), C_OUT = new THREE.Color(0xe3abb6);

  // The bloom is six nested scalloped shells, each profiled from the base point to
  // its rim. Closed: rims stack upward like an onion (bud). Open: rims spread wide
  // and step downward (bloomed rose). Per-frame lerp between the two.
  function buildShellGeometry(rimRad, rimY, yExp, droop, nScallop, phase, cBase, cTip) {
    const NU = 14, NV = 48;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array((NU + 1) * (NV + 1) * 3);
    const col = new Float32Array((NU + 1) * (NV + 1) * 3);
    const idx = [];
    for (let i = 0; i <= NU; i++) {
      const u = i / NU;
      const rimW = Math.pow(Math.max(0, (u - 0.5) / 0.5), 2);
      const baseRad = rimRad * Math.pow(u, 0.8);
      const baseY = rimY * Math.pow(u, yExp) + droop * Math.pow(u, 3);
      for (let j = 0; j <= NV; j++) {
        const v = j / NV;
        const az = v * Math.PI * 2;
        const k = (i * (NV + 1) + j) * 3;
        const scall = 1 + 0.07 * rimW * Math.cos(az * nScallop + phase);
        const rad = baseRad * scall;
        pos[k] = Math.cos(az) * rad;
        pos[k + 1] = baseY + 0.06 * rimRad * rimW * Math.sin(az * nScallop + phase * 1.7);
        pos[k + 2] = Math.sin(az) * rad;
        const c = cBase.clone().lerp(cTip, Math.pow(u, 1.2));
        col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
      }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = i * (NV + 1) + j, b = a + NV + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }

  const shellMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.62, side: THREE.DoubleSide,
    sheen: 0.5, sheenColor: new THREE.Color(0xffc4cd), sheenRoughness: 0.55,
    emissive: 0x2c1219, emissiveIntensity: 0.32,
  });
  const sepalMat = new THREE.MeshStandardMaterial({
    color: 0x33502a, roughness: 0.7, side: THREE.DoubleSide,
  });

  const head = new THREE.Group();
  head.position.copy(stemPoint(1));
  scene.add(head);

  // closed -> open rim targets per shell (inner first)
  const shellDefs = [
    { radC: 0.13, yC: 0.34, radO: 0.16, yO: 0.66, droopO: 0.00, n: 5, delay: 0.00 },
    { radC: 0.18, yC: 0.42, radO: 0.26, yO: 0.60, droopO: -0.01, n: 5, delay: 0.05 },
    { radC: 0.22, yC: 0.48, radO: 0.36, yO: 0.53, droopO: -0.03, n: 6, delay: 0.11 },
    { radC: 0.25, yC: 0.53, radO: 0.46, yO: 0.45, droopO: -0.06, n: 7, delay: 0.17 },
    { radC: 0.28, yC: 0.57, radO: 0.55, yO: 0.37, droopO: -0.10, n: 8, delay: 0.23 },
    { radC: 0.30, yC: 0.60, radO: 0.63, yO: 0.30, droopO: -0.15, n: 9, delay: 0.30 },
  ];
  const shells = [];
  shellDefs.forEach((d) => {
    const shade = 0.93 + Math.random() * 0.12;
    const cB = C_IN.clone().multiplyScalar(shade);
    const cT = C_OUT.clone().multiplyScalar(shade);
    const phase = Math.random() * 6;
    const mesh = new THREE.Mesh(buildShellGeometry(d.radC, d.yC, 2.0, 0, d.n, phase, cB, cT), shellMat);
    head.add(mesh);
    shells.push({ d, mesh, cB, cT, phase });
  });

  const sepals = [];
  for (let k = 0; k < 5; k++) {
    const az = (k / 5) * Math.PI * 2 + 0.3;
    const p = {
      L: 0.34, W: 0.12, a0c: 0.18, a1c: 0.40, a0o: 0.60, a1o: 1.45, tipCurl: 0.20,
      cup: 0.1, rufflePhase: 0, cBase: new THREE.Color(0x33502a), cTip: new THREE.Color(0x33502a),
    };
    const holder = new THREE.Group();
    holder.rotation.y = az;
    holder.position.y = -0.03;
    const mesh = new THREE.Mesh(buildPetalGeometry(p, 0), sepalMat);
    holder.add(mesh);
    head.add(holder);
    sepals.push({ p, mesh });
  }

  // ---------- droplets (outer rings only, appear at the end) ----------
  const dropMat = new THREE.MeshPhongMaterial({
    color: 0xf6f2f2, specular: 0xffffff, shininess: 160,
    transparent: true, opacity: 0.92,
  });
  const dropGeo = new THREE.SphereGeometry(1, 10, 8);
  const droplets = [];
  function addDroplet(parent, pos, s) {
    const d = new THREE.Mesh(dropGeo, dropMat);
    d.position.copy(pos);
    d.scale.setScalar(0.0001);
    d.userData.s = s;
    parent.add(d);
    droplets.push(d);
  }
  shells.forEach((sh, si) => {
    if (si < 3) return; // outer shells only
    for (let q = 0; q < 4; q++) {
      const u = 0.6 + Math.random() * 0.3;
      const az = Math.random() * Math.PI * 2;
      const rad = sh.d.radO * Math.pow(u, 0.8);
      const y = sh.d.yO * Math.pow(u, 1.3) + sh.d.droopO * Math.pow(u, 3);
      addDroplet(sh.mesh, new THREE.Vector3(Math.cos(az) * rad, y + 0.02, Math.sin(az) * rad), 0.013 + Math.random() * 0.011);
    }
  });
  leaves.forEach((lf, i) => {
    if (i % 2) return;
    addDroplet(lf.mesh, new THREE.Vector3(0.03, lf.def.len * 0.5, lf.def.curl * 0.3 + 0.03), 0.014);
  });

  // ---------- growth mapping ----------
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
  const seg = (t, a, b) => ease((t - a) / (b - a));

  let currentT = 0, targetT = 0;

  function applyT(t) {
    const stemT = seg(t, 0.0, 0.34);
    stemGeo.setDrawRange(0, Math.floor(stemIndexCount * stemT));

    leaves.forEach(({ mesh, def }) => {
      const lt = seg(t, def.t0, def.t1);
      mesh.visible = lt > 0.001 && stemT > def.u;
      const s = ease(lt);
      mesh.scale.setScalar(Math.max(s, 0.0001));
      mesh.rotation.x = -0.12 - 1.02 * s; // hugging the stem -> angled outward
    });

    const budT = seg(t, 0.34, 0.52);
    head.visible = budT > 0.001;
    const openGrow = seg(t, 0.52, 0.94);
    head.scale.setScalar((0.25 + 0.75 * budT) * (1 + 0.14 * openGrow));
    head.rotation.y = 0.7 * openGrow;
    const openT = seg(t, 0.52, 0.94);
    shells.forEach(({ d, mesh, cB, cT, phase }) => {
      const ot = ease(clamp01((openT - d.delay) / (1 - d.delay)));
      const rr = d.radC + (d.radO - d.radC) * ot;
      const ry = d.yC + (d.yO - d.yC) * ot;
      const ye = 2.0 - 0.7 * ot;
      const dr = d.droopO * ot;
      const g = buildShellGeometry(rr, ry, ye, dr, d.n, phase, cB, cT);
      mesh.geometry.dispose();
      mesh.geometry = g;
    });
    sepals.forEach(({ p, mesh }) => {
      const g = buildPetalGeometry(p, ease(openT));
      mesh.geometry.dispose();
      mesh.geometry = g;
    });

    const dropT = seg(t, 0.9, 1.0);
    droplets.forEach((d, i) => {
      const dt = clamp01(dropT * 1.6 - (i % 7) * 0.09);
      const s = d.userData.s * (dt <= 0 ? 0.0001 : dt * (1.6 - 0.6 * dt));
      d.scale.setScalar(Math.max(s, 0.0001));
    });

    const cz = 7.8 - 2.2 * ease(t);
    const cy = 1.5 + 1.7 * ease(t * 0.92);
    camera.position.set(0.3 * Math.sin(t * 0.6), cy, cz);
    camera.lookAt(0, 1.5 + 1.75 * ease(t), 0);

    beamMat.opacity = 0.022 + 0.02 * openT;
    spot.intensity = 2.1 + 0.6 * openT;

    const posA = dustGeo.attributes.position;
    for (let i = 0; i < DUST; i++) {
      posA.array[i * 3] += Math.sin(t * 8 + dustSeed[i]) * 0.0006;
    }
    posA.needsUpdate = true;

    document.getElementById('hint').style.opacity = t < 0.03 ? String(1 - t / 0.03) : '0';
    const end = seg(t, 0.9, 1.0);
    const title = document.getElementById('hero-title');
    title.style.opacity = String(end);
    title.style.transform = `translate(-50%, ${30 * (1 - end)}px)`;
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function render() {
    currentT += (targetT - currentT) * 0.14;
    if (Math.abs(targetT - currentT) < 0.0004) currentT = targetT;
    applyT(currentT);
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  const hero = document.getElementById('hero-track');
  function onScroll() {
    const max = hero.offsetHeight - window.innerHeight;
    targetT = clamp01(window.scrollY / max);
    const past = clamp01((window.scrollY - max) / (window.innerHeight * 0.6));
    canvas.style.opacity = String(1 - past);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  render();

  window.__scene = scene; window.__head = head;
  window.setT = (v) => { targetT = v; currentT = v; applyT(v); renderer.render(scene, camera); };
})();
