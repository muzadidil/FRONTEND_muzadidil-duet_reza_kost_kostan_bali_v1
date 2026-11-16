"use client";

import { useEffect } from "react";

// Perilaku beranda: peta contoh yang bisa digeser, kontrol radius, tombol area, bayangan header saat digulir, dan
// tombol "Lewati" animasi pembuka. Diporting dari skrip di berkas desain pemilik (index.html, 16 Nov 2026) dengan
// perilaku yang sama. Markup-nya ada di src/content/landing/isi.html, jadi komponen ini hanya menyambungkan
// kejadian ke elemen yang sudah ada. Animasi pembuka sendiri diputar oleh skrip kecil di
// src/content/landing/skrip-intro.js (harus jalan sebelum React menyala, supaya halaman tidak berkedip).

type IntroState = { introPlaying: boolean; introDone: boolean; skipIntro?: () => void };

declare global {
  interface Window {
    KC?: IntroState;
  }
}

const KM = 37.9; // piksel per km pada viewBox peta
const AREAS = [
  { n: "Canggu", x: 250, y: 205 },
  { n: "Seminyak", x: 350, y: 365 },
  { n: "Kuta", x: 395, y: 500 },
  { n: "Denpasar", x: 570, y: 240 },
  { n: "Sanur", x: 725, y: 365 },
  { n: "Jimbaran", x: 385, y: 745 },
  { n: "Nusa Dua", x: 640, y: 845 },
] as const;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

type Dot = { el: SVGCircleElement; x: number; y: number; on: boolean };

function initLanding(): () => void {
  const byId = <T extends Element>(id: string) => document.getElementById(id) as unknown as T | null;
  const svg = byId<SVGSVGElement>("map");
  const pin = byId<SVGGElement>("pin");
  const pinBody = byId<SVGGElement>("pinBody");
  const ring = byId<SVGCircleElement>("radius");
  const statusEl = byId<HTMLElement>("mapStatus");
  const aWrap = byId<HTMLElement>("areaChips");
  if (!svg || !pin || !pinBody || !ring || !statusEl || !aWrap) return () => {};

  const ac = new AbortController();
  const { signal } = ac;
  const timeouts = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timeouts.delete(id);
      fn();
    }, ms);
    timeouts.add(id);
    return id;
  };
  let ringAnim = 0;
  let moveAnim = 0;
  let statusTimer = 0;

  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const KC: Partial<IntroState> = window.KC ?? {};

  // ---------- tahun di footer, tombol lewati, bayangan header ----------
  const year = byId<HTMLElement>("year");
  if (year) year.textContent = String(new Date().getFullYear());

  byId<HTMLButtonElement>("introSkip")?.addEventListener(
    "click",
    (e) => {
      e.stopPropagation();
      window.KC?.skipIntro?.();
    },
    { signal },
  );

  const head = document.querySelector<HTMLElement>(".site-head");
  const onScroll = () => head?.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true, signal });
  onScroll();

  // ---------- peta contoh ----------
  const land = svg.querySelector<SVGGeometryElement>(".m-land");
  const dots: Dot[] = Array.from(svg.querySelectorAll<SVGCircleElement>(".kd")).map((el) => ({
    el,
    x: Number(el.getAttribute("cx")),
    y: Number(el.getAttribute("cy")),
    on: false,
  }));
  const st = { x: 350, y: 331, km: 5, r: 5 * KM, shownR: 0 };

  function onLand(x: number, y: number) {
    if (!land || typeof land.isPointInFill !== "function") return true;
    try {
      const p = svg!.createSVGPoint();
      p.x = x;
      p.y = y;
      return land.isPointInFill(p);
    } catch {
      return true;
    }
  }

  function nearestArea(x: number, y: number) {
    let best: (typeof AREAS)[number] | null = null;
    let bd = 1e9;
    for (const a of AREAS) {
      const d = Math.hypot(a.x - x, a.y - y);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best && bd < 230 ? best.n : "";
  }

  // Menyalakan titik kos di dalam radius. mode: "instant" | "grow" | "shrink".
  function lightDots(mode: "instant" | "grow" | "shrink", fromR = 0) {
    const R = st.r;
    let n = 0;
    for (const d of dots) {
      const dist = Math.hypot(d.x - st.x, d.y - st.y);
      const on = dist <= R;
      let delay = 0;
      if (!reduced && mode === "grow" && on && !d.on) delay = Math.round((dist / R) * 520);
      if (!reduced && mode === "shrink" && !on && d.on) delay = Math.round(clamp((fromR - dist) / Math.max(fromR - R, 1), 0, 1) * 420);
      d.el.style.transitionDelay = `${delay}ms`;
      if (on !== d.on) {
        d.on = on;
        d.el.classList.toggle("on", on);
      }
      if (on) n++;
    }
    return n;
  }

  function setStatus(n: number) {
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      const km = st.km;
      let html: string;
      if (!onLand(st.x, st.y)) {
        html = "Pin kamu ada di laut. Geser ke daratan dulu, ya.";
      } else if (n === 0) {
        html = `Belum ada kos contoh dalam radius ${km} km. Perbesar radius atau geser pin ke area yang lebih ramai.`;
      } else {
        const area = nearestArea(st.x, st.y);
        html = `<strong>${n} kos contoh</strong> dalam radius ${km} km dari pin${area ? `, sekitar ${area}` : ""}.`;
      }
      statusEl!.innerHTML = html;
    }, 120);
  }

  function placePin(x: number, y: number) {
    st.x = clamp(x, 20, 980);
    st.y = clamp(y, 120, 905);
    pin!.setAttribute("transform", `translate(${st.x.toFixed(1)} ${st.y.toFixed(1)})`);
    ring!.setAttribute("cx", st.x.toFixed(1));
    ring!.setAttribute("cy", st.y.toFixed(1));
  }

  function setRadius(km: number, fromZero = false) {
    const from = fromZero ? 0 : st.shownR;
    const to = km * KM;
    const oldR = st.r;
    st.km = km;
    st.r = to;
    const n = lightDots(to >= oldR || fromZero ? "grow" : "shrink", oldR);
    setStatus(n);
    cancelAnimationFrame(ringAnim);
    if (reduced) {
      st.shownR = to;
      ring!.setAttribute("r", String(to));
      return;
    }
    const t0 = performance.now();
    const dur = 560;
    const frame = (now: number) => {
      const t = clamp((now - t0) / dur, 0, 1);
      st.shownR = from + (to - from) * ease(t);
      ring!.setAttribute("r", st.shownR.toFixed(1));
      if (t < 1) ringAnim = requestAnimationFrame(frame);
    };
    frame(t0);
  }

  function flyTo(x: number, y: number) {
    cancelAnimationFrame(moveAnim);
    if (reduced) {
      placePin(x, y);
      setStatus(lightDots("grow"));
      return;
    }
    const sx = st.x;
    const sy = st.y;
    const t0 = performance.now();
    const dur = 520;
    const frame = (now: number) => {
      const t = clamp((now - t0) / dur, 0, 1);
      const k = ease(t);
      placePin(sx + (x - sx) * k, sy + (y - sy) * k);
      lightDots("instant");
      if (t < 1) moveAnim = requestAnimationFrame(frame);
      else setStatus(lightDots("instant"));
    };
    frame(t0);
  }

  function toSvg(evt: { clientX: number; clientY: number }) {
    const m = svg!.getScreenCTM();
    const p = svg!.createSVGPoint();
    p.x = evt.clientX;
    p.y = evt.clientY;
    return m ? p.matrixTransform(m.inverse()) : p;
  }

  // Geser pin dengan mouse atau jari.
  let drag: { id: number; dx: number; dy: number } | null = null;
  pin.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      cancelAnimationFrame(moveAnim);
      const p = toSvg(e);
      drag = { id: e.pointerId, dx: st.x - p.x, dy: st.y - p.y };
      pin.setPointerCapture(e.pointerId);
      pin.classList.add("is-dragging");
      pin.focus({ preventScroll: true });
    },
    { signal },
  );
  pin.addEventListener(
    "pointermove",
    (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = toSvg(e);
      placePin(p.x + drag.dx, p.y + drag.dy);
      setStatus(lightDots("instant"));
    },
    { signal },
  );
  const endDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    pin.classList.remove("is-dragging");
  };
  pin.addEventListener("pointerup", endDrag, { signal });
  pin.addEventListener("pointercancel", endDrag, { signal });
  pin.addEventListener("click", (e) => e.stopPropagation(), { signal });

  // Ketuk di mana saja pada peta untuk memindahkan pin ke sana.
  svg.addEventListener(
    "click",
    (e) => {
      if ((e.target as Element | null)?.closest?.("#pin")) return;
      const p = toSvg(e);
      flyTo(p.x, p.y);
    },
    { signal },
  );

  // Papan ketik.
  pin.addEventListener(
    "keydown",
    (e) => {
      const step = e.shiftKey ? 40 : 14;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else return;
      e.preventDefault();
      placePin(st.x + dx, st.y + dy);
      setStatus(lightDots("instant"));
    },
    { signal },
  );

  // Pilihan radius.
  const rChips = Array.from(document.querySelectorAll<HTMLButtonElement>("#radiusChips .chip"));
  for (const b of rChips) {
    b.addEventListener(
      "click",
      () => {
        for (const o of rChips) o.setAttribute("aria-pressed", String(o === b));
        setRadius(Number(b.getAttribute("data-km")));
      },
      { signal },
    );
  }

  // Tombol area (lima pertama). Dikosongkan dulu supaya aman bila efek ini dijalankan dua kali.
  aWrap.replaceChildren();
  for (const a of AREAS.slice(0, 5)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip chip-area";
    b.textContent = a.n;
    b.addEventListener("click", () => flyTo(a.x, a.y - 34), { signal });
    aWrap.appendChild(b);
  }

  // Momen pembuka: pin jatuh, lalu lingkaran radius merambat keluar.
  let started = false;
  function startMap() {
    if (started) return;
    started = true;
    if (reduced) {
      st.shownR = st.r;
      ring!.setAttribute("r", String(st.r));
      setStatus(lightDots("instant"));
      return;
    }
    pinBody!.classList.add("drop");
    later(() => setRadius(st.km, true), 560);
  }
  ring.setAttribute("r", reduced ? String(st.r) : "0");
  pinBody.classList.remove("drop");
  if (KC.introPlaying && !KC.introDone) {
    // Menunggu animasi pembuka selesai (kejadian dikirim oleh skrip-intro.js).
    document.addEventListener("kc:intro-end", () => later(startMap, 250), { once: true, signal });
  } else {
    startMap();
  }

  return () => {
    ac.abort();
    for (const id of timeouts) window.clearTimeout(id);
    timeouts.clear();
    window.clearTimeout(statusTimer);
    cancelAnimationFrame(ringAnim);
    cancelAnimationFrame(moveAnim);
  };
}

export default function LandingBehavior() {
  useEffect(() => initLanding(), []);
  return null;
}
