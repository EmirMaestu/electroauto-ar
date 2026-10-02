/* Potencia, consumo y emisiones según lambda. Curvas típicas (tendencias de manual, no de un motor puntual),
   con la ventana del catalizador de tres vías y el efecto del catalizador sobre CO, HC y NOx. */
import { useId, useState } from "react";
import { AnimFrame, Readout, Seg, Slider, Toggle, fmt, plotPath } from "../ui/anim-kit";
import { useNarrowScreen, narrowFonts } from "./RuedaFonica";

const pot = (l: number) => (l < 0.88 ? 100 - 200 * (l - 0.88) ** 2 : 100 - 160 * (l - 0.88) ** 2);
const cons = (l: number) => (l < 1.08 ? 100 + 300 * (l - 1.08) ** 2 : 100 + 180 * (l - 1.08) ** 2);
const co = (l: number) => (l < 1 ? 0.4 + 30 * (1 - l) : 0.05 + 0.35 * Math.exp(-(l - 1) * 25));
const hc = (l: number) => (l < 1.12 ? 300 + 4000 * (l - 1.12) ** 2 : 300 + 30000 * (l - 1.12) ** 2);
const nox = (l: number) => 120 + 3100 * Math.exp(-(((l - 1.07) / (l < 1.07 ? 0.2 : 0.15)) ** 2));
// eficiencia de conversión de un catalizador de tres vías caliente
const effCO = (l: number) => (l >= 0.995 ? 0.98 : 0.98 * (0.2 + 0.8 * Math.exp(-(0.995 - l) / 0.012)));
const effHC = (l: number) => (l >= 0.99 ? 0.97 : 0.97 * (0.45 + 0.55 * Math.exp(-(0.99 - l) / 0.015)));
const effNOx = (l: number) => (l <= 1.002 ? 0.97 : Math.max(0.04, 0.97 * Math.exp(-(l - 1.002) / 0.008)));

const PRESETS = [
  { v: 0.8, label: "Arranque en frío" },
  { v: 0.88, label: "Plena carga" },
  { v: 1.0, label: "Ralentí y crucero" },
  { v: 1.1, label: "Pobre (economía)" },
];

export function MezclaLambda() {
  const narrow = useNarrowScreen();
  const svgId = "mezcla-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [lam, setLam] = useState(1.0);
  const [cat, setCat] = useState(false);

  const L0 = 0.7, L1 = 1.3;
  const X0 = 64, X1 = 700;
  const mx = (l: number) => X0 + ((l - L0) / (L1 - L0)) * (X1 - X0);
  // panel superior: potencia (70..102 %) y consumo (95..145 %)
  const PH = narrow ? 170 : 116; // alto de cada panel
  const T0y = 34, T1y = T0y + PH;
  const myP = (p: number) => T1y - ((p - 70) / 32) * (T1y - T0y);
  const myC = (c: number) => T1y - ((c - 95) / 50) * (T1y - T0y);
  // panel inferior: emisiones relativas (0..1)
  const B0y = T1y + 44, B1y = B0y + PH;
  const myE = (r: number) => B1y - r * (B1y - B0y);
  const coMax = co(0.7), hcMax = hc(1.3), noxMax = nox(1.07);
  const after = (f: (l: number) => number, e: (l: number) => number) => (l: number) => f(l) * (1 - e(l));
  const coF = cat ? after(co, effCO) : co;
  const hcF = cat ? after(hc, effHC) : hc;
  const noxF = cat ? after(nox, effNOx) : nox;
  const P = (fn: (l: number) => number, map: (v: number) => number) => plotPath(fn, L0, L1, 180, mx, map);

  const enVentana = lam >= 0.99 && lam <= 1.01;
  const zona = lam < 0.85 ? "Muy rica: humo negro, bujías carbonadas" : lam <= 0.9 ? "Máxima potencia (y nafta de más)" : lam < 0.99 ? "Rica" : enVentana ? "Ventana del catalizador" : lam < 1.05 ? "Levemente pobre: sube NOx" : lam <= 1.1 ? "Mínimo consumo (NOx alto)" : lam < 1.2 ? "Pobre: pierde potencia" : "Límite: fallas de encendido";

  return (
    <AnimFrame
      title="Qué cambia con la mezcla: potencia, consumo y gases"
      controls={
        <>
          <Slider label="λ" value={lam} min={0.7} max={1.3} step={0.01} onChange={setLam} format={(x) => fmt(x, 2)} />
          <Seg value={PRESETS.some((p) => p.v === lam) ? lam : -1} onChange={setLam} ariaLabel="Situaciones" options={PRESETS.map((p) => ({ value: p.v, label: p.label }))} />
          <Toggle label="Después del catalizador" checked={cat} onChange={setCat} />
        </>
      }
      readouts={
        <>
          <Readout label="Relación aire/nafta" value={`${fmt(14.7 * lam, 1)}:1`} />
          <Readout label="Potencia" value={fmt(pot(lam), 0)} unit="%" tone={pot(lam) > 98.5 ? "ok" : undefined} />
          <Readout label="Consumo específico" value={fmt(cons(lam), 0)} unit="%" tone={cons(lam) < 101.5 ? "ok" : cons(lam) > 115 ? "bad" : undefined} />
          <Readout label="CO" value={fmt(coF(lam), coF(lam) < 1 ? 2 : 1)} unit="%" tone={coF(lam) > 2 ? "bad" : undefined} />
          <Readout label="HC" value={fmt(hcF(lam), 0)} unit="ppm" />
          <Readout label="NOx" value={fmt(noxF(lam), 0)} unit="ppm" tone={noxF(lam) > 2000 ? "bad" : undefined} />
          <Readout label="Zona" value={<span style={{ fontSize: ".78rem" }}>{zona}</span>} tone={enVentana ? "ok" : "accent"} />
        </>
      }
      legend={[
        { color: "var(--accent)", label: "Potencia" },
        { color: "var(--primary)", label: "Consumo específico" },
        { color: "var(--c-exhaust)", label: "CO" },
        { color: "var(--warn)", label: "HC" },
        { color: "var(--bad)", label: "NOx" },
        { color: "var(--teal)", label: "Ventana del catalizador" },
      ]}
      caption={
        <>
          <p>
            Las curvas son <b>tendencias típicas</b> (cada motor tiene las suyas). La <b>máxima potencia</b> sale un poco rica
            (λ ≈ 0,85–0,9): sobra nafta, se aprovecha todo el oxígeno y la nafta extra enfría la cámara. El <b>mínimo consumo</b> está
            un poco pobre (λ ≈ 1,05–1,1), justo donde el <b>NOx</b> es máximo, porque hay calor y oxígeno de sobra.
          </p>
          <p>
            Activá <b>después del catalizador</b>: el de tres vías limpia los tres gases a la vez sólo en una ventana finita alrededor
            de λ = 1. Rico, no le alcanza el oxígeno para quemar CO y HC; pobre, no puede sacarle el oxígeno al NOx. Por eso la ECU
            vive en λ = 1 y por eso existe la sonda lambda.
          </p>
        </>
      }
    >
      <svg id={svgId} viewBox={`0 0 720 ${B1y + 40}`} style={narrow ? { overflow: "hidden" } : undefined} role="img" aria-label="Curvas de potencia, consumo y emisiones según lambda">
        {narrow && <style>{narrowFonts(svgId, 20, 22)}</style>}
        {/* bandas */}
        <rect x={mx(0.85)} y={T0y} width={mx(0.9) - mx(0.85)} height={T1y - T0y} fill="var(--accent)" opacity={0.12} />
        <rect x={mx(1.05)} y={T0y} width={mx(1.1) - mx(1.05)} height={T1y - T0y} fill="var(--primary)" opacity={0.12} />
        <rect x={mx(0.99)} y={T0y} width={mx(1.01) - mx(0.99)} height={B1y - T0y} fill="var(--teal)" opacity={0.22} />
        <text x={mx(0.875)} y={T0y - 8} textAnchor="middle" className="svg-small" style={{ fill: "var(--accent)" }}>máx. potencia</text>
        <text x={mx(1.075)} y={T0y - 8} textAnchor="middle" className="svg-small" style={{ fill: "var(--primary)" }}>mín. consumo</text>
        <text x={mx(1.0) + 6} y={B0y - 8} className="svg-small" style={{ fill: "var(--teal)", fontWeight: 700 }}>← ventana del catalizador</text>

        {/* panel superior */}
        <rect x={X0} y={T0y} width={X1 - X0} height={T1y - T0y} fill="none" stroke="var(--border)" />
        {!narrow && <text x={X0} y={T0y - 8} className="svg-title" style={{ fontSize: 12 }}>Potencia y consumo</text>}
        <path d={P(pot, myP)} fill="none" stroke="var(--accent)" strokeWidth={2.6} />
        <path d={P(cons, myC)} fill="none" stroke="var(--primary)" strokeWidth={2.6} />
        <text x={X0 - 6} y={myP(100) + 4} textAnchor="end" className="svg-small">100 %</text>
        <text x={X0 - 6} y={myP(80) + 4} textAnchor="end" className="svg-small">80 %</text>
        <text x={mx(0.73)} y={myC(cons(0.73)) - 8} className="svg-small" style={{ fill: "var(--primary)" }}>consumo ↑</text>
        <text x={mx(1.22)} y={myP(pot(1.22)) + 16} className="svg-small" style={{ fill: "var(--accent)" }}>potencia ↓</text>

        {/* panel inferior */}
        <rect x={X0} y={B0y} width={X1 - X0} height={B1y - B0y} fill="none" stroke="var(--border)" />
        {!narrow && <text x={X0} y={B0y - 8} className="svg-title" style={{ fontSize: 12 }}>{cat ? "Gases después del cat." : "Gases crudos"}</text>}
        {cat && (
          <g opacity={0.3}>
            <path d={P((l) => co(l) / coMax, myE)} fill="none" stroke="var(--c-exhaust)" strokeWidth={1.5} strokeDasharray="4 4" />
            <path d={P((l) => Math.min(1, hc(l) / hcMax), myE)} fill="none" stroke="var(--warn)" strokeWidth={1.5} strokeDasharray="4 4" />
            <path d={P((l) => nox(l) / noxMax, myE)} fill="none" stroke="var(--bad)" strokeWidth={1.5} strokeDasharray="4 4" />
          </g>
        )}
        <path d={P((l) => coF(l) / coMax, myE)} fill="none" stroke="var(--c-exhaust)" strokeWidth={2.6} />
        <path d={P((l) => Math.min(1, hcF(l) / hcMax), myE)} fill="none" stroke="var(--warn)" strokeWidth={2.6} />
        <path d={P((l) => noxF(l) / noxMax, myE)} fill="none" stroke="var(--bad)" strokeWidth={2.6} />
        {!cat && (
          <>
            <text x={mx(0.72)} y={myE(co(0.72) / coMax) + 16} className="svg-label" style={{ fill: "var(--c-exhaust)" }}>CO</text>
            <text x={mx(1.27)} y={myE(Math.min(1, hc(1.27) / hcMax)) + 2} textAnchor="end" className="svg-label" style={{ fill: "var(--warn)" }}>HC</text>
            <text x={mx(1.17) + 6} y={myE(nox(1.17) / noxMax) - 4} className="svg-label" style={{ fill: "var(--bad)" }}>NOx</text>
          </>
        )}
        <text x={X0 - 6} y={B0y + 26} textAnchor="end" className="svg-small">más</text>
        <text x={X0 - 6} y={B1y} textAnchor="end" className="svg-small">0</text>

        {/* eje λ */}
        {[0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3].map((l) => (
          <g key={l}>
            <line x1={mx(l)} y1={B1y} x2={mx(l)} y2={B1y + 5} stroke="var(--muted)" />
            <text x={mx(l)} y={B1y + 17} textAnchor="middle" className="svg-small">{fmt(l, 1)}</text>
            <line x1={mx(l)} y1={T1y} x2={mx(l)} y2={T1y + 5} stroke="var(--muted)" />
          </g>
        ))}
        <text x={X0} y={B1y + 33} className="svg-small" style={{ fill: "var(--c-fuel)" }}>← rica (falta aire)</text>
        <text x={X1} y={B1y + 33} textAnchor="end" className="svg-small" style={{ fill: "var(--c-air)" }}>pobre (sobra aire) →</text>
        <text x={mx(1.0)} y={B1y + 33} textAnchor="middle" className="svg-small">λ = 1 → 14,7:1</text>

        {/* cursor */}
        <line x1={mx(lam)} y1={T0y} x2={mx(lam)} y2={B1y} stroke="var(--text)" strokeWidth={1.5} opacity={0.6} />
        <circle cx={mx(lam)} cy={myP(pot(lam))} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        <circle cx={mx(lam)} cy={myC(cons(lam))} r={5} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} />
        <circle cx={mx(lam)} cy={myE(coF(lam) / coMax)} r={4.5} fill="var(--c-exhaust)" stroke="var(--surface)" strokeWidth={2} />
        <circle cx={mx(lam)} cy={myE(Math.min(1, hcF(lam) / hcMax))} r={4.5} fill="var(--warn)" stroke="var(--surface)" strokeWidth={2} />
        <circle cx={mx(lam)} cy={myE(noxF(lam) / noxMax)} r={4.5} fill="var(--bad)" stroke="var(--surface)" strokeWidth={2} />
      </svg>
    </AnimFrame>
  );
}
