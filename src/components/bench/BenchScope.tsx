/* Pantalla de osciloscopio (canvas) para el banco: 10 × 8 divisiones, varios canales con unidad,
   marca de disparo, HOLD y acople. Se dibuja al tamaño real del contenedor. */
import { useEffect, useRef } from "react";
import { fmt } from "../ui/anim-kit";
import { useElementWidth } from "./hooks";

export interface BenchChannel { label: string; unit: string; color: string; vDiv: number; zero: number }

export function fmtDiv(v: number) {
  return v < 1 ? fmt(v, v < 0.1 ? 2 : 1) : fmt(v, 0);
}
export function fmtTime(ms: number) {
  if (ms < 1) return `${fmt(ms * 1000, 0)} µs`;
  if (ms >= 1000) return `${fmt(ms / 1000, ms % 1000 ? 1 : 0)} s`;
  return `${fmt(ms, ms < 10 && ms % 1 ? 1 : 0)} ms`;
}

export function BenchScope(props: {
  channels: BenchChannel[];
  msDiv: number;
  /** tiempo absoluto (ms) del borde izquierdo de la pantalla */
  t0: number;
  sample: (t: number, out: number[]) => void;
  /** posición del disparo en ms desde el borde izquierdo (si hay) */
  trigMs?: number;
  markers?: { ms: number; label: string }[];
  hold?: boolean;
  coupling?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const W = Math.max(260, Math.round(useElementWidth(wrap, 680)));
  const H = Math.round(Math.min(400, Math.max(230, W * (W < 520 ? 0.68 : 0.52))));

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#0b1410";
    g.fillRect(0, 0, W, H);
    const dx = W / 10, dy = H / 8;
    g.lineWidth = 1;
    g.strokeStyle = "rgba(110,255,170,.10)";
    for (let i = 1; i < 10; i++) { g.beginPath(); g.moveTo(Math.round(i * dx) + 0.5, 0); g.lineTo(Math.round(i * dx) + 0.5, H); g.stroke(); }
    for (let j = 1; j < 8; j++) { g.beginPath(); g.moveTo(0, Math.round(j * dy) + 0.5); g.lineTo(W, Math.round(j * dy) + 0.5); g.stroke(); }
    // ejes centrales con subdivisiones
    g.strokeStyle = "rgba(110,255,170,.25)";
    g.beginPath(); g.moveTo(W / 2 + 0.5, 0); g.lineTo(W / 2 + 0.5, H); g.moveTo(0, H / 2 + 0.5); g.lineTo(W, H / 2 + 0.5); g.stroke();
    for (let i = 0; i <= 50; i++) { const x = (i * W) / 50; g.beginPath(); g.moveTo(x, H / 2 - 3); g.lineTo(x, H / 2 + 3); g.stroke(); }
    for (let j = 0; j <= 40; j++) { const y = (j * H) / 40; g.beginPath(); g.moveTo(W / 2 - 3, y); g.lineTo(W / 2 + 3, y); g.stroke(); }

    const win = props.msDiv * 10;
    // marcas
    g.font = "600 11px 'Inter Variable', system-ui, sans-serif";
    for (const m of props.markers ?? []) {
      if (m.ms < 0 || m.ms > win) continue;
      const x = (m.ms / win) * W;
      g.strokeStyle = "rgba(255,210,63,.45)";
      g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(x, 18); g.lineTo(x, H); g.stroke();
      g.setLineDash([]);
      g.fillStyle = "rgba(255,210,63,.9)";
      g.fillText(m.label, Math.min(W - 50, x + 4), 30);
    }
    // disparo
    if (props.trigMs !== undefined && props.trigMs >= 0 && props.trigMs <= win) {
      const x = (props.trigMs / win) * W;
      g.fillStyle = "#ff9f43";
      g.beginPath(); g.moveTo(x - 6, 0); g.lineTo(x + 6, 0); g.lineTo(x, 8); g.fill();
      g.font = "700 10px 'JetBrains Mono Variable', monospace";
      g.fillText("T", x + 7, 10);
    }
    // trazas
    const n = Math.min(1600, Math.round(W * 1.6));
    const out: number[] = props.channels.map(() => 0);
    const ys: Float32Array[] = props.channels.map(() => new Float32Array(n + 1));
    for (let i = 0; i <= n; i++) {
      props.sample(props.t0 + (i / n) * win, out);
      props.channels.forEach((ch, k) => { ys[k][i] = H - (ch.zero * dy + (out[k] / ch.vDiv) * dy); });
    }
    props.channels.forEach((ch, k) => {
      g.save();
      g.strokeStyle = ch.color; g.lineWidth = 1.7; g.shadowColor = ch.color; g.shadowBlur = 5;
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        const x = (i / n) * W;
        const y = Math.max(-4, Math.min(H + 4, ys[k][i]));
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      g.restore();
      // marca de cero del canal
      const yz = H - ch.zero * dy;
      if (yz > 0 && yz < H) {
        g.fillStyle = ch.color;
        g.beginPath(); g.moveTo(0, yz - 6); g.lineTo(10, yz); g.lineTo(0, yz + 6); g.fill();
        g.fillStyle = "#0b1410";
        g.font = "700 8px 'JetBrains Mono Variable', monospace";
        g.fillText(String(k + 1), 1.5, yz + 3);
      }
    });
    // textos
    g.font = "600 11px 'JetBrains Mono Variable', monospace";
    props.channels.forEach((ch, k) => {
      g.fillStyle = ch.color;
      g.fillText(`CH${k + 1} ${ch.label}  ${fmtDiv(ch.vDiv)} ${ch.unit}/div${props.coupling && k === 0 ? "  " + props.coupling : ""}`, 14, H - 8 - (props.channels.length - 1 - k) * 15);
    });
    g.fillStyle = "rgba(180,255,210,.8)";
    g.textAlign = "right";
    g.fillText(`${fmtTime(props.msDiv)}/div`, W - 8, H - 8);
    g.textAlign = "left";
    if (props.hold) {
      g.fillStyle = "#ff5b5b";
      g.fillRect(W - 58, 8, 50, 18);
      g.fillStyle = "#fff";
      g.font = "800 11px 'Inter Variable', system-ui, sans-serif";
      g.fillText("HOLD", W - 49, 21);
    }
  });

  return (
    <div ref={wrap} style={{ width: "100%" }}>
      <canvas ref={cv} className="scope" style={{ width: "100%", height: H }} aria-label="Pantalla del osciloscopio" />
    </div>
  );
}

/** Medidas automáticas sobre la ventana: máx, mín, pico a pico y frecuencia. */
export function measure(sample: (t: number, out: number[]) => void, nCh: number, t0: number, win: number, n = 900) {
  const out = new Array(nCh).fill(0);
  const vals: Float32Array[] = Array.from({ length: nCh }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    sample(t0 + (i / (n - 1)) * win, out);
    for (let k = 0; k < nCh; k++) vals[k][i] = out[k];
  }
  return vals.map((a) => {
    let mx = -Infinity, mn = Infinity;
    for (const v of a) { if (v > mx) mx = v; if (v < mn) mn = v; }
    const pp = mx - mn;
    // frecuencia por cruces ascendentes del nivel medio (con histéresis)
    const mid = (mx + mn) / 2, hy = pp * 0.15;
    let state = a[0] > mid, first = -1, last = -1, count = 0;
    for (let i = 1; i < n; i++) {
      if (!state && a[i] > mid + hy) { state = true; if (first < 0) first = i; else count++; last = i; }
      else if (state && a[i] < mid - hy) state = false;
    }
    const freq = count >= 1 && last > first && pp > 1e-6 ? count / (((last - first) / (n - 1)) * win / 1000) : NaN;
    return { max: mx, min: mn, pp, freq };
  });
}
