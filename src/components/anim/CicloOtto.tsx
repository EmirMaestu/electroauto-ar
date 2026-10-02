/* Ciclo Otto ideal en el diagrama p-V, sincronizado con el pistón (cinemática real de biela).
   Compresión y expansión adiabáticas (κ = 1,4), combustión y escape a volumen constante.
   η = 1 − 1/ε^(κ−1). Opcional: un ciclo "real" aproximado (combustión progresiva con ley de Wiebe,
   pérdidas de calor, apertura de escape anticipada y lazo de bombeo). */
import { useMemo, useState } from "react";
import { AnimFrame, Readout, Slider, Toggle, useAnimClock, plotPath, fmt, Arrow } from "../ui/anim-kit";
import { crankKinematics } from "./Biela";

const VH = 400;            // cm³ por cilindro (un 1.6 de 4 cilindros)
const K = 1.4;
const T1 = 293;            // K
const P0 = 1.0;            // bar
const DT = 2200;           // K que sube la temperatura en la combustión (ideal)
const RK = 40, LK = 135;   // mm
const R_AIRE = 287, CV = 718;

// tramos del ciclo (en "unidades": 1 unidad = 1° de cigüeñal, salvo combustión y escape espontáneo)
const SEG = [
  { name: "Admisión", a: 0, b: 180 },
  { name: "Compresión", a: 180, b: 360 },
  { name: "Combustión", a: 360, b: 410 },
  { name: "Expansión", a: 410, b: 590 },
  { name: "Escape", a: 590, b: 620 },
  { name: "Escape", a: 620, b: 800 },
];
const TOTAL = 800;

const volAt = (crankDeg: number, Vc: number) => Vc + (VH * crankKinematics((crankDeg * Math.PI) / 180, RK, LK).x) / (2 * RK);

function realCycle(eps: number) {
  const Vc = VH / (eps - 1), V1 = VH + Vc;
  const kr = 1.32;
  let p = 0.95e5;
  const m = (p * V1 * 1e-6) / (R_AIRE * 330);
  const Q = 0.9 * m * CV * DT;
  const wiebe = (th: number) => { const x = (th + 15) / 45; return x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-5 * x ** 3); };
  const pts: { v: number; p: number }[] = [];
  let pEvo = 0;
  for (let th = -180; th <= 180; th += 2) {
    const Va = volAt(th, Vc);
    if (th < 130) {
      pts.push({ v: Va, p: p / 1e5 });
      const Vb = volAt(th + 2, Vc);
      const dQ = Q * (wiebe(th + 2) - wiebe(th));
      p += (-kr * p * (Vb - Va)) / Va + ((kr - 1) / (Va * 1e-6)) * dQ;
      pEvo = p;
    } else {
      pts.push({ v: Va, p: 1.05 + (pEvo / 1e5 - 1.05) * Math.exp(-(th - 130) / 12) });
    }
  }
  // lazo de bombeo: escape a 1,1 bar (PMI → PMS) y admisión a 0,9 bar (PMS → PMI)
  for (let th = 180; th <= 360; th += 6) pts.push({ v: volAt(th, Vc), p: 1.1 });
  for (let th = 360; th <= 540; th += 6) pts.push({ v: volAt(th, Vc), p: 0.9 });
  return pts;
}

export function CicloOtto() {
  const clock = useAnimClock({ speed: 1 });
  const [eps, setEps] = useState(10);
  const [real, setReal] = useState(false);

  const Vc = VH / (eps - 1), V1 = VH + Vc;
  const T2 = T1 * eps ** (K - 1), p2 = P0 * eps ** K;
  const T3 = T2 + DT, p3 = (p2 * T3) / T2;
  const p4 = p3 / eps ** K, T4 = T3 / eps ** (K - 1);
  const eta = 1 - 1 / eps ** (K - 1);
  const m = (P0 * 1e5 * V1 * 1e-6) / (R_AIRE * T1);
  const Qin = m * CV * DT;
  const W = eta * Qin;

  /* estado actual */
  // (el reloj puede arrancar con un t apenas negativo: se normaliza)
  const u = (((Math.max(0, clock.t) * (TOTAL / 5)) % TOTAL) + TOTAL) % TOTAL;
  const seg = Math.max(0, SEG.findIndex((s) => u >= s.a && u < s.b));
  const f = (u - SEG[seg].a) / (SEG[seg].b - SEG[seg].a);
  let crank: number, p: number, T: number;
  switch (seg) {
    case 0: crank = u; p = P0; T = T1; break;
    case 1: { crank = u; const V = volAt(crank, Vc); p = P0 * (V1 / V) ** K; T = T1 * (V1 / V) ** (K - 1); break; }
    case 2: crank = 360; p = p2 + (p3 - p2) * f; T = T2 + (T3 - T2) * f; break;
    case 3: { crank = 360 + (u - 410); const V = volAt(crank, Vc); p = p3 * (Vc / V) ** K; T = T3 * (Vc / V) ** (K - 1); break; }
    case 4: crank = 540; p = p4 + (P0 - p4) * f; T = T4 + (T1 + 500 - T4) * f; break;
    default: crank = 540 + (u - 620); p = P0; T = T1 + 500; break;
  }
  const V = volAt(crank, Vc);
  const phase = SEG[seg].name;

  /* diagrama */
  const GX = 214, GY = 30, GW = 340, GH = 300, PMAX = 150, VMAX = 500;
  const gx = (v: number) => GX + (v / VMAX) * GW;
  const gy = (pp: number) => GY + GH - (Math.min(pp, PMAX) / PMAX) * GH;
  const comp = plotPath((v) => P0 * (V1 / v) ** K, V1, Vc, 80, gx, gy);
  const expn = plotPath((v) => p3 * (Vc / v) ** K, Vc, V1, 80, gx, gy);
  const area = `${comp} L${gx(Vc)},${gy(p3)} ${expn.replace("M", "L")} Z`;
  const realPts = useMemo(() => realCycle(eps), [eps]);
  const realPath = realPts.map((q, i) => `${i ? "L" : "M"}${gx(q.v).toFixed(1)},${gy(q.p).toFixed(1)}`).join("") + "Z";

  /* η(ε) */
  const EX = 596, EY = 46, EW = 112, EH = 120;
  const ex = (e: number) => EX + ((e - 4) / 18) * EW;
  const ey = (n: number) => EY + EH - (n / 0.75) * EH;

  /* cilindro */
  const CX = 104, CTOP = 70, SCALE = 0.42; // px por cm³ de altura
  const gasH = V * SCALE;
  const pistonY = CTOP + gasH;
  const admOpen = seg === 0, escOpen = seg >= 4;
  const gasFill = seg <= 1 ? "var(--c-mix)" : seg === 2 ? "var(--c-flame)" : seg === 3 ? "var(--c-hot)" : "var(--c-exhaust)";
  const gasOp = seg <= 1 ? 0.25 + 0.35 * (seg === 1 ? (V1 - V) / VH : 0) : seg === 3 ? 0.25 + 0.6 * ((T - T4) / (T3 - T4)) : 0.6;

  return (
    <AnimFrame
      title="Ciclo Otto ideal: el área es el trabajo"
      clock={clock}
      controls={
        <>
          <Slider label="Relación de compresión ε" value={eps} min={6} max={14} step={0.5} onChange={setEps} format={(v) => `${fmt(v, v % 1 ? 1 : 0)}:1`} />
          <Toggle label="Comparar con un ciclo real (aprox.)" checked={real} onChange={setReal} />
        </>
      }
      readouts={
        <>
          <Readout label="Tiempo" value={phase} />
          <Readout label="Presión" value={fmt(p, p < 10 ? 1 : 0)} unit="bar" />
          <Readout label="Temperatura" value={fmt(T - 273, 0)} unit="°C" />
          <Readout label="Rendimiento teórico" value={fmt(eta * 100, 1)} unit="%" tone="accent" />
          <Readout label="Trabajo por ciclo (ideal)" value={fmt(W, 0)} unit="J por cilindro" />
        </>
      }
      legend={[
        { color: "var(--accent)", label: "Ciclo ideal y trabajo útil (área)" },
        { color: "var(--c-hot)", label: "Calor que entra (combustión)" },
        { color: "var(--c-air)", label: "Calor que se tira (escape)" },
        ...(real ? [{ color: "var(--violet)", label: "Ciclo real aproximado" }] : []),
      ]}
      caption={
        <>
          <p>
            1→2 el pistón <b>comprime</b> la mezcla sin intercambiar calor; 2→3 la chispa la quema <b>de golpe</b> (en el ideal, sin que el
            pistón se mueva) y la presión se dispara; 3→4 los gases <b>empujan</b> al pistón; 4→1 se abre el escape y se tira el calor que
            sobra. El <b>área encerrada</b> es el trabajo que sale por el cigüeñal en cada ciclo.
          </p>
          <p>
            Subí ε: la curva se hace más alta y angosta, el área crece para la misma nafta, y el rendimiento teórico pasa de {fmt((1 - 1 / 10 ** 0.4) * 100, 0)} %
            (ε = 10) a {fmt((1 - 1 / 12 ** 0.4) * 100, 0)} % (ε = 12). Activá el ciclo real: las esquinas se redondean (la combustión tarda, se
            escapa calor, el escape abre antes) y aparece el lazo de bombeo abajo. Por eso un motor real rinde 30–38 %, no 60 %.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 370" role="img" aria-label="Ciclo Otto en el diagrama presión-volumen">
        {/* cilindro */}
        <rect x={CX - 70} y={CTOP - 26} width={140} height={26} rx={4} fill="var(--c-metal-dark)" />
        <rect x={CX - 52} y={CTOP - 8 - (admOpen ? 8 : 0)} width={28} height={6} rx={2} fill={admOpen ? "var(--c-air)" : "var(--c-metal)"} />
        <rect x={CX + 24} y={CTOP - 8 - (escOpen ? 8 : 0)} width={28} height={6} rx={2} fill={escOpen ? "var(--c-exhaust)" : "var(--c-metal)"} />
        <text x={CX - 38} y={CTOP - 32} textAnchor="middle" className="svg-small">adm.</text>
        <text x={CX + 38} y={CTOP - 32} textAnchor="middle" className="svg-small">esc.</text>
        {seg === 2 && <circle cx={CX} cy={CTOP + 4} r={8 + 10 * f} fill="var(--c-spark)" opacity={1 - f * 0.6} />}
        <rect x={CX - 70} y={CTOP} width={14} height={240} fill="var(--c-block)" />
        <rect x={CX + 56} y={CTOP} width={14} height={240} fill="var(--c-block)" />
        <rect x={CX - 56} y={CTOP} width={112} height={gasH} fill={gasFill} opacity={Math.min(0.9, gasOp)} />
        <rect x={CX - 54} y={pistonY} width={108} height={46} rx={5} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        <line x1={CX} y1={pistonY + 30} x2={CX} y2={pistonY + 80} stroke="var(--c-metal-2)" strokeWidth={12} strokeLinecap="round" />
        <text x={CX} y={18} textAnchor="middle" className="svg-label" style={{ fontSize: 15, fill: "var(--accent)" }}>{phase}</text>
        <text x={CX} y={364} textAnchor="middle" className="svg-small">cigüeñal {fmt(crank % 720, 0)}°</text>

        {/* diagrama p-V */}
        <rect x={GX} y={GY} width={GW} height={GH} rx={8} fill="var(--surface)" stroke="var(--border)" />
        {[25, 50, 75, 100, 125, 150].map((b) => (
          <g key={b}>
            <line x1={GX} y1={gy(b)} x2={GX + GW} y2={gy(b)} stroke="var(--border)" strokeDasharray="2 5" />
            <text x={GX - 6} y={gy(b) + 4} textAnchor="end" className="svg-small">{b}</text>
          </g>
        ))}
        <text x={GX - 6} y={GY - 10} className="svg-small">bar</text>
        {[100, 200, 300, 400, 500].map((v) => (
          <text key={v} x={gx(v)} y={GY + GH + 15} textAnchor="middle" className="svg-small">{v}</text>
        ))}
        <text x={GX + GW} y={GY + GH + 30} textAnchor="end" className="svg-small">volumen [cm³]</text>
        <path d={area} fill="var(--accent)" opacity={0.16} />
        <path d={comp} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
        <path d={expn} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
        <line x1={gx(Vc)} y1={gy(p2)} x2={gx(Vc)} y2={gy(p3)} stroke="var(--c-hot)" strokeWidth={4} />
        <line x1={gx(V1)} y1={gy(p4)} x2={gx(V1)} y2={gy(P0)} stroke="var(--c-air)" strokeWidth={4} />
        <line x1={gx(Vc)} y1={gy(P0)} x2={gx(V1)} y2={gy(P0)} stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4 3" />
        <Arrow x1={gx(Vc) + 22} y1={gy((p2 + p3) / 2) + 18} x2={gx(Vc) + 6} y2={gy((p2 + p3) / 2)} color="var(--c-hot)" width={2} />
        <text x={gx(Vc) + 26} y={gy((p2 + p3) / 2) + 26} className="svg-small" style={{ fill: "var(--c-hot)", fontWeight: 700 }}>entra calor</text>
        <Arrow x1={gx(V1) - 4} y1={gy(p4) - 6} x2={gx(V1) - 22} y2={gy(p4) - 22} color="var(--c-air)" width={2} />
        <text x={gx(V1) - 26} y={gy(p4) - 26} textAnchor="end" className="svg-small" style={{ fill: "var(--c-air)", fontWeight: 700 }}>sale calor</text>
        <text x={gx(Vc) - 4} y={gy(p3) - 6} textAnchor="middle" className="svg-mono">3</text>
        <text x={gx(Vc) - 10} y={gy(p2) + 4} textAnchor="end" className="svg-mono">2</text>
        <text x={gx(V1) + 6} y={gy(p4) - 2} className="svg-mono">4</text>
        <text x={gx(V1) + 6} y={gy(P0) + 4} className="svg-mono">1</text>
        <text x={(gx(Vc) + gx(V1)) / 2} y={gy(12)} textAnchor="middle" className="svg-label" style={{ fill: "var(--accent)" }}>trabajo útil</text>
        {real && <path d={realPath} fill="var(--violet)" fillOpacity={0.1} stroke="var(--violet)" strokeWidth={2} strokeDasharray="5 3" />}
        <circle cx={gx(V)} cy={gy(p)} r={7} fill="var(--text)" stroke="var(--surface)" strokeWidth={2} />

        {/* rendimiento vs ε */}
        <rect x={EX - 8} y={EY - 30} width={EW + 22} height={EH + 64} rx={8} fill="var(--surface)" stroke="var(--border)" />
        <text x={EX} y={EY - 14} className="svg-small" style={{ fontWeight: 700 }}>η teórico vs ε</text>
        <rect x={ex(9)} y={EY} width={ex(13) - ex(9)} height={EH} fill="var(--c-fuel)" opacity={0.15} />
        <rect x={ex(15)} y={EY} width={ex(20) - ex(15)} height={EH} fill="var(--c-exhaust)" opacity={0.18} />
        <text x={(ex(9) + ex(13)) / 2} y={EY + EH - 4} textAnchor="middle" className="svg-small" style={{ fontSize: 9 }}>nafta</text>
        <text x={(ex(15) + ex(20)) / 2} y={EY + EH - 4} textAnchor="middle" className="svg-small" style={{ fontSize: 9 }}>diesel</text>
        <path d={plotPath((e) => 1 - 1 / e ** 0.4, 4, 22, 60, ex, ey)} fill="none" stroke="var(--accent)" strokeWidth={2} />
        <circle cx={ex(eps)} cy={ey(eta)} r={4.5} fill="var(--accent)" />
        <line x1={EX} y1={EY + EH} x2={EX + EW} y2={EY + EH} stroke="var(--border-strong)" />
        {[4, 10, 16, 22].map((e) => <text key={e} x={ex(e)} y={EY + EH + 13} textAnchor="middle" className="svg-small" style={{ fontSize: 9 }}>{e}</text>)}
        {[0.25, 0.5, 0.75].map((n) => <text key={n} x={EX - 2} y={ey(n) + 3} textAnchor="end" className="svg-small" style={{ fontSize: 9 }}>{n * 100}%</text>)}
        <text x={EX + EW / 2} y={EY + EH + 26} textAnchor="middle" className="svg-small" style={{ fontSize: 9 }}>relación de compresión</text>
        <text x={EX - 4} y={EY + EH + 66} className="svg-small">real: 30–38 % nafta,</text>
        <text x={EX - 4} y={EY + EH + 80} className="svg-small">hasta 40–45 % diesel</text>
      </svg>
    </AnimFrame>
  );
}
