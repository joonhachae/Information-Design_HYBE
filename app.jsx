// Orbital label/artist visualization.
// - SVG render of orbit rings + central label text.
// - Artist dots update their position every frame via direct DOM transform,
//   bypassing React renders so 60fps stays cheap.
// - Labels are DRAGGABLE — drag-vs-click is decided by movement threshold;
//   small movement still triggers focus mode, larger movement repositions.
// - Position overrides persist via the EDITMODE block (Tweaks).

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// Canvas dimensions. Desktop is landscape 1920×1080; phones rotate the whole
// map 90° into a portrait 1080×1920 frame (same orbits, vertical arrangement).
const VW_L = 1920, VH_L = 1080;
const VW_P = 1080, VH_P = 1920;
const DRAG_THRESHOLD = 4; // px of SVG movement before it becomes a drag

// Portrait constellation = the landscape map rotated 90°. Each label keeps its
// orbit (rings + artists + radii) untouched; only its CENTER is transposed
// (desktop cx↔cy) so the arrangement reads top-to-bottom instead of
// left-to-right. Because it is a rigid rotation of a non-overlapping layout,
// nothing newly collides in the narrow frame.
const PORTRAIT_POS = {
  belift: { cx: 288, cy: 379 },
  ador:   { cx: 828, cy: 313 },
  pledis: { cx: 822, cy: 769 },
  jconic: { cx: 359, cy: 823 },
  yx:     { cx: 188, cy: 1000 },
  abd:    { cx: 586, cy: 1098 },
  source: { cx: 897, cy: 1248 },
  bighit: { cx: 342, cy: 1518 },
  koz:    { cx: 882, cy: 1643 }
};

// Order in which labels are revealed after the welcome overlay finishes.
// Based on order of joining HYBE (founding date for newer in-house labels).
// bighit → yx → belift → source → pledis → koz → ador → jconic → abd.
const REVEAL_ORDER = {
  bighit: 0,
  yx: 1,
  belift: 2,
  source: 3,
  pledis: 4,
  koz: 5,
  ador: 6,
  jconic: 7,
  abd: 8
};
const REVEAL_STAGGER = 0.42; // seconds between each label appearing

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#F5FF00",
  "speed": 1,
  "showStars": true,
  "showRings": true,
  "mode": "dynamic",
  "glow": 0.55,
  "grain": 0.15,
  "ringStroke": 1.5,
  "demo": false,
  "positions": {
    "belift": { "cx": 359, "cy": 288 },
    "jconic": { "cx": 844, "cy": 377 },
    "bighit": { "cx": 1525, "cy": 315 },
    "yx": { "cx": 977, "cy": 170 },
    "ador": { "cx": 228, "cy": 737 },
    "pledis": { "cx": 681, "cy": 853 },
    "source": { "cx": 1237, "cy": 916 },
    "koz": { "cx": 1653, "cy": 841 },
    "abd": { "cx": 1095, "cy": 607 }
  },
  "portraitPositions": {
    "belift": { "cx": 288, "cy": 379 },
    "ador": { "cx": 828, "cy": 313 },
    "pledis": { "cx": 822, "cy": 769 },
    "jconic": { "cx": 359, "cy": 823 },
    "yx": { "cx": 188, "cy": 1000 },
    "abd": { "cx": 586, "cy": 1098 },
    "source": { "cx": 897, "cy": 1248 },
    "bighit": { "cx": 342, "cy": 1518 },
    "koz": { "cx": 882, "cy": 1643 }
  }
} /*EDITMODE-END*/;

// ── helpers ─────────────────────────────────────────────────────────────────
const polar = (cx, cy, r, deg) => {
  const rad = (deg - 90) * Math.PI / 180; // 0deg = top, clockwise
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};

// Flatten artists. cx/cy are NOT baked in — rAF reads live positions from a
// ref so dragging a label re-centers its artist orbits immediately.
function flattenArtists(labels) {
  const out = [];
  for (const lbl of labels) {
    for (const ring of lbl.rings) {
      for (const a of ring.artists) {
        out.push({
          ...a,
          labelId: lbl.id,
          labelName: lbl.name,
          ringR: ring.r,
          speed: ring.speed
        });
      }
    }
  }
  return out;
}

// ── starfield background ────────────────────────────────────────────────────
function Stars({ show, w = VW_L, h = VH_L }) {
  const stars = useMemo(() =>
  Array.from({ length: 90 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.1 + 0.2,
    o: Math.random() * 0.4 + 0.05
  })),
  [w, h]);
  if (!show) return null;
  return (
    <g className="stars">
      {stars.map((s, i) =>
      <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
      )}
    </g>);

}

// ── member profile images ────────────────────────────────────────────────
// Maps each roster member (by display name) to a profile photo in members/.
// Members without a photo are simply omitted — the hover preview no-ops.
// Images load lazily, per-group, only while a popup is open (see preload
// effect) so the page never pulls all ~60 photos at once.
const MEMBER_IMG = {
  // BTS
  "Jin": "members/jin.webp", "SUGA": "members/suga.webp", "j-hope": "members/j-hope.webp",
  "RM": "members/rm.webp", "Jimin": "members/jimin.webp", "V": "members/v.webp",
  "Jungkook": "members/jungkook.webp",
  // SEVENTEEN
  "S.Coups": "members/scoups.webp", "Jeonghan": "members/jeonghan.webp", "Joshua": "members/joshua.webp",
  "Jun": "members/jun.webp", "Hoshi": "members/hoshi.webp", "Wonwoo": "members/wonwoo.webp",
  "Woozi": "members/woozi.webp", "DK": "members/dk.jpg", "Mingyu": "members/mingyu.webp",
  "The8": "members/the8.webp", "Seungkwan": "members/seungkwan.webp", "Vernon": "members/vernon.webp",
  "Dino": "members/dino.webp",
  // TOMORROW X TOGETHER
  "Yeonjun": "members/yeonjun.webp", "Soobin": "members/soobin.webp", "Beomgyu": "members/beomgyu.webp",
  "Taehyun": "members/taehyun.webp", "Huening Kai": "members/hueningkai.webp",
  // LE SSERAFIM
  "Sakura": "members/sakura.webp", "Kim Chaewon": "members/kimchaewon.webp",
  "Huh Yunjin": "members/huhyunjin.webp", "Kazuha": "members/kazuha.webp",
  "Hong Eunchae": "members/hongeunchae.webp",
  // NewJeans
  "Minji": "members/minji.webp", "Hanni": "members/hanni.webp", "Danielle": "members/danielle.webp",
  "Haerin": "members/haerin.webp", "Hyein": "members/hyein.webp",
  // ENHYPEN (Heeseung withdrew)
  "Jay": "members/jay.webp", "Jake": "members/jake.webp", "Sunghoon": "members/sunghoon.webp",
  "Sunoo": "members/sunoo.webp", "Jungwon": "members/jungwon.webp", "Ni-ki": "members/niki.webp",
  // &TEAM
  "K": "members/k.webp", "Fuma": "members/fuma.webp", "EJ": "members/ej.webp",
  "Nicholas": "members/nicholas.webp", "Yuma": "members/yuma.webp", "Jo": "members/jo.webp",
  "Harua": "members/harua.webp", "Taki": "members/taki.webp", "Maki": "members/maki.webp",
  // BOYNEXTDOOR
  "Sungho": "members/sungho.webp", "Riwoo": "members/riwoo.webp", "Jaehyun": "members/jaehyun.webp",
  "Taesan": "members/taesan.webp", "Leehan": "members/leehan.webp", "Woonhak": "members/woonhak.webp",
  // TWS
  "Shinyu": "members/shinyu.webp", "Dohoon": "members/dohoon.webp", "Youngjae": "members/youngjae.webp",
  "Hanjin": "members/hanjin.webp", "Jihoon": "members/jihoon.webp", "Kyungmin": "members/kyungmin.webp",
  // ILLIT
  "Yunah": "members/yunah.webp", "Minju": "members/minju.webp", "Moka": "members/moka.webp",
  "Wonhee": "members/wonhee.webp", "Iroha": "members/iroha.webp",
  // aoen
  "Yuju": "members/yuju.webp", "Ruka": "members/ruka.webp", "Gaku": "members/gaku.webp",
  "Sota": "members/sota.webp", "Kyosuke": "members/kyosuke.webp", "Reo": "members/reo.webp",
  "HIKARU": "members/hikaru.webp",
  // CORTIS
  "James": "members/james.webp", "Seonghyeon": "members/seonghyeon.webp", "Martin": "members/martin.webp",
  "Juhoon": "members/juhoon.webp", "Keonho": "members/keonho.webp"
};

// For the standalone/offline build, members*.js defines window.__MEMBER_DATA
// (relative path -> base64 data URI). When present, swap each path for its
// inlined data URI so portraits work from a single file with no server. In
// the normal (served) preview that global is absent, so relative paths stay.
if (typeof window !== "undefined" && window.__MEMBER_DATA) {
  for (const k in MEMBER_IMG) {
    const d = window.__MEMBER_DATA[MEMBER_IMG[k]];
    if (d) MEMBER_IMG[k] = d;
  }
}

// ── per-member portrait crop overrides ────────────────────────────────────
// Default crop is object-position:50% 30% (set in CSS). Some shots sit the
// face high or low in the frame; override the focal point here so the face
// stays framed. Value is any valid object-position string.
const MEMBER_IMG_POS = {
  // Side-profile full-body shot — face sits in the top quarter; pin to top.
  "Haerin": "50% 0%"
};

// ── main app ────────────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // Portrait / phone detection — at this breakpoint the app rotates the
  // constellation into a vertical arrangement (see PORTRAIT_POS). Everything
  // else (landing motion, focus-zoom, modals) is shared with desktop.
  const [portrait, setPortrait] = useState(() =>
    typeof window !== "undefined" && (
      new URLSearchParams(window.location.search).get("portrait") === "1" ||
      window.matchMedia("(max-width:760px)").matches));
  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get("portrait") === "1";
    const mq = window.matchMedia("(max-width:760px)");
    const on = () => setPortrait(forced || mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", on);
    else mq.addListener(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener("change", on); else mq.removeListener(on); };
  }, []);
  // Active canvas dimensions: landscape 1920×1080, portrait 1080×1920.
  const VW = portrait ? VW_P : VW_L;
  const VH = portrait ? VH_P : VH_L;
  const [hoverArtist, setHoverArtist] = useState(null);
  const [popupArtist, setPopupArtist] = useState(null);
  const [previewMember, setPreviewMember] = useState(null); // {name, year, img} in popup
  // Each artist popup plays the group's DEBUT single softly in the background.
  // Keyed by artist id. Year = debut-single release year.
  const ARTIST_TRACKS = {
    bts: { src: "audio/bts-no-more-dream.mp3", title: "No More Dream", year: 2013 },
    seventeen: { src: "audio/seventeen-adore-u.mp3", title: "Adore U", year: 2015 },
    txt: { src: "audio/txt-crown.mp3", title: "CROWN", year: 2019 },
    enhypen: { src: "audio/enhypen-given-taken.mp3", title: "Given-Taken", year: 2020 },
    lesserafim: { src: "audio/lesserafim-fearless.mp3", title: "FEARLESS", year: 2022 },
    newjeans: { src: "audio/newjeans-attention.mp3", title: "Attention", year: 2022 },
    andteam: { src: "audio/andteam-under-the-skin.mp3", title: "Under the Skin", year: 2022 },
    boynextdoor: { src: "audio/boynextdoor-one-and-only.mp3", title: "One and Only", year: 2023 },
    tws: { src: "audio/tws-plot-twist.mp3", title: "plot twist", year: 2024 },
    illit: { src: "audio/illit-magnetic.mp3", title: "Magnetic", year: 2024 },
    aoen: { src: "audio/aoen-blue-sun.mp3", title: "Blue Sun", year: 2024 },
    cortis: { src: "audio/cortis-what-you-want.mp3", title: "What You Want", year: 2025 }
  };
  // popup → softly autoplay its track in the background.
  const njAudioRef = useRef(null);
  const [hoverLabel, setHoverLabel] = useState(null);
  const [focusLabel, setFocusLabel] = useState(null);
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState("");
  const [draggingId, setDraggingId] = useState(null);
  const [copyToast, setCopyToast] = useState(false);
  const [entered, setEntered] = useState(false);
  const [entering, setEntering] = useState(false); // brief animation window after click
  const [orgHover, setOrgHover] = useState(false); // landing title hover → show org description
  // First-visit intro is SCROLL-DRIVEN across three beats:
  //   phase 0 → "Welcome to HYBE MUSIC GROUP APAC" + a scroll hint
  //   phase 1 → what HYBE MUSIC GROUP APAC is (org description)
  //   phase 2 → intro complete: orbits stagger in, the overlay fades away
  // One wheel/arrow gesture advances exactly one beat. Scrolling UP steps
  // back — and from the finished map an upward scroll re-opens the intro
  // (only at the overview, never while zoomed into a label).
  const [introPhase, setIntroPhase] = useState(() =>
    (typeof window !== "undefined" && window.location.hash === "#map") ? 2 : 0);
  const [labelsReady, setLabelsReady] = useState(false);
  const welcomed = introPhase >= 2; // map is "live" once the intro completes
  const introPhaseRef = useRef(0);
  introPhaseRef.current = introPhase;
  const focusRef = useRef(null);
  focusRef.current = focusLabel;

  // Drive the intro forward/back on scroll, arrows, or touch-swipe.
  // The lock lives in a ref (NOT effect-local state) and re-arms only after
  // input goes IDLE — so one continuous wheel gesture, momentum tail and all,
  // advances exactly one beat instead of skipping straight past the middle.
  useEffect(() => {
    let lock = false;
    let idleTimer = null;
    const clamp = (n) => Math.max(0, Math.min(2, n));
    const arm = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {lock = false;}, 600);
    };
    const step = (dir) => {
      if (!dir) return;
      if (!lock) {
        lock = true;
        setIntroPhase((p) => clamp(p + (dir > 0 ? 1 : -1)));
      }
      arm(); // push the unlock out until input stops
    };
    // Reverse is only allowed at the overview map (not while focused on a label).
    const canReverse = () => !focusRef.current;
    const onWheel = (e) => {
      if (introPhaseRef.current >= 2) {
        // On the finished map, only an UPWARD scroll re-opens the intro.
        if (e.deltaY < 0 && canReverse()) {e.preventDefault();step(-1);}
        return;
      }
      e.preventDefault();
      step(e.deltaY);
    };
    const onKey = (e) => {
      const down = e.code === "ArrowDown" || e.code === "PageDown";
      const up = e.code === "ArrowUp" || e.code === "PageUp";
      if (!down && !up) return;
      if (introPhaseRef.current >= 2) {
        // Map: Up arrow re-opens the intro (overview only); Down does nothing.
        if (up && canReverse()) {e.preventDefault();step(-1);}
        return;
      }
      e.preventDefault();
      step(down ? 1 : -1);
    };
    let touchY = null;
    const onTouchStart = (e) => {touchY = e.touches[0].clientY;};
    const onTouchMove = (e) => {
      if (touchY == null) return;
      const dy = touchY - e.touches[0].clientY;
      if (Math.abs(dy) <= 32) return;
      if (introPhaseRef.current >= 2) {
        // Map: swipe DOWN (dy<0) re-opens the intro (overview only).
        if (dy < 0 && canReverse()) {step(-1);touchY = null;}
        return;
      }
      step(dy);touchY = null;
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  // When the final beat is reached: stagger the orbits in, then drop the
  // overlay so the lime main home is revealed underneath.
  // Reveal the orbits when the intro completes; hide them again if the user
  // scrolls back up into the intro. The lime welcome overlay stays mounted at
  // all times — its opacity is driven purely by `welcomed` — so reversing
  // fades it smoothly back in over the map.
  useEffect(() => {
    if (introPhase < 2) {setLabelsReady(false);return;}
    const id = setTimeout(() => setLabelsReady(true), 80);
    return () => clearTimeout(id);
  }, [introPhase]);
  const orgTitleRef = useRef(null);
  const [orgTitleRight, setOrgTitleRight] = useState(VW / 2 + 360);
  // Measure the actual right edge of the title once the SVG mounts/paints so
  // the "i" affordance always sits just outside it, regardless of font load.
  useEffect(() => {
    const measure = () => {
      const el = orgTitleRef.current;
      if (!el) return;
      try {
        const bbox = el.getBBox();
        setOrgTitleRight(bbox.x + bbox.width);
      } catch (_) {}
    };
    measure();
    // re-measure after fonts settle
    if (document.fonts?.ready) document.fonts.ready.then(measure);
  }, []);
  const [edge, setEdge] = useState(false); // true if cursor is within edge zone
  const [edges, setEdges] = useState({ top: false, right: false, bottom: false, left: false });
  // Synthetic cursor for the attract/demo loop (exhibition auto-play).
  const [cursor, setCursor] = useState({ x: 0, y: 0, dur: 0, click: false });

  // Local mirror of position overrides — drag updates this every pointermove
  // (cheap, just a few labels); on pointerup we commit to tweaks.
  const [positions, setPositions] = useState(() => t.positions || {});
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  // Portrait has its own independent, user-draggable position store so the
  // mobile layout can be fine-tuned without touching the desktop positions.
  // Empty entries fall back to the PORTRAIT_POS defaults.
  const [portraitPositions, setPortraitPositions] = useState(() => t.portraitPositions || {});
  const portraitPosRef = useRef(portraitPositions);
  portraitPosRef.current = portraitPositions;
  const pPos = useCallback((lbl) =>
    portraitPositions[lbl.id] || PORTRAIT_POS[lbl.id] || { cx: lbl.cx, cy: lbl.cy },
  [portraitPositions]);

  const data = window.ORBITAL_DATA;
  const allArtists = useMemo(() => flattenArtists(data.labels), [data]);

  // Pre-baked grain texture (256×256 monochrome noise tile). Generated once
  // at mount and re-used as a tiled CSS background, so the grain overlay
  // costs ~nothing per frame.
  const noiseUrl = useMemo(() => {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255 | 0;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }, []);
  const allArtistsById = useMemo(
    () => Object.fromEntries(allArtists.map((a) => [a.id, a])), [allArtists]
  );
  const allLabelsById = useMemo(
    () => Object.fromEntries(data.labels.map((l) => [l.id, l])), [data]
  );

  // Effective position for a label (override or original).
  const getPos = useCallback((lbl) =>
  portrait
    ? pPos(lbl)
    : (positions[lbl.id] || { cx: lbl.cx, cy: lbl.cy }),
  [positions, portrait, pPos]);

  // Lookup ref for the rAF loop (closure-stable; mutated in effect).
  const labelPosRef = useRef({});
  useEffect(() => {
    const next = {};
    for (const lbl of data.labels) {
      next[lbl.id] = portrait
        ? pPos(lbl)
        : (positions[lbl.id] || { cx: lbl.cx, cy: lbl.cy });
    }
    labelPosRef.current = next;
  }, [positions, data.labels, portrait, pPos]);

  // ── rAF orbit loop ───────────────────────────────────────────────────────
  const artistRefs = useRef({});
  const timeRef = useRef(0);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  pausedRef.current = paused;
  speedRef.current = t.speed;

  useEffect(() => {
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      // When paused, skip the per-frame setAttribute churn — those writes
      // invalidate the SVG layer even when the values don't change, so they
      // still cost a paint. Just keep the loop alive and bail.
      if (pausedRef.current || document.hidden) {
        raf = requestAnimationFrame(tick);
        return;
      }
      timeRef.current += dt * speedRef.current;
      const time = timeRef.current;
      // While a label is focused (and thus while an artist card can be open),
      // every OTHER label's artists are dimmed to ~0.1. Freeze them: don't
      // write their transforms. Position is a pure function of time, so the
      // instant focus clears they snap straight to the correct current spot —
      // no drift, no jump. This drops per-frame transform writes from ~80 to a
      // handful, which is exactly what makes the orbit behind the card smooth.
      const fl = focusRef.current;
      for (const a of allArtists) {
        if (fl && a.labelId !== fl) continue;
        const el = artistRefs.current[a.id];
        if (!el) continue;
        const pos = labelPosRef.current[a.labelId];
        if (!pos) continue;
        const angle = a.angle + time * a.speed;
        const [x, y] = polar(pos.cx, pos.cy, a.ringR, angle);
        el.setAttribute("transform", `translate(${x} ${y})`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [allArtists]);

  // ── spacebar → toggle pause ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space') return;
      // don't hijack space when typing in the search input
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      e.preventDefault();
      setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── attract / demo loop (exhibition auto-play) ────────────────────────────
  // A synthetic cursor tours the map on a 20s loop: glide to a label → hover
  // (info card) → reveal the bottom chrome → click to focus/zoom → exit → and
  // around again. Enable with ?demo=1 in the URL (kiosk) or the Tweaks toggle.
  const urlDemo = useMemo(
    () => new URLSearchParams(window.location.search).get('demo') === '1', []);
  const demo = urlDemo || t.demo;
  useEffect(() => {
    if (!demo || !isDynamic) return;
    let timers = [];
    const W = () => window.innerWidth,H = () => window.innerHeight;
    const sp = (id) => {
      const l = allLabelsById[id];
      if (!l) return [W() / 2, H() / 2];
      const p = positionsRef.current[id] || { cx: l.cx, cy: l.cy };
      const [x, y] = screenOf(p.cx, p.cy);
      return [x, y];
    };
    // Live screen-center of an artist node (used to aim the cursor at NewJeans).
    const artistScreen = (id) => {
      const el = artistRefs.current[id];
      if (!el || !el.getBoundingClientRect) return [W() / 2, H() / 2];
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    // Live screen-center of the i-th member chip in the open popup.
    const memberChip = (i) => {
      const els = document.querySelectorAll('.am-members-grid > span');
      const el = els[i];
      if (!el) return [W() * 0.56, H() * 0.44 + i * 30];
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    const moveTo = (xy, dur) => setCursor({ x: xy[0], y: xy[1], dur, click: false });
    const click = () => {
      setCursor((c) => ({ ...c, click: true }));
      timers.push(setTimeout(() => setCursor((c) => ({ ...c, click: false })), 280));
    };
    const hoverLbl = (id) => {
      const l = allLabelsById[id];
      if (!l) return;
      const [x, y] = sp(id);
      setHoverLabel({ id, x, y });
    };
    const hoverMember = (name, year) =>
    setPreviewMember({ name, year, img: MEMBER_IMG[name] || null });

    // ── 20s narrated tour ─────────────────────────────────────────────────
    // Landing → scroll through the intro → open the ADOR page → open the
    // NewJeans popup and hover each member → return to the overview map.
    const NJ = [
    ["Minji", "2004"], ["Hanni", "2004"], ["Danielle", "2005"],
    ["Haerin", "2006"], ["Hyein", "2008"]];

    const DEMO_LOOP = 20000;
    const script = [
    // Beat 1 — landing + scroll-driven intro (0–3.4s)
    [0, () => {
      setFocusLabel(null);setHoverLabel(null);setPopupArtist(null);
      setPreviewMember(null);setEdge(false);setIntroPhase(0);
      setCursor({ x: W() / 2, y: H() * 0.8, dur: 0, click: false });
    }],
    [1000, () => moveTo([W() / 2, H() * 0.5], 700)], // drift up like a scroll
    [1300, () => setIntroPhase(1)], // org description
    [2200, () => moveTo([W() / 2, H() * 0.52], 600)],
    [2500, () => setIntroPhase(2)], // map opens (welcomed)

    // Beat 2 — glide to ADOR and zoom in (3.4–7.4s)
    [3900, () => moveTo(sp('ador'), 1400)],
    [5400, () => hoverLbl('ador')],
    [6400, () => click()],
    [6650, () => {setHoverLabel(null);setFocusLabel('ador');moveTo([W() / 2, H() * 0.5], 900);}],

    // Beat 3 — open the NewJeans popup, hover each member (7.4–16s)
    [7900, () => moveTo(artistScreen('newjeans'), 1000)],
    [9000, () => click()],
    [9250, () => setPopupArtist('newjeans')],
    ...NJ.map(([name, year], i) => [
    10300 + i * 1050,
    () => {moveTo(memberChip(i), 520);hoverMember(name, year);}]
    ),

    // Beat 4 — close popup and return to the overview map (16–20s)
    [15900, () => {setPreviewMember(null);setPopupArtist(null);moveTo([W() / 2, H() * 0.5], 700);}],
    [16800, () => {setFocusLabel(null);moveTo([W() / 2, H() * 0.46], 1100);}]];


    const schedule = () => {
      script.forEach(([at, fn]) => timers.push(setTimeout(fn, at)));
      timers.push(setTimeout(schedule, DEMO_LOOP));
    };
    schedule();
    return () => {
      timers.forEach(clearTimeout);
      setFocusLabel(null);setHoverLabel(null);setPopupArtist(null);
      setPreviewMember(null);setEdge(false);
    };
  }, [demo, isDynamic, allLabelsById, screenOf]);

  // ── mousemove → edge-zone tracking (any side) ─────────────────────────────
  useEffect(() => {
    const ZONE = 150;
    let raf = null;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const x = e.clientX,y = e.clientY;
        const w = window.innerWidth,h = window.innerHeight;
        const t = y < ZONE,r = x > w - ZONE,b = y > h - ZONE,l = x < ZONE;
        setEdge(t || r || b || l);
        setEdges((prev) =>
        prev.top === t && prev.right === r && prev.bottom === b && prev.left === l ?
        prev : { top: t, right: r, bottom: b, left: l });
      });
    };
    const onLeave = () => {setEdge(false);setEdges({ top: false, right: false, bottom: false, left: false });};
    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const q = query.trim().toLowerCase();
  const matchArtist = (a) => !q || a.name.toLowerCase().includes(q) || a.genre.toLowerCase().includes(q);
  const matchLabel = (l) => !q || l.name.toLowerCase().includes(q) || l.description.toLowerCase().includes(q) ||
  l.rings.some((r) => r.artists.some(matchArtist));

  // ── svg <-> screen coordinate helpers ────────────────────────────────────
  const svgRef = useRef(null);
  const screenOf = useCallback((svgX, svgY) => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const pt = svg.createSVGPoint();
    pt.x = svgX;pt.y = svgY;
    const r = pt.matrixTransform(svg.getScreenCTM());
    return [r.x, r.y];
  }, []);
  const svgPointFromClient = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }, []);

  // ── hover handlers ───────────────────────────────────────────────────────
  const onArtistEnter = (a) => () => {
    const el = artistRefs.current[a.id];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setHoverArtist({ id: a.id, x: rect.left + rect.width / 2, y: rect.top });
  };
  const onArtistLeave = () => setHoverArtist(null);
  // Close the artist popup whenever we leave the focus page.
  useEffect(() => {if (!focusLabel) setPopupArtist(null);}, [focusLabel]);
  // When a popup opens: preload just that group's member photos (so the first
  // hover is instant). The preview starts EMPTY — the user hovers a name to
  // reveal that member's portrait. Clearing on close drops the preview.
  useEffect(() => {
    if (!popupArtist) {setPreviewMember(null);return;}
    const a = allArtistsById[popupArtist];
    if (!a || !a.roster) {setPreviewMember(null);return;}
    const entries = a.roster.map((m) => {
      const mt = m.match(/^(.*?)\s*\((\d{4})\)\s*$/);
      const nm = mt ? mt[1] : m;
      return { name: nm, year: mt ? mt[2] : "", img: MEMBER_IMG[nm] || null };
    });
    // Preload (decode in background) — limited to this one group.
    entries.forEach((e) => {if (e.img) {const im = new Image();im.src = e.img;}});
    // No default selection — show the empty frame + "hover a name" hint until
    // the user hovers a member.
    setPreviewMember(null);
  }, [popupArtist, allArtistsById]);
  // popup → load + fade the matching track in softly; stop on close.
  // Audio is fetched lazily here (preload="none" on the element) so opening a
  // non-music popup or just viewing the map never touches the network.
  const fadeRef = useRef(null);
  useEffect(() => {
    const el = njAudioRef.current;
    if (!el) return;
    clearInterval(fadeRef.current);
    const track = ARTIST_TRACKS[popupArtist];
    if (track) {
      if (el.getAttribute("src") !== track.src) {
        el.setAttribute("src", track.src);
        el.load();
      }
      el.currentTime = 0;
      el.volume = 0;
      const p = el.play();
      if (p && p.catch) p.catch(() => {}); // ignore autoplay block
      // Ramp volume up so the decode/start hitch isn't audible.
      const target = 0.18;
      fadeRef.current = setInterval(() => {
        el.volume = Math.min(target, el.volume + target / 12);
        if (el.volume >= target) clearInterval(fadeRef.current);
      }, 40);
    } else {
      el.pause();
      try {el.currentTime = 0;} catch (e) {}
    }
    return () => clearInterval(fadeRef.current);
  }, [popupArtist]);
  // Click an artist while focused on a label → open a centered modal card.
  const onArtistClick = (a) => (e) => {
    if (!focusLabel) return; // only inside the focus page
    e.stopPropagation();
    setHoverArtist(null);
    setPopupArtist(a.id);
  };

  const onLabelEnter = (lbl) => () => {
    if (draggingId) return;
    const p = getPos(lbl);
    const [sx, sy] = screenOf(p.cx, p.cy);
    setHoverLabel({ id: lbl.id, x: sx, y: sy });
  };
  const onLabelLeave = () => setHoverLabel(null);

  // Keep a freshly-mounted hover card inside the viewport. The card is anchored
  // at the label/artist screen position and centered via CSS transform, so when
  // a label sits near a screen edge the card can spill off. After mount we
  // measure its real box and nudge left/top (transform untouched) so it always
  // stays fully visible with a small margin.
  const clampCard = useCallback((el) => {
    if (!el) return;
    requestAnimationFrame(() => {
      if (!el.isConnected) return;
      const m = 14;
      const r = el.getBoundingClientRect();
      let dx = 0,dy = 0;
      if (r.left < m) dx = m - r.left;else
      if (r.right > window.innerWidth - m) dx = window.innerWidth - m - r.right;
      if (r.top < m) dy = m - r.top;else
      if (r.bottom > window.innerHeight - m) dy = window.innerHeight - m - r.bottom;
      if (dx) el.style.left = parseFloat(el.style.left) + dx + "px";
      if (dy) el.style.top = parseFloat(el.style.top) + dy + "px";
    });
  }, []);

  // ── drag-or-click on label ───────────────────────────────────────────────
  const onLabelPointerDown = (lbl) => (e) => {
    e.stopPropagation();
    // Portrait / touch: drag to reposition (own persisted store), tap to focus.
    if (portrait) {
      if (!welcomed) return;
      e.preventDefault();
      // When zoomed into a label, a tap returns to the overview (no dragging).
      if (focusRef.current) { setFocusLabel(null); return; }
      setHoverLabel(null);
      const startPos = portraitPosRef.current[lbl.id] || PORTRAIT_POS[lbl.id] || { cx: lbl.cx, cy: lbl.cy };
      const startPt = svgPointFromClient(e.clientX, e.clientY);
      let isDrag = false;
      const TOUCH_THRESHOLD = 22; // larger than mouse — fingers jitter on tap
      const move = (ev) => {
        const cur = svgPointFromClient(ev.clientX, ev.clientY);
        const dx = cur.x - startPt.x, dy = cur.y - startPt.y;
        if (!isDrag && Math.hypot(dx, dy) > TOUCH_THRESHOLD) {
          isDrag = true; setDraggingId(lbl.id);
        }
        if (isDrag) {
          const nx = Math.max(80, Math.min(VW - 80, startPos.cx + dx));
          const ny = Math.max(80, Math.min(VH - 80, startPos.cy + dy));
          setPortraitPositions((prev) => ({ ...prev, [lbl.id]: { cx: Math.round(nx), cy: Math.round(ny) } }));
        }
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (isDrag) { setDraggingId(null); setTweak('portraitPositions', portraitPosRef.current); }
        else { setFocusLabel((prev) => prev === lbl.id ? null : lbl.id); }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      return;
    }
    e.preventDefault();
    const startPos = positionsRef.current[lbl.id] || { cx: lbl.cx, cy: lbl.cy };
    const startPt = svgPointFromClient(e.clientX, e.clientY);
    let isDrag = false;

    const move = (ev) => {
      const cur = svgPointFromClient(ev.clientX, ev.clientY);
      const dx = cur.x - startPt.x;
      const dy = cur.y - startPt.y;
      if (!isDrag && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        isDrag = true;
        setDraggingId(lbl.id);
        setHoverLabel(null);
      }
      if (isDrag) {
        const nx = Math.max(80, Math.min(VW - 80, startPos.cx + dx));
        const ny = Math.max(80, Math.min(VH - 80, startPos.cy + dy));
        setPositions((prev) => ({ ...prev, [lbl.id]: { cx: Math.round(nx), cy: Math.round(ny) } }));
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (isDrag) {
        setDraggingId(null);
        setTweak('positions', positionsRef.current);
      } else {
        // treat as click — toggle focus
        setFocusLabel((prev) => prev === lbl.id ? null : lbl.id);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // ── focus zoom transform ─────────────────────────────────────────────────
  const focusTransform = useMemo(() => {
    if (!focusLabel) return "translate(0 0) scale(1)";
    const lbl = allLabelsById[focusLabel];
    if (!lbl) return "translate(0 0) scale(1)";
    const p = getPos(lbl);
    const scale = 1.8;
    const tx = VW / 2 - p.cx * scale;
    const ty = VH / 2 - p.cy * scale;
    return `translate(${tx} ${ty}) scale(${scale})`;
  }, [focusLabel, allLabelsById, getPos, VW, VH]);

  // ── intro transform: shrink whole map into the HYBE container ───────────
  const introTransform = useMemo(() => {
    // bounding-center of all labels (live, respecting drag overrides)
    const xs = data.labels.map((l) => (portrait ? pPos(l).cx : positions[l.id]?.cx) ?? l.cx);
    const ys = data.labels.map((l) => (portrait ? pPos(l).cy : positions[l.id]?.cy) ?? l.cy);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const scale = 0.4;
    const tx = VW / 2 - cx * scale;
    const ty = VH / 2 - cy * scale;
    return `translate(${tx} ${ty}) scale(${scale})`;
  }, [data.labels, positions, portrait, VW, VH, pPos]);

  // Dynamic mode never uses the introTransform — the orbits always render at
  // full size; the focus transform handles both overview (identity) and zoom.
  const isDynamic = t.mode === "dynamic";
  const activeTransform = isDynamic ? focusTransform : !entered ? introTransform : focusTransform;

  // ── Tweaks: reset / copy ─────────────────────────────────────────────────
  const resetPositions = () => {
    if (portrait) {
      setPortraitPositions({});
      setTweak('portraitPositions', {});
      return;
    }
    setPositions({});
    setTweak('positions', {});
  };
  const copyPositions = () => {
    const out = {};
    for (const lbl of data.labels) {
      const p = positions[lbl.id] || { cx: lbl.cx, cy: lbl.cy };
      out[lbl.id] = p;
    }
    const text = JSON.stringify(out, null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 1600);
  };

  // ── render ───────────────────────────────────────────────────────────────
  // Dynamic mode (default) is a single live page:
  //   · main home = lime bg + full orbits + chrome top-left/right/bottom.
  //     There is NO centered "ENTER THE MAP" splash.
  //   · click any label → bg inverts to dark + zoom into that label.
  //   · click BACK → bg flips back to lime, zoom out.
  //   First-visit only, a brief "Welcome to HYBE MUSIC GROUP APAC" text
  //   fades in/out as an overlay before the main page reveals.
  //
  // Stylish / minimal keep the older flow: centered lime landing with an
  // ENTER button, then dark map with edge-hover chrome.
  const isLanding = isDynamic ? !focusLabel : !entered;
  const stageState = entering ?
  "entering" :
  isLanding ? "landing" : "entered";
  const showChrome = isDynamic ?
  true :
  entered && edge;
  // Title (header) stays visible always. The side clusters hide by default and
  // reveal together whenever the cursor nears ANY screen edge.
  // Mobile shows a clean map: no search, no bottom control bar. Speed runs at
  // the 1.0x default (controls are hidden, so it can't be changed there).
  const showSearch = isDynamic ? (portrait ? false : edge) : showChrome;
  const showControls = isDynamic ? (portrait ? false : edge) : showChrome;
  const showLegend = isDynamic ? edge : showChrome;
  // Ink colors flip with the bg: black on lime, white-ish on dark.
  const ringDim = isLanding ? "rgba(10,10,10,.45)" : "rgba(255,255,255,.35)";
  const ringDimDash = isLanding ? "rgba(10,10,10,.5)" : "rgba(255,255,255,.4)";
  const labelColor = isLanding ? "#0a0a0a" : t.accent;
  const artistFill = isLanding ? "#0a0a0a" : "#fff";
  const artistText = isLanding ? "#0a0a0a" : "#fff";
  // The label currently focused (for top-left info panel)
  const focusedLabel = focusLabel ? allLabelsById[focusLabel] : null;
  return (
    <div className={"stage" + (demo ? " demo" : "")} data-state={stageState} data-mode={t.mode}>
      <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      className={"orbit-svg" + (draggingId ? " dragging" : "") + (focusLabel ? " focused" : "") + (t.mode === "stylish" ? " stylish" : " minimal")} style={{ strokeWidth: "1.5px" }}>
        <defs>
          {/* Soft radial gradient — accent → transparent.
                                                 Richer stop curve so a single ellipse per label feels lush,
                                                 avoiding the paint cost of stacking 3 blended ellipses. */}
          <radialGradient id="blob-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={t.accent} stopOpacity="0.45" />
            <stop offset="25%" stopColor={t.accent} stopOpacity="0.28" />
            <stop offset="55%" stopColor={t.accent} stopOpacity="0.12" />
            <stop offset="80%" stopColor={t.accent} stopOpacity="0.035" />
            <stop offset="100%" stopColor={t.accent} stopOpacity="0" />
          </radialGradient>
        </defs>

        <Stars show={t.showStars} w={VW} h={VH} />

        {/* HYBE container ring + centered ENTER splash — used by stylish/
                                               minimal only. Dynamic mode goes straight to the main home. */}
        <g className="intro-frame"
        style={{
          opacity: isDynamic || entered ? 0 : 1,
          pointerEvents: "none"
        }}>
          <ellipse cx={VW / 2} cy={VH / 2} rx={580} ry={320}
          fill="none" stroke="#0a0a0a"
          strokeWidth={1} opacity={0.85} />
          <ellipse cx={VW / 2} cy={VH / 2} rx={600} ry={338}
          fill="none" stroke="#0a0a0a"
          strokeWidth={0.5} strokeDasharray="2 6"
          opacity={0.35} />
        </g>

        {/* SVG-based landing text — centered title + ENTER button.
                                               Stylish/minimal only; dynamic mode hides this entirely. */}
        <g className="landing-svg"
        style={{
          opacity: isDynamic || entered ? 0 : 1,
          pointerEvents: isDynamic || entered ? "none" : "auto"
        }}>
          <g onMouseEnter={() => setOrgHover(true)}
          onMouseLeave={() => setOrgHover(false)}
          style={{ cursor: "help" }}>
            {/* invisible hit rect so the cursor doesn't lose hover between glyphs */}
            <rect x={VW / 2 - 520} y={40} width={1040} height={70} fill="transparent" />
            <text ref={orgTitleRef} x={VW / 2} y={80} textAnchor="middle"
            className="ls-title" fill="#0a0a0a">
              {data.org}
            </text>
            {/* "i" affordance — placed at the measured right edge of the title
                                                   so it never overlaps long org names. */}
            <g transform={`translate(${orgTitleRight + 22} 56)`}>
              <circle r={11} fill="none" stroke="#0a0a0a" strokeWidth={1}
              opacity={orgHover ? 1 : 0.5}
              style={{ transition: "opacity .25s" }} />
              <text textAnchor="middle" dominantBaseline="central" y={1}
              style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600 }}
              fill="#0a0a0a">i</text>
            </g>
          </g>
          <text x={VW / 2} y={120} textAnchor="middle"
          className="ls-meta" fill="rgba(10,10,10,.6)">
            {data.labels.length} LABELS · {data.labels.reduce((n, l) => n + (l.acts || 0), 0)} GROUPS
          </text>

          {/* Org description tooltip lives OUTSIDE the SVG (as an HTML overlay
                                                 sibling, see render below) — foreignObject's HTML content doesn't
                                                 scale with the viewBox the same way the SVG geometry does, which
                                                 left the card visibly off-center. */}

          {/* CTA */}
          <g style={{ cursor: "pointer" }}
          onClick={() => {
            // Two-stage enter: trigger iris wipe + landing scale-down for
            // ~1.1s, then flip `entered` so the camera & chrome swap in.
            if (entering || entered) return;
            setEntering(true);
            setTimeout(() => {
              setEntered(true);
              setEntering(false);
            }, 1100);
          }}
          className="landing-cta">
            <rect x={VW / 2 - 140} y={960} width={280} height={50}
            rx={25} fill="transparent"
            stroke="#0a0a0a" strokeWidth={1} />
            <text x={VW / 2} y={991} textAnchor="middle"
            className="ls-cta" fill="#0a0a0a">
              ENTER THE MAP   ↗
            </text>
          </g>

          <text x={VW / 2} y={1050} textAnchor="middle"
          className="ls-hint" fill="rgba(10,10,10,.4)">
            CLICK ANY LABEL TO FOCUS · DRAG TO REPOSITION
          </text>
        </g>

        <g className="zoom-wrap"
        style={{
          transition: draggingId ?
          "none" :
          entering ?
          "transform 1100ms cubic-bezier(.5,0,.15,1.08)" :
          entered || isDynamic ?
          "transform .9s cubic-bezier(.6,0,.15,1)" :
          "transform 1.2s cubic-bezier(.6,0,.15,1)",
          pointerEvents: isDynamic || entered ? "auto" : "none"
        }}
        transform={activeTransform}>
          {/* Atmospheric gradient blob — stylish mode only, and only after
                                                 entering. ONE ellipse per label (was 3) and standard compositing
                                                 instead of `screen` blend — both cuts a meaningful slice of
                                                 per-frame paint cost. */}
          {(entered || isDynamic) && t.mode !== "minimal" && t.glow > 0 &&
          <g className="atmosphere"
          style={{ opacity: t.glow }}>
              {data.labels.map((lbl) => {
              const p = getPos(lbl);
              const outerR = lbl.comingSoon ?
              lbl.ringR + 30 :
              Math.max(...lbl.rings.map((r) => r.r)) + 30;
              const dim = !matchLabel(lbl) || focusLabel && focusLabel !== lbl.id;
              return (
                <ellipse key={lbl.id}
                cx={p.cx} cy={p.cy}
                rx={outerR * 1.55} ry={outerR * 1.4}
                fill="url(#blob-grad)"
                style={{ opacity: dim ? 0.08 : 1, transition: "opacity .4s" }} />);

            })}
            </g>
          }

          {data.labels.map((lbl) => {
            const p = getPos(lbl);
            const dim = !matchLabel(lbl) || focusLabel && focusLabel !== lbl.id;
            const isDragging = draggingId === lbl.id;
            const isHover = hoverLabel?.id === lbl.id;
            const revealDelay = (REVEAL_ORDER[lbl.id] ?? 0) * REVEAL_STAGGER;
            const revealed = labelsReady;
            // Stagger only on the initial reveal. Once a label is focused,
            // every other label should dim together at once (no per-label
            // delay), so the focus feels like one smooth dip — not a sequence.
            const dimDelay = focusLabel ? 0 : revealDelay;
            const baseOpacity = dim ? 0.12 : 1;
            return (
              <g key={lbl.id}
              className={"label-group" + (dim ? " dim" : "") + (isDragging ? " dragging" : "")}
              style={{
                opacity: revealed ? baseOpacity : 0,
                transform: revealed ? "scale(1)" : "scale(.94)",
                transformOrigin: `${p.cx}px ${p.cy}px`,
                transformBox: "view-box",
                transition: revealed ?
                `opacity .6s cubic-bezier(.4,0,.2,1) ${dimDelay}s, transform 1s cubic-bezier(.4,0,.2,1) ${dimDelay}s` :
                "opacity .3s, transform .3s"
              }}>
                {/* orbit rings */}
                {t.showRings && lbl.rings.map((ring, i) =>
                <circle key={i} cx={p.cx} cy={p.cy} r={ring.r}
                fill="none"
                stroke={isHover || isDragging ? t.accent : ringDim}
                strokeWidth={isHover || isDragging ? t.ringStroke + 0.5 : t.ringStroke}
                style={{ transition: "stroke .25s, stroke-width .25s" }} />
                )}
                {/* coming-soon dashed orbit + rotating text */}
                {lbl.comingSoon && t.showRings &&
                <g className="cs-group">
                    <circle cx={p.cx} cy={p.cy} r={lbl.ringR}
                  fill="none"
                  stroke={isHover || isDragging ? t.accent : ringDimDash}
                  strokeWidth={t.ringStroke + 0.1}
                  strokeDasharray="3 4"
                  style={{ transition: "stroke .25s" }} />
                    <defs>
                      <path id={`cs-path-${lbl.id}`}
                    d={`M ${p.cx - (lbl.ringR + 12)} ${p.cy} a ${lbl.ringR + 12} ${lbl.ringR + 12} 0 1 1 ${(lbl.ringR + 12) * 2} 0 a ${lbl.ringR + 12} ${lbl.ringR + 12} 0 1 1 -${(lbl.ringR + 12) * 2} 0`} />
                    </defs>
                    <g className="cs-spin"
                  style={{ "--cx": p.cx, "--cy": p.cy,
                    animationDuration: `${28 / Math.max(0.05, t.speed)}s`,
                    animationPlayState: paused ? "paused" : "running" }}>
                      <text className="cs-text" fill="#ffffff" opacity={0.8}>
                        <textPath href={`#cs-path-${lbl.id}`} startOffset="0">
                          COMING SOON · COMING SOON · COMING SOON · COMING SOON · COMING SOON · COMING SOON ·{" "}
                        </textPath>
                      </text>
                    </g>
                  </g>
                }

                {/* label logo — pointerDown handles both drag & click.
                         Fit each logo into a box preserving its aspect ratio.
                         ABD ("coming soon") uses a smaller box so it stays inside
                         its tight 62px ring. On the dark/focused background the
                         black logo is inverted to white so it stays legible. */}
                {(() => {
                  const ratio = lbl.logoRatio || 3;
                  const maxW = lbl.comingSoon ? 76 : 172;
                  const maxH = lbl.comingSoon ? 46 : 66;
                  let dw = maxW,dh = maxW / ratio;
                  if (dh > maxH) {dh = maxH;dw = maxH * ratio;}
                  const hitW = Math.max(dw, 200),hitH = Math.max(dh, 56);
                  // Swap to white logos on the dark (focused) background; black
                  // on the lime overview. CSS filter:invert doesn't paint on
                  // <image> in this engine, so we hot-swap the data URI.
                  const map = isLanding ? window.LOGO_BLACK : window.LOGO_WHITE;
                  const src = map && map[lbl.id] || lbl.logo;
                  return (
                    <g onPointerDown={onLabelPointerDown(lbl)}
                    onMouseEnter={onLabelEnter(lbl)}
                    onMouseLeave={onLabelLeave}
                    style={{ cursor: isDragging ? "grabbing" : "grab" }}>
                      <rect x={p.cx - hitW / 2} y={p.cy - hitH / 2}
                      width={hitW} height={hitH} fill="transparent" />
                      <image href={src}
                      xlinkHref={src}
                      x={p.cx - dw / 2} y={p.cy - dh / 2}
                      width={dw} height={dh}
                      preserveAspectRatio="xMidYMid meet"
                      style={{ pointerEvents: "none" }} />
                    </g>);
                })()}

                {/* drag readout */}
                {isDragging &&
                <text x={p.cx} y={p.cy + 56} textAnchor="middle"
                className="drag-readout"
                fill={t.accent}>
                    {p.cx}, {p.cy}
                  </text>
                }
              </g>);

          })}

          {/* artists (rendered after labels so they sit on top) */}
          {allArtists.map((a) => {
            const dimL = focusLabel && focusLabel !== a.labelId;
            const dimM = !matchArtist(a) && q;
            const dimD = draggingId && draggingId !== a.labelId;
            const dim = dimL || dimM || dimD;
            const isHover = hoverArtist?.id === a.id;
            const revealDelay = (REVEAL_ORDER[a.labelId] ?? 0) * REVEAL_STAGGER + 0.15;
            const dimDelay = focusLabel ? 0 : revealDelay;
            const baseOpacity = dim ? 0.1 : 1;
            return (
              <g key={a.id}
              ref={(el) => {artistRefs.current[a.id] = el;}}
              className="artist-group"
              onMouseEnter={onArtistEnter(a)}
              onMouseLeave={onArtistLeave}
              onClick={onArtistClick(a)}
              style={{
                cursor: focusLabel === a.labelId ? "pointer" : undefined,
                opacity: labelsReady ? baseOpacity : 0,
                transition: labelsReady ?
                `opacity .6s cubic-bezier(.4,0,.2,1) ${dimDelay}s` :
                "opacity .3s"
              }}>
                {/* Dot, hit area, hover ring, and name all share `dotR` so
                                                       they grow together. Seniority scaling: base 5px + 1.2px per
                                                       year since debut → BTS ~21px, CORTIS ~6px. */}
                {(() => {
                  const dotR = 5 + Math.max(0, 2026 - (a.debut || 2026)) * 1.2;
                  // Hit area always ≥18 so tiny dots stay clickable.
                  const hitR = Math.max(18, dotR + 8);
                  // Hover ring hugs the dot's outer edge.
                  const ringR = dotR + 6;
                  // Name lifts above the circle with consistent ~9px gap.
                  const nameY = -Math.max(16, dotR + 9);
                  const hoverStroke = isLanding ? "#0a0a0a" : t.accent;
                  const hoverFill = isLanding ? "#0a0a0a" : t.accent;
                  return (
                    <>
                      <circle r={hitR} fill="transparent" style={{ cursor: "pointer" }} />
                      <circle r={isHover ? ringR : 0} fill="none"
                      stroke={hoverStroke} strokeWidth={1}
                      opacity={isHover ? 0.6 : 0}
                      style={{ transition: "r .25s, opacity .25s" }} />
                      <circle r={dotR} fill={artistFill} />
                      <text y={nameY} textAnchor="middle" className="artist-text"
                      fill={isHover ? hoverFill : artistText}>
                        {a.name}
                      </text>
                    </>);

                })()}
              </g>);

          })}
        </g>
      </svg>

      {/* Film grain — pre-baked PNG via canvas, painted once and re-used as
                                             a CSS background. Avoids feTurbulence recompute on every SVG paint.
                                             Shown from the very first (welcome) page onward. */}
      {t.mode !== "minimal" && t.grain > 0 &&
      <div className="grain-overlay"
      style={{ backgroundImage: `url(${noiseUrl})`,
        opacity: t.grain * 0.28 }} />
      }

      {/* Iris wipe — mounted only during the brief "entering" window.
                                             CSS keyframe collapses it from full coverage to a point at center,
                                             giving the cream landing a "sucked through the middle" exit. */}
      {entering && <div className="iris-wipe" key="iris" />}

      {/* Landing-only org description tooltip (under the centered title).
                                             Stylish/minimal landing only — dynamic uses the top-left header
                                             card for the same purpose, so we suppress this overlay there
                                             to avoid two tooltips showing at once. */}
      {!entered && !isDynamic &&
      <div className={"org-tooltip-wrap" + (orgHover ? " visible" : "")}
      aria-hidden={!orgHover}>
          <div className="org-tooltip">
            <p>HYBE MUSIC GROUP APAC oversees HYBE's multi-label companies across Korea and Japan.</p>
            <p>Under a multi-label system, it drives the continued growth of the music business while supporting each label's growth through group-level strategy and investment. By overseeing the multi-label business across Korea and Japan, it strengthens the strategy and processes essential to label growth and innovation, and advances the enhancement of music-service capabilities and resource investment.</p>
          </div>
        </div>
      }

      {/* HEADER — top-left.
                                             Two layouts share this slot:
                                             · Overview: org name + tagline. Hovering the org card slides a
                                               description panel open underneath (the same copy used on the
                                               lime landing). Dynamic mode makes this the primary "main home"
                                               identity instead of using the lime splash.
                                             · Focused: label name + founded/hq/acts grid + description.
                                               Replaces the floating hover-card so the info stays put while
                                               the user browses the zoomed-in orbit. */}
      <header className={"header" + (focusedLabel ? " focused" : "")}
      style={{
        opacity: showChrome ? 1 : 0,
        transform: showChrome ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity .3s ease, transform .3s ease",
        pointerEvents: showChrome ? "auto" : "none"
      }}>
        {focusedLabel ?
        <div className="info-card">
            <div className="info-kicker" style={{ color: t.accent }}>LABEL</div>
            <div className="info-name">{focusedLabel.name}</div>
            <div className="info-grid">
              <div><span>Founded</span><b>{focusedLabel.founded}</b></div>
              <div><span>HQ</span><b>{focusedLabel.hq}</b></div>
              <div><span>Groups</span><b>{focusedLabel.acts}</b></div>
            </div>
            {focusedLabel.joined &&
          <div className="info-join">
              <span>Joined HYBE</span><b>{focusedLabel.joined}</b>
            </div>
          }
            <p className="info-bio">{focusedLabel.description}</p>
            <button className="back-btn"
          onClick={() => {setFocusLabel(null);if (!isDynamic) setEntered(false);}}>
              ← BACK TO OVERVIEW
            </button>
          </div> :

        <div className="org-card">
            <div className="org">
              <span className="org-name" style={{ fontSize: "16px" }}>{data.org}</span>
            </div>
            <a className="timeline-link" href="Timeline.html">
              <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M1 6h10M7 2.5L11 6l-4 3.5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              VIEW GROWTH TIMELINE
            </a>
          </div>
        }
      </header>

      {/* LANDING moved into SVG above; HTML overlay removed */}

      {/* SEARCH */}
      <div className="search" style={{
        opacity: showSearch ? 1 : 0,
        transform: showSearch ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity .3s ease, transform .3s ease",
        pointerEvents: showSearch ? "auto" : "none"
      }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8.5 8.5l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <input value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Search labels, artists…" />
        {query &&
        <button onClick={() => setQuery("")} aria-label="Clear">✕</button>
        }
      </div>

      {/* CONTROLS */}
      <div className="controls" style={{
        opacity: showControls ? 1 : 0,
        transform: showControls ? "translate(-50%, 0)" : "translate(-50%, 12px)",
        transition: "opacity .3s ease, transform .3s ease",
        pointerEvents: showControls ? "auto" : "none"
      }}>
        <button className="ctrl-btn" onClick={() => setPaused((p) => !p)}>
          {paused ?
          <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 1l7 4.5L2 10z" fill="currentColor" /></svg> :

          <svg width="11" height="11" viewBox="0 0 11 11"><rect x="2" y="1.5" width="2.5" height="8" fill="currentColor" /><rect x="6.5" y="1.5" width="2.5" height="8" fill="currentColor" /></svg>
          }
          <span>{paused ? "PLAY" : "PAUSE"}</span>
        </button>
        <div className="ctrl-sep" />
        <div className="ctrl-speed">
          <span className="ctrl-label">SPEED</span>
          <input type="range" min="0" max="3" step="0.1" value={t.speed}
          onChange={(e) => setTweak('speed', Number(e.target.value))} />
          <span className="ctrl-value">{t.speed.toFixed(1)}×</span>
        </div>
        <div className="ctrl-sep" />
        {focusLabel ?
        <button className="ctrl-btn" onClick={() => setFocusLabel(null)}>
            <svg width="11" height="11" viewBox="0 0 11 11"><path d="M3 3l5 5M8 3l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
            <span>EXIT FOCUS</span>
          </button> :

        <div className="ctrl-hint">
            <span className="hint-pill">SPACE</span> PAUSE <span className="hint-pill">DRAG</span> MOVE <span className="hint-pill">CLICK</span> FOCUS
          </div>
        }
      </div>

      {/* LEGEND removed — label/artist hints no longer shown on edge hover. */}

      {/* HOVER CARDS */}
      {/* Artist hover card disabled on the overview — artist details are
               shown via the centered popup inside the focus page instead. */}

      {/* CENTERED ARTIST POPUP — opens on click inside the focus page.
               Horizontal layout: identity + meta on the left, member roster on
               the right. Dark backdrop; click outside or ✕ to dismiss. */}
      {popupArtist && (() => {
        const a = allArtistsById[popupArtist];
        if (!a) return null;
        // Does this group have any member photos? If so we always show the
        // portrait column — empty (with a hint) until a name is hovered.
        const hasMemberImgs = a.roster && a.roster.some((m) => {
          const nm = (m.match(/^(.*?)\s*\(/)?.[1] || m).trim();
          return !!MEMBER_IMG[nm];
        });
        return (
          <div className="artist-modal-backdrop" onClick={() => setPopupArtist(null)}>
            <div className="artist-modal" onClick={(e) => e.stopPropagation()}>
              <button className="am-close" aria-label="Close"
              onClick={() => setPopupArtist(null)}>
                <svg width="13" height="13" viewBox="0 0 13 13">
                  <path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
              <div className="am-left">
                <div className="am-kicker" style={{ color: t.accent }}>
                  ARTIST · {a.labelName}
                </div>
                <div className="am-name">{a.name}</div>
                <p className="am-bio">{a.bio}</p>
                <div className="am-meta">
                  <div><span>Debut</span><b>{a.debut}</b></div>
                  <div><span>Genre</span><b>{a.genre}</b></div>
                  {a.fandom && <div><span>Fandom</span><b>{a.fandom}</b></div>}
                </div>
              </div>
              {a.roster && a.roster.length > 0 &&
              <div className="am-right">
                  <span className="am-members-label">Members · {a.members}</span>
                  <div className="am-members-grid"
                onMouseLeave={() => setPreviewMember(null)}>
                    {a.roster.map((m) => {
                    const mt = m.match(/^(.*?)\s*\((\d{4})\)\s*$/);
                    const nm = mt ? mt[1] : m;
                    const yr = mt ? mt[2] : "";
                    const img = MEMBER_IMG[nm] || null;
                    const isLeader = a.leader && nm === a.leader;
                    const isActive = previewMember && previewMember.name === nm;
                    return (
                      <span
                        className={
                        (isLeader ? "hc-chip is-leader" : "hc-chip") + (
                        img ? " has-img" : "") + (isActive ? " active" : "")
                        }
                        key={m}
                        onMouseEnter={() => {if (img) setPreviewMember({ name: nm, year: yr, img });}}>
                          {isLeader && <span className="lead-tag">Leader</span>}
                          {nm}
                          {mt && <span className="yr">'{mt[2].slice(2)}</span>}
                        </span>);
                  })}
                  </div>
                </div>
              }
              {/* Portrait preview — empty until a member name is hovered.
                       The frame stays in place; hovering a chip fills it instantly
                       (images are preloaded for this group). */}
              {hasMemberImgs &&
              <div className="am-portrait">
                  <div className={"am-portrait-frame" + (previewMember ? "" : " is-empty")}>
                    {previewMember ?
                  <img key={previewMember.img} src={previewMember.img} alt={previewMember.name}
                  style={{ objectPosition: MEMBER_IMG_POS[previewMember.name] || undefined }}
                  decoding="async" draggable="false" /> :

                  <div className="am-portrait-hint">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M6 11.5V5.8a1.7 1.7 0 0 1 3.4 0v4.4m0 0V4.3a1.7 1.7 0 0 1 3.4 0v5.9m0 0V5.4a1.7 1.7 0 0 1 3.4 0v6.1m0 0c0-1 .9-1.7 1.8-1.5.9.2 1.4 1 1.2 1.9l-1 4.6a4.5 4.5 0 0 1-4.4 3.5h-2.2a4.5 4.5 0 0 1-3.7-2L4 14.6a1.6 1.6 0 0 1 .5-2.2c.7-.4 1.6-.2 2 .5l.9 1.3"
                      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>Hover a member name<br />to view their profile</span>
                      </div>
                  }
                  </div>
                  <div className="am-portrait-name">
                    {previewMember ?
                  <>
                        {previewMember.name}
                        {previewMember.year && <span>'{previewMember.year.slice(2)}</span>}
                      </> :
                  null}
                  </div>
                </div>
              }
              {ARTIST_TRACKS[a.id] &&
              <div className="am-nowplaying">
                  <span className="am-np-eq" aria-hidden="true"><i></i><i></i><i></i></span>
                  <span className="am-np-text" style={{ fontFamily: "monospace" }}>Now playing · <b>{ARTIST_TRACKS[a.id].title}</b><span className="am-np-badge">DEBUT SONG</span> ({ARTIST_TRACKS[a.id].year})</span>
                </div>
              }
            </div>
          </div>);

      })()}

      {hoverLabel && !draggingId && !focusLabel && (() => {
        const l = allLabelsById[hoverLabel.id];
        if (!l) return null;
        return (
          <div className="hover-card label-card label-card--hint" ref={clampCard}
          style={{ left: hoverLabel.x, top: hoverLabel.y - 24 }}>
            <div className="hc-cta" style={{ color: t.accent }}>
              Click to explore →
            </div>
          </div>);

      })()}

      {/* SYNTHETIC CURSOR (attract/demo loop) */}
      {demo &&
      <div className={"demo-cursor" + (cursor.click ? " click" : "")}
      style={{
        left: cursor.x, top: cursor.y,
        transition: `left ${cursor.dur}ms cubic-bezier(.33,0,.2,1), top ${cursor.dur}ms cubic-bezier(.33,0,.2,1)`
      }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M5 2.5l13.5 8.2-6 .9 3.4 6.4-2.7 1.4-3.4-6.5-4.3 4.2z"
          fill="#fff" stroke="#0a0a0a" strokeWidth="1.1" strokeLinejoin="round" />
          </svg>
        </div>
      }

      {/* Artist background track — always mounted so its ref is stable.
               No default src + preload="none": nothing is fetched on page load.
               The popup effect assigns src and calls load()/play() on demand, so a
               3–4 MB mp3 is only pulled when its artist popup actually opens. */}
      <audio ref={njAudioRef} loop preload="none" />

      {/* FOCUS-PAGE HINT — appears when zoomed into a label, fades out
               once a popup is open. */}
      {focusLabel && !popupArtist &&
      <div className="focus-hint">
          <span className="focus-hint-dot" />
          Click an artist name to learn more
        </div>
      }

      {/* COPY-TO-CLIPBOARD TOAST */}
      {copyToast &&
      <div className="toast">
          Positions copied to clipboard
        </div>
      }

      {/* TWEAKS */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Style" />
        <TweakRadio label="Mode" value={t.mode}
        options={["minimal", "stylish", "dynamic"]}
        onChange={(v) => setTweak('mode', v)} />
        <TweakSlider label="Glow" value={t.glow} min={0} max={1} step={0.05}
        onChange={(v) => setTweak('glow', v)} />
        <TweakSlider label="Grain" value={t.grain} min={0} max={1} step={0.05}
        onChange={(v) => setTweak('grain', v)} />

        <TweakSection label="Motion" />
        <TweakSlider label="Default speed" value={t.speed} min={0} max={3} step={0.1} unit="×"
        onChange={(v) => setTweak('speed', v)} />
        <TweakToggle label="Attract loop (demo)" value={t.demo}
        onChange={(v) => setTweak('demo', v)} />
        <TweakSection label="Visual" />
        <TweakColor label="Accent" value={t.accent}
        options={["#F5FF00", "#FF5C5C", "#5CB8FF", "#C8AAFF", "#FFFFFF"]}
        onChange={(v) => setTweak('accent', v)} />
        <TweakToggle label="Show orbit rings" value={t.showRings}
        onChange={(v) => setTweak('showRings', v)} />
        <TweakSlider label="Ring thickness" value={t.ringStroke}
        min={0.3} max={3} step={0.1} unit="px"
        onChange={(v) => setTweak('ringStroke', v)} />
        <TweakToggle label="Background stars" value={t.showStars}
        onChange={(v) => setTweak('showStars', v)} />

        <TweakSection label="Layout" />
        <div style={{ display: "flex", gap: 8 }}>
          <TweakButton label="Reset positions" onClick={resetPositions} secondary />
          <TweakButton label="Copy JSON" onClick={copyPositions} />
        </div>
        <div style={{ fontSize: 10, color: "rgba(41,38,27,.55)",
          fontFamily: "ui-monospace, monospace", lineHeight: 1.5,
          marginTop: 2 }}>
          Drag any label to reposition. Changes save automatically.
        </div>
      </TweaksPanel>

      {/* FIRST-VISIT WELCOME — lime full-bleed overlay driven by scroll.
               Beat 0: greeting + scroll hint. Beat 1: org description. Beat 2:
               fades out as the orbits stagger into view underneath. Always mounted
               (opacity-gated by `welcomed`) so scrolling back up the map fades it
               smoothly back in. */}
      <div className={"welcome" + (welcomed ? " welcome-exit" : "")}
      aria-hidden={welcomed}>
          {/* Beat 0 — HYBE logo, then full org title on one line (sequential reveal) */}
          <div className={"welcome-beat" + (introPhase === 0 ? " is-active" : "")}>
            <img className="welcome-logo welcome-logo--img" src="logos/hybe.png" alt="HYBE — We Believe in Music" />
            <div className="welcome-title">HYBE MUSIC GROUP APAC</div>
          </div>
          {/* Beat 1 — what APEC is */}
          <div className={"welcome-beat welcome-beat--desc" + (introPhase === 1 ? " is-active" : "")}>
            <div className="welcome-desc-kicker">HYBE MUSIC GROUP APAC</div>
            <p className="welcome-desc-body">HYBE MUSIC GROUP APAC oversees HYBE's multi-label companies across Korea and Japan. Under a multi-label system, it drives the continued growth of the music business while supporting each label's growth through group-level strategy and investment.</p>
          </div>
          {/* Scroll hint — pinned bottom, fades as the map approaches */}
          <div className="welcome-hint" style={{ opacity: welcomed ? 0 : 1 }}>
            <span className="welcome-hint-text">
              {introPhase === 0 ? "Scroll to explore" : "Scroll to open the map"}
            </span>
            <span className="welcome-hint-arrow">↓</span>
          </div>
        </div>
    </div>);

}

// Expose for the boot controller (boot.jsx), which picks the desktop orbital
// app vs. the mobile vertical layout (mobile.jsx) based on viewport width.
// Also expose the member-photo maps so mobile.jsx can reuse them.
window.OrbitalApp = App;
window.MEMBER_IMG = MEMBER_IMG;
window.MEMBER_IMG_POS = MEMBER_IMG_POS;