/* ==========================================================================
   Kit de animaciones: reloj, marco, controles, instrumentos y helpers SVG.
   Todas las animaciones del sitio se arman con estas piezas para que se vean
   y se manejen igual. Se pausan solas cuando salen de pantalla.
   ========================================================================== */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/* ----------------------------------------------------------------- math */
export const TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const deg = (r: number) => (r * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Normaliza un ángulo en grados a [0, period) */
export const wrap = (a: number, period = 360) => ((a % period) + period) % period;
export const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString("es-AR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

/* -------------------------------------------------------------- hooks */
export function useInView<T extends Element>(ref: React.RefObject<T | null>, margin = "120px") {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  return inView;
}

export function useLoop(cb: (dt: number) => void, active: boolean) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      cbRef.current(dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

const prefersReduced = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface Clock {
  /** segundos de animación transcurridos (escalados por velocidad) */
  t: number;
  playing: boolean;
  speed: number;
  setPlaying: (p: boolean) => void;
  toggle: () => void;
  setSpeed: (s: number) => void;
  reset: () => void;
  /** avanza manualmente (para "paso a paso") */
  step: (dt: number) => void;
  ref: React.RefObject<HTMLDivElement | null>;
}

/** Reloj de animación. `t` avanza sólo si está en play y visible en pantalla. */
export function useAnimClock(opts: { speed?: number; autoplay?: boolean } = {}): Clock {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(opts.autoplay ?? !prefersReduced());
  const [speed, setSpeed] = useState(opts.speed ?? 1);
  const inView = useInView(ref);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  useLoop((dt) => setT((v) => v + dt * speedRef.current), playing && inView);
  const toggle = useCallback(() => setPlaying((p) => !p), []);
  const reset = useCallback(() => setT(0), []);
  const step = useCallback((dt: number) => setT((v) => Math.max(0, v + dt)), []);
  return { t, playing, speed, setPlaying, toggle, setSpeed, reset, step, ref };
}

/* --------------------------------------------------------------- frame */
export interface LegendItem { color: string; label: string }

export function AnimFrame(props: {
  title: string;
  tag?: string;
  clock?: Clock;
  children: ReactNode;
  controls?: ReactNode;
  readouts?: ReactNode;
  legend?: LegendItem[];
  caption?: ReactNode;
  speeds?: number[];
  stageStyle?: React.CSSProperties;
}) {
  const { clock } = props;
  const speeds = props.speeds ?? [0.25, 0.5, 1, 2];
  const fallbackRef = useRef<HTMLDivElement>(null);
  return (
    <figure className="anim" ref={clock?.ref ?? fallbackRef} style={{ marginBlock: undefined }}>
      <div className="anim-head">
        <span className="tag">{props.tag ?? "Animación"}</span>
        <span className="title">{props.title}</span>
      </div>
      <div className="anim-stage" style={props.stageStyle}>{props.children}</div>
      {(clock || props.controls) && (
        <div className="anim-controls">
          {clock && (
            <>
              <button className="ctl-play" onClick={clock.toggle} aria-label={clock.playing ? "Pausar" : "Reproducir"} title={clock.playing ? "Pausar" : "Reproducir"}>
                {clock.playing ? "❚❚" : "▶"}
              </button>
              <Seg
                value={clock.speed}
                onChange={clock.setSpeed}
                options={speeds.map((s) => ({ value: s, label: `${s}×` }))}
                ariaLabel="Velocidad"
              />
              {!clock.playing && (
                <button className="btn ghost sm" onClick={() => clock.step(0.02)} title="Avanzar un poquito">Paso ›</button>
              )}
              {props.controls && <span className="sep" />}
            </>
          )}
          {props.controls}
        </div>
      )}
      {props.readouts && <div className="readouts">{props.readouts}</div>}
      {props.legend && (
        <div className="anim-legend">
          {props.legend.map((l) => (
            <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>
          ))}
        </div>
      )}
      {props.caption && <figcaption className="anim-caption">{props.caption}</figcaption>}
    </figure>
  );
}

/* ------------------------------------------------------------ controls */
export function Slider(props: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; unit?: string; format?: (v: number) => string; width?: number;
}) {
  const shown = props.format ? props.format(props.value) : fmt(props.value, (props.step ?? 1) < 1 ? 1 : 0);
  return (
    <label className="ctl">
      <span>{props.label}</span>
      <input
        type="range" min={props.min} max={props.max} step={props.step ?? 1} value={props.value}
        style={props.width ? { width: props.width } : undefined}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
      />
      <span className="val">{shown}{props.unit ? <span className="faint"> {props.unit}</span> : null}</span>
    </label>
  );
}

export function Seg<T extends string | number>(props: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; ariaLabel?: string;
}) {
  return (
    <div className="seg" role="group" aria-label={props.ariaLabel}>
      {props.options.map((o) => (
        <button key={String(o.value)} className={o.value === props.value ? "on" : ""} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle(props: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="ctl" style={{ cursor: "pointer" }}>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange(e.target.checked)} />
      <span style={{ color: "var(--text-2)" }}>{props.label}</span>
    </label>
  );
}

export function Readout(props: { label: string; value: ReactNode; unit?: string; tone?: "ok" | "warn" | "bad" | "accent" }) {
  return (
    <div className={`readout ${props.tone ?? ""}`}>
      <div className="lbl">{props.label}</div>
      <div><span className="v">{props.value}</span>{props.unit && <span className="u">{props.unit}</span>}</div>
    </div>
  );
}

/* ------------------------------------------------------------ SVG bits */
/** Flecha con punta dibujada a mano (sin <marker>, que falla en algunos navegadores). */
export function Arrow(props: {
  x1: number; y1: number; x2: number; y2: number; color?: string; width?: number; head?: number; dash?: string; opacity?: number;
}) {
  const { x1, y1, x2, y2 } = props;
  const color = props.color ?? "var(--text)";
  const w = props.width ?? 2;
  const h = props.head ?? 8;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 1) return null;
  const bx = x2 - Math.cos(a) * h, by = y2 - Math.sin(a) * h;
  const p1 = `${x2},${y2}`;
  const p2 = `${bx + Math.cos(a + Math.PI / 2) * h * 0.5},${by + Math.sin(a + Math.PI / 2) * h * 0.5}`;
  const p3 = `${bx + Math.cos(a - Math.PI / 2) * h * 0.5},${by + Math.sin(a - Math.PI / 2) * h * 0.5}`;
  return (
    <g opacity={props.opacity ?? 1}>
      <line x1={x1} y1={y1} x2={bx} y2={by} stroke={color} strokeWidth={w} strokeDasharray={props.dash} strokeLinecap="round" />
      <polygon points={`${p1} ${p2} ${p3}`} fill={color} />
    </g>
  );
}

/** Path de un resorte en zigzag entre dos puntos verticales. */
export function springPath(x: number, yTop: number, yBot: number, coils = 8, width = 16) {
  const n = coils * 2;
  const step = (yBot - yTop) / (n + 2);
  let d = `M${x},${yTop} L${x},${yTop + step}`;
  for (let i = 0; i < n; i++) d += ` L${x + (i % 2 === 0 ? width : -width)},${yTop + step * (i + 1.5)}`;
  d += ` L${x},${yBot - step} L${x},${yBot}`;
  return d;
}

/** Etiqueta con línea guía, estilo plano técnico. */
export function Callout(props: { x: number; y: number; tx: number; ty: number; text: string; color?: string; anchor?: "start" | "end" | "middle" }) {
  const color = props.color ?? "var(--muted)";
  return (
    <g>
      <line x1={props.x} y1={props.y} x2={props.tx} y2={props.ty} stroke={color} strokeWidth={1} strokeDasharray="3 3" />
      <circle cx={props.x} cy={props.y} r={2.5} fill={color} />
      <text x={props.tx + (props.anchor === "end" ? -4 : props.anchor === "middle" ? 0 : 4)} y={props.ty + 4} textAnchor={props.anchor ?? "start"} className="svg-label">
        {props.text}
      </text>
    </g>
  );
}

/** Polilínea a partir de una función, para gráficos dentro del SVG. */
export function plotPath(fn: (x: number) => number, x0: number, x1: number, n: number, mapX: (x: number) => number, mapY: (y: number) => number) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = fn(x);
    d += `${i ? "L" : "M"}${mapX(x).toFixed(1)},${mapY(y).toFixed(1)}`;
  }
  return d;
}

/* ---------------------------------------------------------- osciloscopio */
export interface ScopeTrace {
  /** valor en volts (o la unidad del canal) para un tiempo en ms dentro de la ventana */
  fn: (ms: number) => number;
  color: string;
  label?: string;
  /** volts por división de este canal */
  vDiv: number;
  /** posición del cero en divisiones desde abajo (0 = abajo) */
  zero?: number;
}

/** Osciloscopio en canvas: 10 divisiones horizontales × 8 verticales. */
export function Scope(props: {
  traces: ScopeTrace[];
  msDiv: number;
  width?: number;
  height?: number;
  label?: string;
  markers?: { ms: number; label: string; color?: string }[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const W = props.width ?? 720;
  const H = props.height ?? 300;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#0b1410";
    g.fillRect(0, 0, W, H);
    const dx = W / 10, dy = H / 8;
    g.strokeStyle = "rgba(110,255,170,.10)";
    g.lineWidth = 1;
    for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(i * dx + 0.5, 0); g.lineTo(i * dx + 0.5, H); g.stroke(); }
    for (let j = 1; j < 8; j++) { g.beginPath(); g.moveTo(0, j * dy + 0.5); g.lineTo(W, j * dy + 0.5); g.stroke(); }
    g.strokeStyle = "rgba(110,255,170,.22)";
    g.beginPath(); g.moveTo(W / 2 + 0.5, 0); g.lineTo(W / 2 + 0.5, H); g.stroke();
    const windowMs = props.msDiv * 10;
    for (const m of props.markers ?? []) {
      const x = (m.ms / windowMs) * W;
      g.strokeStyle = m.color ?? "rgba(255,210,63,.5)";
      g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
      g.setLineDash([]);
      g.fillStyle = m.color ?? "rgba(255,210,63,.9)";
      g.font = "11px Inter Variable, sans-serif";
      g.fillText(m.label, x + 4, 14);
    }
    props.traces.forEach((tr) => {
      const zero = tr.zero ?? 1;
      g.strokeStyle = tr.color;
      g.lineWidth = 2;
      g.shadowColor = tr.color;
      g.shadowBlur = 6;
      g.beginPath();
      const N = Math.floor(W * 1.5);
      for (let i = 0; i <= N; i++) {
        const ms = (i / N) * windowMs;
        const v = tr.fn(ms);
        const y = H - (zero * dy + (v / tr.vDiv) * dy);
        const x = (i / N) * W;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      g.shadowBlur = 0;
      // marca de cero
      g.fillStyle = tr.color;
      g.beginPath();
      const yz = H - zero * dy;
      g.moveTo(0, yz - 5); g.lineTo(7, yz); g.lineTo(0, yz + 5); g.fill();
    });
    g.font = "11px JetBrains Mono Variable, monospace";
    g.fillStyle = "rgba(180,255,210,.75)";
    g.fillText(`${props.msDiv} ms/div`, W - 92, H - 8);
    props.traces.forEach((tr, i) => {
      g.fillStyle = tr.color;
      g.fillText(`${tr.label ?? "CH" + (i + 1)}  ${tr.vDiv} /div`, 10, H - 8 - i * 15);
    });
  });
  return <canvas ref={ref} className="scope" style={{ aspectRatio: `${W} / ${H}` }} aria-label={props.label ?? "Osciloscopio"} />;
}
