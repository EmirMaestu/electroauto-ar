/* Gráfico de datos en vivo "tipo scanner": una franja por PID, con su escala y el valor actual.
   Dibuja en canvas al tamaño real del contenedor (los textos no se achican en el celular). */
import { useEffect, useRef } from "react";
import { fmt } from "../ui/anim-kit";
import { useElementWidth } from "./hooks";

export interface TrendSeries {
  key: string; label: string; unit: string; color: string; dec: number;
  /** escala fija */
  min?: number; max?: number;
  /** rango mínimo para la autoescala */
  span?: number;
}

/** Buffer circular de muestras (tiempo + un canal por clave). */
export class TrendBuffer {
  size: number;
  t: Float64Array;
  vals: Map<string, Float32Array>;
  ptr = -1;
  count = 0;
  constructor(size: number, keys: string[]) {
    this.size = size;
    this.t = new Float64Array(size);
    this.vals = new Map(keys.map((k) => [k, new Float32Array(size)]));
  }
  push(t: number, values: Record<string, number>) {
    this.ptr = (this.ptr + 1) % this.size;
    this.t[this.ptr] = t;
    for (const [k, arr] of this.vals) arr[this.ptr] = values[k] ?? NaN;
    this.count = Math.min(this.size, this.count + 1);
  }
  clear() { this.ptr = -1; this.count = 0; }
  last(key: string) { const a = this.vals.get(key); return a && this.count ? a[this.ptr] : NaN; }
  lastT() { return this.count ? this.t[this.ptr] : 0; }
}

export const TREND_COLORS = ["#3ddc84", "#ffd23f", "#5cc8ff", "#ff8a5c"];

export function TrendChart(props: { buf: TrendBuffer; series: TrendSeries[]; windowS: number; version: number; stripH?: number }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const W = Math.max(240, Math.round(useElementWidth(wrap, 600)));
  const n = Math.max(1, props.series.length);
  const stripH = props.stripH ?? (W < 480 ? 62 : 72);
  const axisH = 20;
  const H = n * stripH + axisH;

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    }
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#0b1410";
    g.fillRect(0, 0, W, H);
    const { buf, windowS } = props;
    const tNow = buf.lastT();
    const t0 = tNow - windowS;
    const gut = 46; // margen derecho para escalas
    const PW = W - gut;
    const xOf = (t: number) => ((t - t0) / windowS) * PW;

    // grilla vertical (cada 5 s) + eje de tiempo
    const step = W < 480 ? (windowS > 40 ? 20 : windowS > 20 ? 10 : 5) : windowS > 40 ? 10 : 5;
    g.font = "10px 'JetBrains Mono Variable', monospace";
    g.textAlign = "center";
    for (let s = 0; s <= windowS; s += step) {
      const x = PW - (s / windowS) * PW;
      g.strokeStyle = s === 0 ? "rgba(110,255,170,.25)" : "rgba(110,255,170,.08)";
      g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H - axisH); g.stroke();
      g.fillStyle = "rgba(180,255,210,.55)";
      const lbl = s === 0 ? "ahora" : `−${s} s`;
      g.fillText(lbl, Math.min(W - 18, Math.max(16, x)), H - 6);
    }
    g.textAlign = "left";

    props.series.forEach((se, i) => {
      const y0 = i * stripH;
      const arr = buf.vals.get(se.key);
      // franja
      g.strokeStyle = "rgba(110,255,170,.16)";
      g.beginPath(); g.moveTo(0, y0 + stripH + 0.5); g.lineTo(W, y0 + stripH + 0.5); g.stroke();
      if (!arr || !buf.count) return;
      // rango
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < buf.count; k++) {
        const j = (buf.ptr - k + buf.size) % buf.size;
        if (buf.t[j] < t0) break;
        const v = arr[j];
        if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      }
      if (se.min !== undefined && se.max !== undefined) { lo = se.min; hi = se.max; }
      else {
        if (!Number.isFinite(lo)) { lo = 0; hi = 1; }
        const span = Math.max(se.span ?? 1, hi - lo);
        const mid = (hi + lo) / 2;
        lo = mid - span * 0.6; hi = mid + span * 0.6;
      }
      const top = y0 + 20, bot = y0 + stripH - 6;
      const yOf = (v: number) => bot - ((v - lo) / (hi - lo || 1)) * (bot - top);
      // traza
      g.save();
      g.beginPath(); g.rect(0, y0 + 1, PW, stripH - 1); g.clip();
      g.strokeStyle = se.color; g.lineWidth = 1.8; g.shadowColor = se.color; g.shadowBlur = 4;
      g.beginPath();
      let started = false;
      for (let k = buf.count - 1; k >= 0; k--) {
        const j = (buf.ptr - k + buf.size) % buf.size;
        const t = buf.t[j];
        if (t < t0) continue;
        const v = arr[j];
        if (!Number.isFinite(v)) { started = false; continue; }
        const x = xOf(t), y = yOf(v);
        if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
      }
      g.stroke();
      g.restore();
      // textos
      const cur = arr[buf.ptr];
      g.font = "600 11px 'Inter Variable', system-ui, sans-serif";
      g.fillStyle = se.color;
      g.fillText(se.label, 8, y0 + 14);
      g.font = "700 13px 'JetBrains Mono Variable', monospace";
      g.textAlign = "right";
      g.fillText(`${fmt(cur, se.dec)}${se.unit ? " " + se.unit : ""}`, W - 8, y0 + 15);
      g.font = "10px 'JetBrains Mono Variable', monospace";
      g.fillStyle = "rgba(180,255,210,.45)";
      g.fillText(fmt(hi, se.dec > 1 ? 1 : 0), W - 6, top + 14);
      g.fillText(fmt(lo, se.dec > 1 ? 1 : 0), W - 6, bot);
      // punto del valor actual
      if (Number.isFinite(cur)) {
        g.fillStyle = se.color;
        g.beginPath(); g.arc(PW, yOf(cur), 3, 0, Math.PI * 2); g.fill();
      }
      g.textAlign = "left";
    });
  });

  return (
    <div ref={wrap} style={{ width: "100%" }}>
      <canvas ref={cv} className="scope" style={{ width: "100%", height: H }} aria-label="Gráfico de datos en vivo" />
    </div>
  );
}
