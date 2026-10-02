/* Curvas de torque y potencia vs rpm (motor naftero típico), cursor arrastrable,
   comparación con un turbo de cilindrada parecida y efecto de la altura (Mendoza). */
import { useMemo, useRef, useState } from "react";
import { AnimFrame, Readout, Slider, Toggle, clamp, fmt, lerp, smoothstep } from "../ui/anim-kit";
import { useWide } from "./motor1-kit";

/** Atmosférico 1.6 16v típico: ~155 N·m a 4.000 rpm, ~81 kW (110 CV) a ~5.750 rpm */
function torqueNA(n: number) {
  const u = n < 4000 ? (n - 4000) / 3000 : (n - 4000) / 2500;
  const a = n < 4000 ? 0.33 : 0.2695;
  return 155 * (1 - a * u * u);
}
/** Interpolación cúbica monótona (Fritsch-Carlson) */
function monotone(xs: number[], ys: number[]) {
  const n = xs.length;
  const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]));
  const m = ys.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x: number) => {
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const hh = xs[i + 1] - xs[i], t = clamp((x - xs[i]) / hh, 0, 1);
    const h00 = 2 * t ** 3 - 3 * t ** 2 + 1, h10 = t ** 3 - 2 * t ** 2 + t, h01 = -2 * t ** 3 + 3 * t ** 2, h11 = t ** 3 - t ** 2;
    return h00 * ys[i] + h10 * hh * m[i] + h01 * ys[i + 1] + h11 * hh * m[i + 1];
  };
}
/** Turbo naftero chico típico: ~250 N·m planos de 1.500 a 3.500 rpm, ~110 kW (150 CV) arriba */
const torqueTurboBase = monotone([1000, 1500, 3500, 5000, 6000, 6500], [150, 250, 250, 210, 175, 150]);

/** presión atmosférica relativa a nivel del mar (atmósfera estándar) */
const presRel = (h: number) => Math.pow(1 - 2.2558e-5 * h, 5.256);

export function CurvaTorquePotencia() {
  const [rpm, setRpm] = useState(4000);
  const [turbo, setTurbo] = useState(false);
  const [alt, setAlt] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const wide = useWide(boxRef, 600);

  const pr = presRel(alt);
  const fTurboHigh = Math.min(1, pr / 0.78);
  const tNA = (n: number) => torqueNA(n) * pr;
  const tT = (n: number) => torqueTurboBase(n) * lerp(pr, fTurboHigh, smoothstep(1200, 2200, n));
  const T = turbo ? tT : tNA;
  const P = (fn: (n: number) => number, n: number) => (fn(n) * n) / 9550;

  const W = wide ? 720 : 360, H = wide ? 360 : 330;
  const x0 = wide ? 58 : 44, x1 = W - (wide ? 58 : 44), y0 = 30, y1 = H - 58;
  const N0 = 1000, N1 = 6500, TM = 300, PM = 150;
  const mx = (n: number) => x0 + ((n - N0) / (N1 - N0)) * (x1 - x0);
  const myT = (t: number) => y1 - (t / TM) * (y1 - y0);
  const myP = (p: number) => y1 - (p / PM) * (y1 - y0);
  const path = (fn: (n: number) => number, my: (v: number) => number) => {
    let d = "";
    for (let n = N0; n <= N1; n += 50) d += `${n === N0 ? "M" : "L"}${mx(n).toFixed(1)},${my(fn(n)).toFixed(1)}`;
    return d;
  };
  const peaks = useMemo(() => {
    const f = (fn: (n: number) => number, tol: number) => {
      let tm = 0, pm = 0, pn = 0;
      for (let n = N0; n <= N1; n += 25) {
        const t = fn(n), p = (t * n) / 9550;
        if (t > tm) tm = t;
        if (p > pm) { pm = p; pn = n; }
      }
      // primer régimen donde ya entrega (casi) el torque máximo: sirve para curvas planas
      let tn = N0;
      for (let n = N0; n <= N1; n += 25) if (fn(n) >= tm * tol) { tn = n; break; }
      tn = Math.round(tn / 50) * 50;
      return { tm, tn, pm, pn };
    };
    return { na: f(tNA, 0.99999), tu: f(tT, 0.997) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alt]);
  const pk = turbo ? peaks.tu : peaks.na;

  const tq = T(rpm), kw = P(T, rpm), cv = kw / 0.7355;
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = (e: React.PointerEvent<SVGRectElement>) => {
    const m = e.currentTarget.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    setRpm(Math.round(clamp(N0 + ((p.x - x0) / (x1 - x0)) * (N1 - N0), 800, 6500) / 50) * 50);
  };
  const fs = wide ? 1 : 0.92;

  return (
    <AnimFrame
      title="Curvas de torque y potencia"
      tag="Interactivo"
      controls={
        <>
          <Slider label="RPM" value={rpm} min={1000} max={6500} step={50} onChange={setRpm} />
          <Toggle label="Motor turbo" checked={turbo} onChange={setTurbo} />
          <Slider label="Altura" value={alt} min={0} max={3500} step={50} unit="m" onChange={setAlt} format={(v) => fmt(v, 0)} />
        </>
      }
      readouts={
        <>
          <Readout label="Régimen" value={fmt(rpm, 0)} unit="rpm" />
          <Readout label="Torque" value={fmt(tq, 0)} unit="N·m" tone="accent" />
          <Readout label="Potencia" value={fmt(kw, 1)} unit="kW" />
          <Readout label="Potencia" value={fmt(cv, 0)} unit="CV" />
          <Readout label="Aire disponible" value={fmt(pr * 100, 0)} unit="% del nivel del mar" tone={pr < 0.85 ? "warn" : undefined} />
        </>
      }
      legend={[
        { color: "var(--accent)", label: "Torque [N·m] (eje izquierdo)" },
        { color: "var(--primary)", label: "Potencia [kW] (eje derecho)" },
        ...(turbo ? [{ color: "var(--muted)", label: "Atmosférico, para comparar" }] : []),
      ]}
      caption={
        <>
          <p>
            Arrastrá sobre el gráfico. El <b>torque</b> es la fuerza de giro que entrega el cigüeñal: depende de qué tan bien se llena el
            cilindro en cada vuelta, por eso tiene una “panza” donde la admisión respira mejor. La <b>potencia</b> es torque por velocidad:
            P = M · n / 9550. Por eso sigue subiendo aunque el torque ya empiece a caer, hasta que cae demasiado. Entre el torque máximo y
            la potencia máxima está la zona donde el motor “empuja”.
          </p>
          <p>
            Prendé <b>turbo</b>: la curva de torque se hace una meseta desde muy abajo (la válvula de alivio recorta la presión para no
            pasarse). Después subí la <b>altura</b>: el atmosférico pierde cerca de 1 % cada 100 m (en Uspallata, ~20 %), y el turbo
            casi no se entera hasta bastante arriba porque gira más rápido para compensar. Curvas típicas, no de un modelo puntual.
          </p>
        </>
      }
    >
      <div ref={boxRef}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Curvas de torque y potencia">
          <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={6} fill="var(--surface)" stroke="var(--border)" />
          {/* zona útil */}
          <rect x={mx(pk.tn)} y={y0} width={Math.max(0, mx(pk.pn) - mx(pk.tn))} height={y1 - y0} fill="var(--ok)" opacity={0.08} />
          <text x={(mx(pk.tn) + mx(pk.pn)) / 2} y={y0 + 14} textAnchor="middle" className="svg-small" style={{ fill: "var(--ok)", fontWeight: 700 }}>zona de empuje</text>
          {[0, 50, 100, 150, 200, 250, 300].map((t) => (
            <g key={t}>
              <line x1={x0} y1={myT(t)} x2={x1} y2={myT(t)} stroke="var(--border)" strokeDasharray="2 4" />
              <text x={x0 - 6} y={myT(t) + 3.5} textAnchor="end" className="svg-small" style={{ fill: "var(--accent)" }}>{t}</text>
              <text x={x1 + 6} y={myT(t) + 3.5} className="svg-small" style={{ fill: "var(--primary)" }}>{fmt((t / TM) * PM, 0)}</text>
            </g>
          ))}
          <text x={x0 - 6} y={y0 - 10} textAnchor="end" className="svg-small" style={{ fill: "var(--accent)", fontWeight: 700 }}>N·m</text>
          <text x={x1 + 6} y={y0 - 10} className="svg-small" style={{ fill: "var(--primary)", fontWeight: 700 }}>kW</text>
          {[1000, 2000, 3000, 4000, 5000, 6000].map((n) => (
            <g key={n}>
              <line x1={mx(n)} y1={y1} x2={mx(n)} y2={y1 + 5} stroke="var(--muted)" />
              <text x={mx(n)} y={y1 + 17} textAnchor="middle" className="svg-small">{wide ? fmt(n, 0) : `${n / 1000}k`}</text>
            </g>
          ))}
          <text x={x1} y={y1 + 31} textAnchor="end" className="svg-small">rpm →</text>
          {/* curvas */}
          {turbo && <path d={path(tNA, myT)} fill="none" stroke="var(--muted)" strokeWidth={1.6} strokeDasharray="5 4" />}
          {turbo && <path d={path((n) => P(tNA, n), myP)} fill="none" stroke="var(--muted)" strokeWidth={1.6} strokeDasharray="2 3" />}
          <path d={path(T, myT)} fill="none" stroke="var(--accent)" strokeWidth={3} />
          <path d={path((n) => P(T, n), myP)} fill="none" stroke="var(--primary)" strokeWidth={3} />
          {/* picos */}
          <circle cx={mx(pk.tn)} cy={myT(pk.tm)} r={4} fill="var(--accent)" />
          <text x={mx(pk.tn)} y={myT(pk.tm) - 9} textAnchor="middle" className="svg-small" style={{ fill: "var(--accent)", fontWeight: 700 }}>
            {fmt(pk.tm, 0)} N·m{turbo ? " desde " : " a "}{fmt(pk.tn, 0)}
          </text>
          <circle cx={mx(pk.pn)} cy={myP(pk.pm)} r={4} fill="var(--primary)" />
          <text x={mx(pk.pn)} y={myP(pk.pm) - 9} textAnchor="middle" className="svg-small" style={{ fill: "var(--primary)", fontWeight: 700 }}>
            {fmt(pk.pm, 0)} kW ({fmt(pk.pm / 0.7355, 0)} CV)
          </text>
          {/* cursor */}
          <line x1={mx(rpm)} y1={y0} x2={mx(rpm)} y2={y1} stroke="var(--text)" strokeWidth={1.4} />
          <circle cx={mx(rpm)} cy={myT(tq)} r={6} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
          <circle cx={mx(rpm)} cy={myP(kw)} r={6} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} />
          <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="transparent" style={{ cursor: "ew-resize", touchAction: "none" }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag(e); }}
            onPointerMove={(e) => { if (e.buttons) drag(e); }} />
          {/* fórmula en vivo */}
          <text x={W / 2} y={H - 12} textAnchor="middle" style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 * fs, fontWeight: 700, fill: "var(--text)" }}>
            P = {fmt(tq, 0)} × {fmt(rpm, 0)} / 9550 = {fmt(kw, 1)} kW = {fmt(cv, 0)} CV
          </text>
        </svg>
      </div>
    </AnimFrame>
  );
}
