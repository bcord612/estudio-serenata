/* ════════════════════════════════════════════════════════════
   ESTUDIO SERENATA — cinematic engine
   1. Scroll-scrubbed hero: uses frames/hero/frame_0001.jpg... if
      present (Higgsfield pipeline); otherwise renders a fully
      generative scene — gold dust → soundwave → heart → petals —
      driven by the same scroll progress.
   2. Web Audio demo players (Karplus–Strong plucked strings) with
      live analyser visualizers; auto-upgrades to real MP3s when
      placed in audio/.
   3. Lenis smooth scroll + reveals + counters + film grain.
   ════════════════════════════════════════════════════════════ */

/* ───────────────────────── helpers ───────────────────────── */
const REDUCE_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
// transition weight: 0 before [a], 1 after [b]
const band = (p, a, b) => smooth(clamp((p - a) / (b - a), 0, 1));

/* ═════════════════════ HERO SCRUB SECTION ═════════════════════ */
const FRAME_COUNT = 179;
const framePath = (i) => `frames/hero/frame_${String(i).padStart(4, "0")}.jpg`;

const section = document.getElementById("cinematic");
const canvas = document.getElementById("frame-canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const lines = [...section.querySelectorAll(".line")];
const progressFill = document.getElementById("progress-fill");
const frameReadout = document.getElementById("frame-readout");

let mode = "generative"; // switches to "frames" if Higgsfield frames exist
let images = [];
let currentFrame = -1;
let progress = 0;

/* — detect Higgsfield frames — */
/* Héroe generativo por decisión de diseño (jul 23 2026): el clip de guitarra
   se veía desenfocado y barato frente al resto del sitio. Los fotogramas
   se quitaron del repo para aligerar el despliegue (Cloudflare) pero siguen
   en el historial de git: `git checkout da9be23 -- frames/` los recupera. */
const USE_HERO_FRAMES = false;
(function detectFrames() {
  if (!USE_HERO_FRAMES) return;
  /* conexiones lentas o con ahorro de datos: escena generativa, cero descargas */
  const conn = navigator.connection;
  if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ""))) return;
  /* móvil: ~60 fotogramas (1 de cada 3) — la mitad del peso, la misma película */
  const FRAME_STEP = window.matchMedia("(max-width: 880px)").matches ? 3 : 1;
  const probe = new Image();
  probe.onload = () => {
    mode = "frames";
    images[0] = probe;
    /* carga progresiva: primero fotogramas dispersos (la película completa
       en baja cadencia casi de inmediato), luego se rellenan los huecos —
       con concurrencia limitada para no saturar la conexión */
    const order = [];
    const seen = new Set([0]);
    for (const stride of [8, 4, 2, 1]) {
      for (let i = 0; i < FRAME_COUNT; i += stride) {
        if (i % FRAME_STEP !== 0) continue; // en móvil solo carga 1 de cada 3
        if (!seen.has(i)) { seen.add(i); order.push(i); }
      }
    }
    let next = 0;
    function loadNext() {
      if (next >= order.length) return;
      const i = order[next++];
      const img = new Image();
      img.decoding = "async";
      img.onload = img.onerror = loadNext;
      img.src = framePath(i + 1);
      images[i] = img;
    }
    for (let c = 0; c < 6; c++) loadNext();
  };
  probe.onerror = () => { mode = "generative"; };
  probe.src = framePath(1);
})();

/* — canvas sizing — */
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  currentFrame = -1; // fuerza redibujar el fotograma tras el resize
  buildTargets();
}
window.addEventListener("resize", resize);

/* ─────────── backdrop cinematográfico (foto nítida o vídeo sutil) ───────────
   Capas de mejora progresiva bajo las partículas, con Ken Burns ligado al scroll:
   1. saveData/2g → nada: la escena generativa pura (cero descargas)
   2. foto nítida (~230KB) → aparece rápido, sirve de póster
   3. vídeo cinemagráfico en bucle (~0.5MB, sin reduced-motion) → la fiesta
      respira detrás de la guitarra quieta y nítida */
const backdrop = { el: null, ready: false, isVideo: false };
(function loadBackdrop() {
  const conn = navigator.connection;
  if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ""))) return;
  const portrait = window.innerHeight > window.innerWidth;
  const img = new Image();
  img.decoding = "async";
  img.onload = () => { if (!backdrop.isVideo) { backdrop.el = img; backdrop.ready = true; } };
  img.src = portrait ? "img/hero-portrait.jpg" : "img/hero-landscape.jpg";
  if (REDUCE_MOTION) return;
  const vid = document.createElement("video");
  vid.muted = true; vid.loop = true; vid.playsInline = true;
  vid.setAttribute("playsinline", "");
  vid.preload = "auto";
  vid.addEventListener("canplaythrough", () => {
    vid.play().then(() => { backdrop.el = vid; backdrop.isVideo = true; backdrop.ready = true; }).catch(() => {});
  }, { once: true });
  /* misma escena que la foto póster de cada orientación */
  vid.src = portrait ? "img/hero-loop-portrait.mp4" : "img/hero-loop-landscape.mp4";
})();

/* ─────────── generative scene: particles & bokeh ─────────── */
const N = 850;
const particles = [];
const bokeh = [];

function rnd(a, b) { return a + Math.random() * (b - a); }

for (let i = 0; i < N; i++) {
  particles.push({
    x: 0, y: 0,                      // current (eased) position
    nx: Math.random(), ny: Math.random(), // nebula seed (0..1)
    wx: i / N,                       // waveform x position (0..1)
    hT: (i / N) * Math.PI * 2,       // heart parameter
    burstA: rnd(0, Math.PI * 2),     // burst angle
    burstR: rnd(0.25, 1),            // burst radius factor
    sway: rnd(0, Math.PI * 2),       // petal sway phase
    size: rnd(0.8, 2.6),
    tw: rnd(0, Math.PI * 2),         // twinkle phase
    hue: Math.random()               // 0 = gold, 1 = rosa
  });
}
for (let i = 0; i < 16; i++) {
  bokeh.push({ x: Math.random(), y: Math.random(), r: rnd(30, 110), drift: rnd(0.2, 1), ph: rnd(0, Math.PI * 2), warm: Math.random() > 0.4 });
}

/* pseudo-waveform envelope (looks like a real song) */
const ENV = new Array(160).fill(0).map((_, i) => {
  const t = i / 159;
  return (0.35 + 0.65 * Math.abs(Math.sin(t * 21) * Math.sin(t * 6.3) * Math.sin(t * 2.1))) *
         (0.6 + 0.4 * Math.sin(t * Math.PI));
});

/* per-phase target positions (rebuilt on resize) */
let targets = { nebula: [], wave: [], heart: [] };
function buildTargets() {
  const cx = W / 2, cy = H / 2;
  targets.nebula = particles.map(p => ({
    x: cx + (p.nx - 0.5) * W * 1.05,
    y: cy + (p.ny - 0.5) * H * 0.9
  }));
  targets.wave = particles.map(p => {
    const env = ENV[Math.floor(p.wx * (ENV.length - 1))];
    const amp = H * 0.18 * env;
    return {
      x: W * 0.08 + p.wx * W * 0.84,
      y: cy + Math.sin(p.wx * 90 + p.tw) * amp
    };
  });
  const scale = Math.min(W, H) * 0.022;
  targets.heart = particles.map(p => {
    const t = p.hT;
    // classic parametric heart
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const jitter = (p.size - 1.7) * 2.2;
    return { x: cx + hx * scale + jitter, y: cy - hy * scale + jitter };
  });
}

function drawGenerative(p, time) {
  if (backdrop.ready) {
    /* fondo: foto o vídeo nítido con zoom lento ligado al scroll (Ken Burns) */
    const img = backdrop.el;
    const iw = img.naturalWidth || img.videoWidth, ih = img.naturalHeight || img.videoHeight;
    const zoom = 1.06 + p * 0.10;
    const ir = iw / ih, cr = W / H;
    let dw, dh;
    if (ir > cr) { dh = H * zoom; dw = dh * ir; }
    else { dw = W * zoom; dh = dw / ir; }
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2 - p * H * 0.05; // leve paneo ascendente
    ctx.fillStyle = "#120a14";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, dx, dy, dw, dh);
    /* scrim: la foto cede el escenario conforme la historia avanza
       (melodía → corazón → marca) sin perder el ambiente de velas */
    ctx.fillStyle = `rgba(18,10,20,${0.16 + 0.52 * band(p, 0.3, 0.85)})`;
    ctx.fillRect(0, 0, W, H);
  } else {
    /* sin foto (saveData/2g o aún cargando): noche de velas generativa */
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#160b1a");
    g.addColorStop(0.55, "#1d0e22");
    g.addColorStop(1, "#2a1024");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* drifting candle bokeh (la foto ya trae el suyo) */
    for (const b of bokeh) {
      const bx = ((b.x + time * 0.000012 * b.drift) % 1.1) * W;
      const by = (b.y + Math.sin(time * 0.0004 * b.drift + b.ph) * 0.02) * H;
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.001 * b.drift + b.ph);
      const rg = ctx.createRadialGradient(bx, by, 0, bx, by, b.r);
      const col = b.warm ? "217,166,81" : "232,93,138";
      rg.addColorStop(0, `rgba(${col},${0.05 + 0.05 * pulse})`);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(bx - b.r, by - b.r, b.r * 2, b.r * 2);
    }
  }

  /* phase weights along scroll */
  const wWave  = band(p, 0.18, 0.34) * (1 - band(p, 0.50, 0.62));
  const wHeart = band(p, 0.50, 0.62) * (1 - band(p, 0.80, 0.90));
  const wBurst = band(p, 0.80, 0.92);

  const cx = W / 2, cy = H / 2;

  /* corazón trazado en luz: se dibuja bajo las partículas para que
     el contorno se lea nítido mientras ellas se acomodan */
  if (wHeart > 0.05) {
    const scale = Math.min(W, H) * 0.022;
    ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
      const t = (i / 72) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const x = cx + hx * scale, y = cy - hy * scale;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    const pulse = 0.75 + 0.25 * Math.sin(time * 0.0016); // latido lento
    ctx.strokeStyle = `rgba(240,205,138,${0.10 * wHeart * pulse})`;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = `rgba(248,237,218,${0.30 * wHeart * pulse})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  /* waveform: halo suave + trazo dorado + armónico rosa (tres pasadas) */
  if (wWave > 0.03) {
    const trace = (ampMul, color, alpha, lw, phase) => {
      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const env = ENV[Math.floor(t * (ENV.length - 1))];
        const x = W * 0.08 + t * W * 0.84;
        const y = cy + Math.sin(t * 90 + phase) * H * 0.18 * env * ampMul * (0.85 + 0.15 * Math.sin(time * 0.003 + t * 12));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${color},${alpha * wWave})`;
      ctx.lineWidth = lw;
      ctx.stroke();
    };
    trace(1, "240,205,138", 0.10, 5, 0);      // halo cálido
    trace(1, "240,205,138", 0.40, 1.4, 0);    // melodía principal
    trace(0.55, "232,93,138", 0.18, 1, 2.1);  // armónico rosa
  }

  /* particles */
  for (let i = 0; i < N; i++) {
    const pt = particles[i];
    const neb = targets.nebula[i], wav = targets.wave[i], hea = targets.heart[i];

    /* blend target across phases */
    let tx = neb.x, ty = neb.y;
    tx = lerp(tx, wav.x, wWave); ty = lerp(ty, wav.y, wWave);
    tx = lerp(tx, hea.x, wHeart); ty = lerp(ty, hea.y, wHeart);
    if (wBurst > 0) {
      const fall = wBurst * wBurst;
      const bx2 = cx + Math.cos(pt.burstA) * pt.burstR * W * 0.55 * wBurst
                + Math.sin(time * 0.0012 + pt.sway) * 30 * wBurst;
      const by2 = cy + Math.sin(pt.burstA) * pt.burstR * H * 0.4 * wBurst + fall * H * 0.25;
      tx = lerp(tx, bx2, wBurst); ty = lerp(ty, by2, wBurst);
    }

    /* ease toward target — fluid in both scrub directions */
    pt.x += (tx - pt.x) * 0.085;
    pt.y += (ty - pt.y) * 0.085;

    const twinkle = 0.55 + 0.45 * Math.sin(time * 0.0022 + pt.tw);
    const alpha = (0.25 + 0.55 * twinkle) * (1 - wBurst * 0.45);
    const r = pt.size * (1 + wHeart * 0.4);

    if (pt.hue < 0.72) ctx.fillStyle = `rgba(232,193,112,${alpha})`;
    else if (pt.hue < 0.92) ctx.fillStyle = `rgba(232,93,138,${alpha * 0.9})`;
    else ctx.fillStyle = `rgba(248,237,218,${alpha})`;

    ctx.beginPath();
    if (wBurst > 0.15) {
      /* en el estallido final los puntos se vuelven pétalos que caen girando */
      const rot = pt.burstA + Math.sin(time * 0.001 + pt.sway) * 0.7;
      ctx.ellipse(pt.x, pt.y, r * (1 + 1.3 * wBurst), r * 0.85, rot, 0, 6.2832);
    } else {
      ctx.arc(pt.x, pt.y, r, 0, 6.2832);
    }
    ctx.fill();
  }

  /* heart glow */
  if (wHeart > 0.05) {
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.42);
    rg.addColorStop(0, `rgba(232,93,138,${0.10 * wHeart})`);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawFrame(index) {
  let img = images[index];
  if (!img || !img.complete || !img.naturalWidth) {
    /* mientras cargan, usa el fotograma listo más cercano */
    for (let d = 1; d < FRAME_COUNT; d++) {
      const a = images[index - d], b = images[index + d];
      if (a && a.complete && a.naturalWidth) { img = a; break; }
      if (b && b.complete && b.naturalWidth) { img = b; break; }
    }
  }
  if (!img || !img.complete || !img.naturalWidth) return;
  const ir = img.naturalWidth / img.naturalHeight, cr = W / H;
  let dw, dh, dx, dy;
  if (ir > cr) { dh = H; dw = H * ir; dx = (W - dw) / 2; dy = 0; }
  else { dw = W; dh = W / ir; dx = 0; dy = (H - dh) / 2; }
  ctx.fillStyle = "#120a14"; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, dx, dy, dw, dh);
}

/* película en bucle infinito: avanza y regresa en curva cosenoidal,
   sin cortes ni cambios bruscos de dirección (ping-pong suave) */
const FILM_SPEED = Math.PI / 8000; // 8s por dirección, ciclo completo 16s
const filmCycle = (t) => (1 - Math.cos(t * FILM_SPEED)) / 2;

/* ─────────────── scroll update for the hero ─────────────── */
function updateHero(time) {
  const rect = section.getBoundingClientRect();
  const scrollable = rect.height - window.innerHeight;
  progress = clamp(-rect.top / scrollable, 0, 1);
  const visible = rect.bottom > 0 && rect.top < window.innerHeight;

  if (visible) {
    if (mode === "frames") {
      const filmT = REDUCE_MOTION ? 0 : time; // película estática si el usuario prefiere menos movimiento
      const idx = Math.min(FRAME_COUNT - 1, Math.round(filmCycle(filmT) * (FRAME_COUNT - 1)));
      if (idx !== currentFrame) { currentFrame = idx; drawFrame(idx); }
      frameReadout.textContent = `FOTOGRAMA ${String(idx + 1).padStart(3, "0")} / ${FRAME_COUNT} · ∞`;
    } else {
      drawGenerative(progress, time);
      frameReadout.textContent = "ESCENA GENERATIVA · EN VIVO";
    }
  }

  progressFill.style.width = `${(progress * 100).toFixed(2)}%`;

  for (const el of lines) {
    const a = parseFloat(el.dataset.in), b = parseFloat(el.dataset.out);
    const mid = (a + b) / 2, half = (b - a) / 2;
    let o = 1 - Math.abs(progress - mid) / half;
    o = clamp(o * 1.4, 0, 1); // plateau so text holds longer
    el.style.opacity = o.toFixed(3);
    el.style.transform = `translate(-50%, calc(-50% + ${(1 - o) * 26}px))`;
    el.style.pointerEvents = o > 0.5 ? "auto" : "none";
  }
}

/* ═══════════════ film grain (generated once) ═══════════════ */
(function grain() {
  const g = document.createElement("canvas");
  g.width = 160; g.height = 160;
  const gc = g.getContext("2d");
  const d = gc.createImageData(160, 160);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = Math.random() * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  gc.putImageData(d, 0, 0);
  const el = document.getElementById("grain");
  el.style.backgroundImage = `url(${g.toDataURL()})`;
  if (REDUCE_MOTION) return; // grano estático
  let f = 0;
  setInterval(() => {
    f = (f + 1) % 3;
    el.style.backgroundPosition = `${f * 53}px ${f * 37}px`;
  }, 90);
})();

/* ═════════ CTA background: gentle gold particles ═════════ */
const ctaCanvas = document.getElementById("cta-canvas");
const ctaCtx = ctaCanvas.getContext("2d");
const ctaDots = new Array(70).fill(0).map(() => ({
  x: Math.random(), y: Math.random(), r: rnd(0.6, 2), v: rnd(0.02, 0.08), ph: rnd(0, 6.28)
}));
function drawCTA(time) {
  const r = ctaCanvas.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) return;
  if (ctaCanvas.width !== r.width * DPR) {
    ctaCanvas.width = r.width * DPR; ctaCanvas.height = r.height * DPR;
  }
  ctaCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const w = r.width, h = r.height;
  const g = ctaCtx.createRadialGradient(w / 2, h, 0, w / 2, h, h * 1.2);
  g.addColorStop(0, "#3a1430");
  g.addColorStop(1, "#160b1a");
  ctaCtx.fillStyle = g; ctaCtx.fillRect(0, 0, w, h);
  for (const d of ctaDots) {
    const y = ((d.y - time * 0.00001 * d.v * 60) % 1 + 1) % 1;
    const tw = 0.4 + 0.6 * Math.sin(time * 0.002 + d.ph);
    ctaCtx.fillStyle = `rgba(232,193,112,${0.35 * tw})`;
    ctaCtx.beginPath();
    ctaCtx.arc(d.x * w, y * h, d.r, 0, 6.2832);
    ctaCtx.fill();
  }
}

/* ═══════════ AUDIO: demo players (Karplus–Strong) ═══════════
   Real files win: if audio/<name>.mp3 exists it is used instead. */
let actx = null;
let analyser = null;
let activeSample = null;   // {card, stop()}
const players = [...document.querySelectorAll(".sample")];

/* Karplus–Strong plucked string into an AudioBuffer */
function pluckBuffer(freq, dur, bright) {
  const sr = actx.sampleRate;
  const n = Math.floor(sr * dur);
  const buf = actx.createBuffer(1, n, sr);
  const out = buf.getChannelData(0);
  const period = Math.floor(sr / freq);
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const j = i % period;
    const cur = ring[j];
    ring[j] = (cur + prev) * 0.5 * (0.994 + bright * 0.004);
    prev = cur;
    out[i] = cur * Math.exp(-i / (sr * dur * 0.9));
  }
  return buf;
}

const NOTE = (s) => 440 * Math.pow(2, (s - 9) / 12); // semitones from C4=0
/* demo "songs": [semitone, beat, duration] */
const DEMOS = {
  vals:   { bpm: 96,  notes: [ // D major waltz arpeggio, 3/4
    [2,0,1],[6,1,.9],[9,2,.9],[14,3,1.8],[9,4,.9],[6,5,.9],
    [4,6,1],[7,7,.9],[11,8,.9],[16,9,1.8],[11,10,.9],[7,11,.9],
    [2,12,1],[6,13,.9],[9,14,.9],[14,15,2.6],[18,16.5,2.2],[14,18,3]
  ]},
  cumbia: { bpm: 168, notes: [ // A minor cumbia riff
    [0,0,.5],[3,1,.5],[7,2,.5],[3,3,.5],[5,4,.5],[8,5,.5],[12,6,.9],[8,7,.5],
    [0,8,.5],[3,9,.5],[7,10,.5],[10,11,.5],[8,12,.9],[7,13,.5],[5,14,.9],[3,15,1.4]
  ]},
  balada: { bpm: 72,  notes: [ // G major ballad
    [7,0,1.6],[11,1,1.4],[14,2,2.2],[12,3.5,1],[11,4,1.6],[7,5,1.6],
    [9,6,1.4],[12,7,2.6],[11,8.5,1.2],[9,9.5,1.2],[7,10.5,3]
  ]}
};

function stopActive() {
  if (!activeSample) return;
  activeSample.stop();
  activeSample.card.classList.remove("playing");
  const svg = activeSample.card.querySelector(".play svg");
  svg.querySelector(".ico-play").style.display = "";
  svg.querySelector(".ico-pause").style.display = "none";
  activeSample = null;
}

function startVisualizer(card) {
  const viz = card.querySelector(".viz");
  const vctx = viz.getContext("2d");
  const data = new Uint8Array(analyser.frequencyBinCount);
  function frame() {
    if (!activeSample || activeSample.card !== card) {
      vctx.clearRect(0, 0, viz.width, viz.height);
      return;
    }
    analyser.getByteFrequencyData(data);
    vctx.clearRect(0, 0, viz.width, viz.height);
    const bars = 48, step = Math.floor(data.length / bars / 2);
    for (let i = 0; i < bars; i++) {
      const v = data[i * step] / 255;
      const h = Math.max(2, v * viz.height);
      vctx.fillStyle = i % 5 === 0 ? "rgba(232,93,138,0.9)" : "rgba(232,193,112,0.85)";
      vctx.fillRect(i * (viz.width / bars), (viz.height - h) / 2, viz.width / bars - 2, h);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function playDemo(card, name) {
  const demo = DEMOS[name];
  const master = actx.createGain();
  master.gain.value = 0.7;
  /* warm space: simple feedback-delay "room" */
  const delay = actx.createDelay(); delay.delayTime.value = 0.16;
  const fb = actx.createGain(); fb.gain.value = 0.26;
  const wet = actx.createGain(); wet.gain.value = 0.22;
  delay.connect(fb); fb.connect(delay);
  master.connect(analyser); master.connect(delay); delay.connect(wet);
  wet.connect(analyser);
  analyser.connect(actx.destination);

  const beat = 60 / demo.bpm;
  const t0 = actx.currentTime + 0.08;
  const sources = [];
  let lastEnd = 0;
  for (const [semi, b, d] of demo.notes) {
    const src = actx.createBufferSource();
    src.buffer = pluckBuffer(NOTE(semi), Math.max(d * beat, 0.4), name === "cumbia" ? 1 : 0.4);
    src.connect(master);
    src.start(t0 + b * beat);
    sources.push(src);
    lastEnd = Math.max(lastEnd, b * beat + Math.max(d * beat, 0.4));
  }
  const timer = setTimeout(() => { if (activeSample && activeSample.card === card) stopActive(); },
    (lastEnd + 0.8) * 1000);
  return {
    stop() {
      clearTimeout(timer);
      sources.forEach(s => { try { s.stop(); } catch (e) {} });
      master.disconnect();
    }
  };
}

function playFile(card, audioEl) {
  const srcNode = audioEl._node || actx.createMediaElementSource(audioEl);
  audioEl._node = srcNode;
  srcNode.connect(analyser);
  analyser.connect(actx.destination);
  audioEl.play(); // reanuda donde quedó; "ended" lo regresa a 0
  const onEnd = () => { if (activeSample && activeSample.card === card) stopActive(); };
  audioEl.addEventListener("ended", onEnd, { once: true });
  return { stop() { audioEl.pause(); audioEl.removeEventListener("ended", onEnd); } };
}

const fmtTime = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

players.forEach(card => {
  const name = card.dataset.demo;
  /* probe for a real file — loadedmetadata, no canplaythrough: el navegador
     aborta la descarga completa del probe y canplaythrough nunca dispara */
  const real = new Audio();
  real.preload = "metadata";
  let hasReal = false;
  real.addEventListener("loadedmetadata", () => {
    hasReal = true;
    const note = document.querySelector(".demo-note");
    if (note) note.hidden = true; // la nota solo aplica a los demos sintetizados
  }, { once: true });
  real.src = `audio/${name}.mp3`;

  /* barra de progreso + tiempo (solo canciones reales) */
  const seek = document.createElement("div");
  seek.className = "seek";
  seek.hidden = true;
  seek.innerHTML = `<div class="seek-bar"><div class="seek-fill"></div></div><span class="seek-time">0:00 / 0:00</span>`;
  card.querySelector(".sample-info").appendChild(seek);
  const seekBar = seek.querySelector(".seek-bar");
  const seekFill = seek.querySelector(".seek-fill");
  const seekTime = seek.querySelector(".seek-time");
  const updateSeek = () => {
    if (!real.duration) return;
    seekFill.style.width = `${(real.currentTime / real.duration) * 100}%`;
    seekTime.textContent = `${fmtTime(real.currentTime)} / ${fmtTime(real.duration)}`;
  };
  real.addEventListener("timeupdate", updateSeek);
  real.addEventListener("ended", () => { real.currentTime = 0; updateSeek(); });
  seekBar.addEventListener("click", (e) => {
    if (!real.duration) return;
    const r = seekBar.getBoundingClientRect();
    real.currentTime = clamp((e.clientX - r.left) / r.width, 0, 1) * real.duration;
    updateSeek();
  });

  card.querySelector(".play").addEventListener("click", () => {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = actx.createAnalyser();
      analyser.fftSize = 256;
    }
    if (actx.state === "suspended") actx.resume();

    const wasThis = activeSample && activeSample.card === card;
    stopActive();
    if (wasThis) return; // toggled off

    const useReal = hasReal || real.readyState >= 1;
    if (useReal) { seek.hidden = false; updateSeek(); }
    const handle = useReal ? playFile(card, real) : playDemo(card, name);
    activeSample = { card, stop: handle.stop };
    card.classList.add("playing");
    const svg = card.querySelector(".play svg");
    svg.querySelector(".ico-play").style.display = "none";
    svg.querySelector(".ico-pause").style.display = "";
    startVisualizer(card);
  });
});

/* ═══════════════ reveals, counters, nav, loop ═══════════════ */
function animateCount(el) {
  const target = parseFloat(el.dataset.count), suffix = el.dataset.suffix || "";
  const dur = 1400, t0 = performance.now();
  (function step(t) {
    const k = clamp((t - t0) / dur, 0, 1), eased = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(target * eased) + suffix;
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add("in");
    e.target.querySelectorAll?.(".stat-num").forEach(animateCount);
    if (e.target.classList.contains("stat-num")) animateCount(e.target);
    io.unobserve(e.target);
  }
}, { threshold: 0.2 });
document.querySelectorAll(".reveal, .stats").forEach(el => io.observe(el));

/* hide nav while inside the hero film, show after */
const nav = document.getElementById("nav");

const lenis = (!REDUCE_MOTION && typeof Lenis !== "undefined") ? new Lenis({ lerp: 0.085, smoothWheel: true }) : null;
window.__lenis = lenis;

/* anclas suaves via Lenis (saltar intro, nav, tarjetas) */
function goTo(hash) {
  const target = document.querySelector(hash);
  if (!target) return;
  if (lenis) lenis.scrollTo(target, { offset: -64, duration: 1.4 });
  else target.scrollIntoView({ behavior: REDUCE_MOTION ? "auto" : "smooth" });
}
document.querySelectorAll('a[href^="#"]').forEach(a => {
  const hash = a.getAttribute("href");
  if (hash.length < 2) return;
  a.addEventListener("click", (e) => {
    e.preventDefault();
    /* "#crear" abre el flujo guiado; el resto navega suave */
    if (hash === "#crear") { openFlow(a.closest(".tier")); return; }
    goTo(hash);
  });
});

/* ocasiones clicables → paquetes, con contexto personalizado */
const paqContext = document.getElementById("paquetes-context");
document.querySelectorAll(".occasion[data-context]").forEach(card => {
  const act = () => {
    if (paqContext) {
      paqContext.textContent = `— ${card.dataset.context} —`;
      paqContext.classList.add("show");
    }
    goTo("#paquetes");
  };
  card.addEventListener("click", act);
  card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } });
});

const skipFilm = document.getElementById("skip-film");
const ctaBar = document.getElementById("cta-bar");
const ctaFinal = document.getElementById("crear");

function raf(time) {
  if (lenis) lenis.raf(time);
  updateHero(REDUCE_MOTION && mode !== "frames" ? 0 : time);
  drawCTA(REDUCE_MOTION ? 0 : time);
  const hint = document.getElementById("scroll-hint");
  hint.style.opacity = window.scrollY > 80 ? "0" : "1";
  const inFilm = progress > 0.02 && progress < 0.97 && window.scrollY > 10;
  nav.classList.toggle("hidden", inFilm);
  if (ctaBar) {
    /* la barra aparece desde la mitad de la película (antes se escondía toda la intro)
       y se oculta cuando el CTA final ya está en pantalla */
    const inFirstHalfOfFilm = progress > 0.02 && progress < 0.5 && window.scrollY > 10;
    const finalVisible = ctaFinal && ctaFinal.getBoundingClientRect().top < window.innerHeight * 0.6;
    ctaBar.classList.toggle("hidden", inFirstHalfOfFilm || finalVisible);
  }
  if (skipFilm) skipFilm.classList.toggle("gone", progress > 0.9);
  requestAnimationFrame(raf);
}

resize();
requestAnimationFrame(raf);

/* ═══════════ FLUJO GUIADO "Crear mi canción" ═══════════
   Un paso por pantalla (estilo cash.app); termina abriendo
   WhatsApp con el resumen listo para enviar. */
const WA_NUMBER = "14072057707"; // número de WhatsApp del negocio (wa.me, solo dígitos con código de país)

const flowEl = document.getElementById("flow");
const flowBody = document.getElementById("flow-body");
const flowProgress = document.getElementById("flow-progress");
const flowBack = document.getElementById("flow-back");
const flowNext = document.getElementById("flow-next");

const flowState = { occasion: null, relation: null, name: "", genre: null, date: null, pkg: "Serenata · $89 USD", story: "" };
let flowStep = 0;
let urgentConfirmArmed = false; // doble confirmación cuando la fiesta es esta semana con entrega estándar

/* ── Pago: enlaces de Stripe + captura del pedido ──
   ORDER_ENDPOINT: URL /exec del Web App de Google Apps Script (ver orders-backend.gs).
   ⚠ PENDIENTE DE DESPLEGAR: mientras esté vacío, el flujo exige enviar el resumen
   por WhatsApp antes del pago, para que el encargo nunca se pierda. */
const ORDER_ENDPOINT = ""; // ← pegar la URL /exec del Web App al desplegarlo
const PREFILL_PROMO = "ESTRENO15"; // se autocompleta en el checkout; "" para desactivar

const PKGS = [
  { name: "Verso", price: "$39 USD", tag: "", urgente: false, pay: "https://buy.stripe.com/00wfZhfSwcktaR2730grS00",
    includes: "Canción corta · Letra de su historia · MP3 · Entrega estándar (7–10 días)" },
  { name: "Serenata", price: "$89 USD", tag: "La más pedida", urgente: false, pay: "https://buy.stripe.com/5kQ14n5dS98h1gsbjggrS01",
    includes: "Canción completa (2–3 min) · Producción de estudio · MP3 + WAV · 1 revisión · Entrega 7–10 días" },
  { name: "Gran Gala", price: "$199 USD", tag: "Urgente 72h", urgente: true, pay: "https://buy.stripe.com/aFafZh0XCfwFf7i0ECgrS02",
    includes: "Experiencia narrativa completa · Producción premium · MP3 + WAV + letra enmarcable · Revisiones múltiples · Entrega urgente 72h" }
];

const FLOW_STEPS = [
  { key: "occasion", kicker: "Paso 1 · La ocasión", title: "¿Qué celebramos?", auto: true,
    options: ["Quinceañera", "Boda", "Aniversario", "Día de las Madres", "Cumpleaños", "Tributo", "Mi negocio", "Otra ocasión"] },
  { key: "relation", kicker: "Paso 2 · La persona", title: "¿Para quién es la canción?", auto: false,
    options: ["Mi hija", "Mi hijo", "Mi pareja", "Mi mamá", "Mi papá", "Otro ser querido"] },
  { key: "genre", kicker: "Paso 3 · El sabor", title: "¿Qué género le encanta?", auto: true,
    options: ["Vals", "Balada", "Cumbia", "Bachata", "Corrido", "Banda", "Mariachi", "Bolero", "Pop", "Ustedes elijan"] },
  { key: "date", kicker: "Paso 4 · La fecha", title: "¿Cuándo es la fiesta?", auto: true,
    options: ["Esta semana", "Este mes", "Tengo más tiempo"] },
  { key: "final", kicker: "Paso 5 · Su historia", title: "Revise y cuéntenos lo esencial" }
];

const isUrgentDate = () => flowState.date === "Esta semana";
const selectedPkg = () => PKGS.find(p => flowState.pkg.startsWith(p.name));

function chipGrid(options, selected, onPick) {
  const grid = document.createElement("div");
  grid.className = "flow-chips";
  for (const opt of options) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (selected === opt ? " sel" : "");
    b.textContent = opt;
    b.addEventListener("click", () => {
      grid.querySelectorAll(".chip").forEach(c => c.classList.remove("sel"));
      b.classList.add("sel");
      onPick(opt);
    });
    grid.appendChild(b);
  }
  return grid;
}

function renderRecap() {
  /* recapitulación de todas las respuestas al abrir el paso de pago (nunca se paga a ciegas) */
  const recap = document.createElement("div");
  recap.className = "flow-recap";
  const who = `${flowState.relation || "—"}${flowState.name.trim() ? " — " + flowState.name.trim() : ""}`;
  recap.innerHTML =
    `<strong>${flowState.occasion || "—"}</strong> · para <strong>${who}</strong> · ` +
    `<strong>${flowState.genre || "—"}</strong> · fiesta: <strong>${flowState.date || "—"}</strong><br>`;
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "recap-edit";
  edit.textContent = "Editar mis respuestas";
  edit.addEventListener("click", () => { flowStep = 0; renderFlowStep(); });
  recap.appendChild(edit);
  return recap;
}

function renderUrgentWarning() {
  const warn = document.createElement("div");
  warn.className = "flow-urgent";
  warn.innerHTML =
    `<strong>Su fiesta es esta semana.</strong> La entrega estándar tarda 7–10 días y no llegaría a tiempo. ` +
    `Le recomendamos <strong>Gran Gala (entrega 72h)</strong> o escribirnos por WhatsApp para confirmar fechas.`;
  const swap = document.createElement("button");
  swap.type = "button";
  swap.className = "btn btn-gold";
  swap.style.cssText = "margin-top:12px;width:100%;text-align:center;";
  swap.textContent = "Cambiar a Gran Gala (72h)";
  swap.addEventListener("click", () => {
    const gg = PKGS.find(p => p.urgente);
    flowState.pkg = `${gg.name} · ${gg.price}`;
    urgentConfirmArmed = false;
    renderFlowStep();
  });
  warn.appendChild(swap);
  return warn;
}

function renderFlowStep() {
  const step = FLOW_STEPS[flowStep];
  flowBody.innerHTML = "";
  flowBody.scrollTop = 0;
  urgentConfirmArmed = false;

  const kicker = document.createElement("p");
  kicker.className = "flow-kicker";
  kicker.textContent = step.kicker;
  const title = document.createElement("h3");
  title.className = "flow-title";
  title.textContent = step.title;
  flowBody.append(kicker, title);

  if (step.key === "occasion" || step.key === "genre" || step.key === "date") {
    flowBody.appendChild(chipGrid(step.options, flowState[step.key], (opt) => {
      flowState[step.key] = opt;
      refreshFlowNav();
      if (step.auto) setTimeout(() => { if (FLOW_STEPS[flowStep] === step) nextFlowStep(); }, 240);
    }));
  } else if (step.key === "relation") {
    const input = document.createElement("input");
    input.className = "flow-input";
    input.type = "text";
    input.maxLength = 60;
    input.placeholder = "El nombre de esa persona (opcional)";
    input.value = flowState.name;
    input.addEventListener("input", () => { flowState.name = input.value; });
    flowBody.appendChild(input);
    flowBody.appendChild(chipGrid(step.options, flowState.relation, (opt) => {
      flowState.relation = opt;
      refreshFlowNav();
    }));
  } else {
    /* paso final: recap + aviso de urgencia + paquete (con contenido) + historia */
    flowBody.appendChild(renderRecap());
    if (isUrgentDate() && !selectedPkg()?.urgente) flowBody.appendChild(renderUrgentWarning());

    const lbl1 = document.createElement("p");
    lbl1.className = "flow-label";
    lbl1.textContent = "Elija su paquete";
    flowBody.appendChild(lbl1);
    for (const p of PKGS) {
      const val = `${p.name} · ${p.price}`;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip pkg-row" + (flowState.pkg === val ? " sel" : "");
      b.innerHTML = `<span><span class="pkg-name">${p.name}</span>${p.tag ? ` <span class="pkg-tag">${p.tag}</span>` : ""}</span><span class="pkg-price">${p.price}</span>`;
      b.addEventListener("click", () => {
        flowState.pkg = val;
        renderFlowStep(); // re-dibuja: contenido bajo el paquete elegido + aviso de urgencia
      });
      flowBody.appendChild(b);
      if (flowState.pkg === val) {
        /* el contenido del paquete, visible en el momento de decidir */
        const inc = document.createElement("p");
        inc.className = "pkg-includes";
        inc.textContent = p.includes;
        flowBody.appendChild(inc);
      }
    }
    const lbl2 = document.createElement("p");
    lbl2.className = "flow-label";
    lbl2.textContent = "Su historia";
    const ta = document.createElement("textarea");
    ta.className = "flow-textarea";
    ta.maxLength = 600;
    ta.placeholder = "Un recuerdo, una anécdota, lo que quiere que diga la canción… (opcional)";
    ta.value = flowState.story;
    ta.addEventListener("input", () => { flowState.story = ta.value; });
    const note = document.createElement("p");
    note.className = "flow-note";
    note.textContent = "Pago seguro con Stripe — tarjeta, Apple Pay o Google Pay. Su historia se guarda con su pedido.";
    flowBody.append(lbl2, ta, note);
  }

  flowProgress.style.transform = `scaleX(${(flowStep + 1) / FLOW_STEPS.length})`;
  flowBack.classList.toggle("hide", flowStep === 0);
  flowNext.textContent = flowStep === FLOW_STEPS.length - 1 ? "Continuar al pago" : "Siguiente →";
  refreshFlowNav();
}

function refreshFlowNav() {
  const step = FLOW_STEPS[flowStep];
  const ready = step.key === "final" || !!flowState[step.key];
  flowNext.classList.toggle("off", !ready);
}

function buildWaUrl(orderId) {
  const lines = ["¡Hola! Quiero crear una canción personalizada 🎶"];
  if (flowState.occasion) lines.push(`• Ocasión: ${flowState.occasion}`);
  if (flowState.relation) lines.push(`• Para: ${flowState.relation}${flowState.name.trim() ? " — " + flowState.name.trim() : ""}`);
  if (flowState.genre) lines.push(`• Género: ${flowState.genre}`);
  if (flowState.date) lines.push(`• La fiesta es: ${flowState.date}`);
  lines.push(`• Paquete: ${flowState.pkg}`);
  if (flowState.story.trim()) lines.push(`• Nuestra historia: ${flowState.story.trim()}`);
  if (orderId) lines.push(`• Pedido: ${orderId}`);
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function newOrderId() {
  return "ES-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function goToStripe(pkg, orderId) {
  const url = new URL(pkg.pay);
  url.searchParams.set("client_reference_id", orderId);
  url.searchParams.set("locale", "es");
  if (PREFILL_PROMO) url.searchParams.set("prefilled_promo_code", PREFILL_PROMO);
  window.location.href = url.toString();
}

/* Registro del encargo. Devuelve true solo si el POST salió sin error de red.
   (Apps Script + no-cors: la respuesta es opaca; un rechazo o timeout = fallo.) */
async function registerOrder(payload) {
  if (!ORDER_ENDPOINT) return false;
  try {
    const result = await Promise.race([
      /* text/plain evita el preflight CORS que Apps Script no responde */
      fetch(ORDER_ENDPOINT, {
        method: "POST", mode: "no-cors", keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      }).then(() => "ok"),
      new Promise(res => setTimeout(() => res("timeout"), 6000))
    ]);
    return result === "ok";
  } catch (_) { return false; }
}

/* Fallo (o ausencia) del registro remoto: NO se sigue en silencio al pago.
   WhatsApp se vuelve el camino obligatorio para que el encargo llegue al estudio. */
function showOrderFallback(pkg, orderId) {
  flowBody.querySelector(".flow-order-fallback")?.remove();
  const box = document.createElement("div");
  box.className = "flow-order-fallback";
  box.innerHTML =
    `<strong>Un paso importante:</strong> para que su canción quede encargada, ` +
    `envíenos primero su resumen por WhatsApp — un toque y el mensaje ya va escrito. Después le llevamos al pago.`;
  const waBtn = document.createElement("a");
  waBtn.className = "btn btn-gold";
  waBtn.href = buildWaUrl(orderId);
  waBtn.target = "_blank";
  waBtn.rel = "noopener";
  waBtn.textContent = "Enviar mi resumen por WhatsApp";
  const payBtn = document.createElement("button");
  payBtn.type = "button";
  payBtn.className = "btn btn-line";
  payBtn.style.cssText = "margin-top:10px;width:100%;text-align:center;opacity:0.45;pointer-events:none;";
  payBtn.textContent = "Ya lo envié — continuar al pago";
  waBtn.addEventListener("click", () => {
    /* al abrir WhatsApp se desbloquea el pago */
    payBtn.style.opacity = "1";
    payBtn.style.pointerEvents = "auto";
  });
  payBtn.addEventListener("click", () => goToStripe(pkg, orderId));
  box.append(waBtn, payBtn);
  flowBody.appendChild(box);
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  flowNext.textContent = "Continuar al pago";
  refreshFlowNav();
}

async function submitOrderAndPay() {
  const pkg = selectedPkg();
  if (!pkg) return;

  /* fiesta esta semana + entrega estándar: aviso claro y doble confirmación */
  if (isUrgentDate() && !pkg.urgente && !urgentConfirmArmed) {
    urgentConfirmArmed = true;
    if (!flowBody.querySelector(".flow-urgent")) flowBody.prepend(renderUrgentWarning());
    flowBody.querySelector(".flow-urgent")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    flowNext.textContent = "Entiendo, pagar entrega 7–10 días";
    return;
  }

  const orderId = newOrderId();
  const payload = {
    orderId,
    ocasion: flowState.occasion,
    para: flowState.relation,
    nombre: flowState.name.trim(),
    genero: flowState.genre,
    fechaEvento: flowState.date,
    paquete: flowState.pkg,
    historia: flowState.story.trim(),
    pagina: location.href,
    fecha: new Date().toISOString()
  };
  /* respaldo local por si el registro remoto falla */
  try { localStorage.setItem("es-ultimo-pedido", JSON.stringify(payload)); } catch (_) {}

  flowNext.classList.add("off");
  flowNext.textContent = "Un momento…";

  const registered = await registerOrder(payload);
  if (!registered) {
    flowNext.classList.remove("off");
    showOrderFallback(pkg, orderId);
    return;
  }
  goToStripe(pkg, orderId);
}

function nextFlowStep() {
  if (flowStep === FLOW_STEPS.length - 1) {
    submitOrderAndPay();
    return;
  }
  flowStep++;
  renderFlowStep();
}

function openFlow(tierEl) {
  /* si vino de una tarjeta de paquete, preselecciona ese paquete */
  if (tierEl) {
    const name = tierEl.querySelector("h3")?.textContent?.trim();
    const p = PKGS.find(x => x.name === name);
    if (p) flowState.pkg = `${p.name} · ${p.price}`;
  }
  flowEl.hidden = false;
  document.body.style.overflow = "hidden";
  if (lenis) lenis.stop();
  /* al reabrir siempre se aterriza en el recap (paso final = recap arriba),
     nunca a un toque ciego del pago: renderFlowStep resetea la confirmación
     de urgencia y limpia cualquier estado de envío anterior */
  renderFlowStep();
  document.getElementById("flow-close").focus();
}

function closeFlow() {
  flowEl.hidden = true;
  document.body.style.overflow = "";
  if (lenis) lenis.start();
}

flowNext.addEventListener("click", nextFlowStep);
flowBack.addEventListener("click", () => { if (flowStep > 0) { flowStep--; renderFlowStep(); } });
/* escape fijo a WhatsApp: siempre visible junto a la navegación del flujo */
document.getElementById("flow-wa-link")?.addEventListener("click", (e) => {
  e.preventDefault();
  window.open(buildWaUrl(), "_blank", "noopener");
});
document.getElementById("flow-close").addEventListener("click", closeFlow);
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !flowEl.hidden) closeFlow(); });
