/* Ensayo de tracción de un tornillo M10 clase 10.9. El slider es la fuerza; el punto recorre la curva
   tensión–deformación. Si pasás la fluencia y soltás, vuelve por una recta paralela a la elástica y queda
   estirado para siempre. Modo TTY: apriete por ángulo que entra apenas en la zona plástica. */
import { useEffect, useState } from "react";
import { AnimFrame, Readout, Slider, Toggle, Arrow, fmt, clamp } from "../ui/anim-kit";

const E = 210000; // MPa
const RP = 940; // límite elástico convencional Rp0,2 [MPa] (clase 10.9)
const RM = 1040; // resistencia a la tracción [MPa]
const NEXP = 32; // exponente de endurecimiento (Ramberg–Osgood)
const AS = 58; // sección resistente M10 [mm²]
const L0 = 100; // largo libre del tornillo [mm]
const FM = Math.floor((RM * AS) / 100) / 10; // fuerza máxima del slider [kN] (60,3)
const EPS_F = 0.09; // deformación a la rotura

const plastic = (s: number) => 0.002 * Math.pow(s / RP, NEXP);
const epsCurve = (s: number) => s / E + plastic(s);
const EPS_U = epsCurve(RM);
/** Inversa de la curva de carga (bisección). */
function sigOfEps(e: number) {
  if (e >= EPS_U) {
    const k = clamp((e - EPS_U) / (EPS_F - EPS_U), 0, 1);
    return RM - 160 * k * k;
  }
  let lo = 0, hi = RM;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (epsCurve(m) < e) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4, strokeLinejoin: "round" } as const;

export function CurvaTraccion() {
  const [F, setF] = useState(0); // kN
  const [sigMax, setSigMax] = useState(0);
  const [broken, setBroken] = useState(false);
  const [bp, setBp] = useState(0); // progreso de la rotura 0..1
  const [tty, setTty] = useState(false);
  const [uses, setUses] = useState(0);

  useEffect(() => {
    if (!broken) { setBp(0); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 1500);
      setBp(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [broken]);

  const onF = (v: number) => {
    if (broken) return;
    setF(v);
    const s = (v * 1000) / AS;
    if (s > sigMax) setSigMax(s);
    if (v >= FM - 1e-6) { setSigMax(RM); setBroken(true); }
  };
  const reset = () => { setBroken(false); setF(0); setSigMax(0); setUses(0); };
  const tighten = () => {
    if (broken) return;
    const target = plastic(sigMax) + 0.005;
    if (target >= plastic(RM)) { setF(FM); setSigMax(RM); setBroken(true); return; }
    const s = RP * Math.pow(target / 0.002, 1 / NEXP);
    setSigMax(s);
    setF((s * AS) / 1000);
    setUses((u) => u + 1);
  };

  // Estado actual
  const sigNow = (F * 1000) / AS;
  let eps: number, sig: number;
  if (broken) {
    eps = EPS_U + (EPS_F - EPS_U) * Math.min(1, bp / 0.75);
    sig = bp >= 0.75 ? 0 : sigOfEps(eps);
  } else if (sigNow >= sigMax - 1e-9) {
    sig = sigNow; eps = epsCurve(sig);
  } else {
    sig = sigNow; eps = epsCurve(sigMax) - (sigMax - sigNow) / E;
  }
  const perm = broken ? EPS_F : plastic(sigMax); // deformación permanente si soltás
  const state = broken
    ? { t: "Rotura", tone: "bad" as const }
    : perm < 0.0001
      ? { t: "Elástico", tone: "ok" as const }
      : sigNow >= sigMax - 1e-9 && sigNow > RP * 0.97
        ? { t: "Plástico", tone: "warn" as const }
        : { t: "Quedó estirado", tone: "warn" as const };

  // --- Gráfico
  const CX0 = 300, CX1 = 700, CY0 = 40, CY1 = 330;
  const CW = CX1 - CX0;
  // Escala lineal hasta 0,5 % (zona elástica) y logarítmica después, empalmada sin quiebre.
  const E0 = 0.005;
  const W0 = CW / (1 + Math.log(0.1 / E0));
  const mapE = (e: number) => CX0 + (e <= E0 ? (e / E0) * W0 : W0 * (1 + Math.log(e / E0)));
  const invX = (x: number) => { const u = (x - CX0) / W0; return u <= 1 ? u * E0 : E0 * Math.exp(u - 1); };
  const mapS = (s: number) => CY1 - (s / 1200) * (CY1 - CY0);
  let curve = "";
  for (let i = 0; i <= 220; i++) {
    const x = CX0 + (i / 220) * (mapE(EPS_F) - CX0);
    const e = invX(x);
    curve += `${i ? "L" : "M"}${x.toFixed(1)},${mapS(sigOfEps(e)).toFixed(1)}`;
  }
  // recta de descarga desde el máximo alcanzado
  let unload = "";
  if (!broken && perm >= 0.0001) {
    for (let i = 0; i <= 30; i++) {
      const s = sigMax * (1 - i / 30);
      const e = epsCurve(sigMax) - (sigMax - s) / E;
      unload += `${i ? "L" : "M"}${mapE(e).toFixed(1)},${mapS(s).toFixed(1)}`;
    }
  }
  const segAlong = (s0: number, s1: number) => {
    let d = "";
    for (let i = 0; i <= 20; i++) {
      const s = s0 + ((s1 - s0) * i) / 20;
      d += `${i ? "L" : "M"}${mapE(epsCurve(s)).toFixed(1)},${mapS(s).toFixed(1)}`;
    }
    return d;
  };
  const ttyS0 = RP * Math.pow(0.002 / 0.002, 1 / NEXP), ttyS1 = RP * Math.pow(0.006 / 0.002, 1 / NEXP);

  // --- Tornillo (izquierda): estiramiento dibujado exagerado
  const BX = 130, TOPY = 86, BASE = 140;
  const stretchPx = ((mapE(Math.min(eps, EPS_F)) - CX0) / CW) * 60;
  const shankLen = BASE + stretchPx;
  const botY = TOPY + shankLen;
  const neck = broken ? Math.min(1, bp / 0.75) : 0;
  const gap = broken && bp > 0.75 ? ((bp - 0.75) / 0.25) * 22 : 0;
  const ym = TOPY + shankLen * 0.55;
  const w = 15;
  const edge = (y: number) => w * (1 - 0.55 * neck * Math.exp(-(((y - ym) / 16) ** 2)));
  const half = (side: 1 | -1, y0: number, y1: number) => {
    let d = "";
    for (let i = 0; i <= 24; i++) {
      const y = y0 + ((y1 - y0) * i) / 24;
      d += `${i ? "L" : "M"}${(BX + side * edge(y)).toFixed(1)},${y.toFixed(1)}`;
    }
    return d;
  };
  const shankPath = (y0: number, y1: number, dy: number) => {
    const l = half(-1, y0, y1);
    const r = half(1, y1, y0).replace(/^M/, "L");
    return <path d={`${l} ${r} Z`} transform={`translate(0 ${dy})`} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />;
  };
  const arrowLen = 14 + (F / FM) * 34;

  return (
    <AnimFrame
      title="Ensayo de tracción: estirá un tornillo hasta romperlo"
      controls={
        <>
          <Slider label="Fuerza" value={F} min={0} max={FM} step={0.1} onChange={onF} format={(v) => `${fmt(v, 1)} kN`} width={190} />
          <button className="btn ghost sm" onClick={() => onF(0)} disabled={broken}>Soltar</button>
          <button className="btn ghost sm" onClick={reset}>Tornillo nuevo</button>
          <Toggle label="Tornillo TTY" checked={tty} onChange={setTty} />
          {tty && <button className="btn accent sm" onClick={tighten} disabled={broken}>Apretar como TTY (torque + ángulo)</button>}
        </>
      }
      readouts={
        <>
          <Readout label="Fuerza" value={fmt(broken ? 0 : F, 1)} unit="kN" />
          <Readout label="Tensión" value={fmt(sig, 0)} unit="MPa" />
          <Readout label="Deformación" value={fmt(eps * 100, 2)} unit="%" />
          <Readout label="Se estiró" value={fmt(eps * L0, 2)} unit="mm" tone="accent" />
          <Readout label="Si soltás queda" value={broken ? "roto" : fmt(perm * L0, 2)} unit={broken ? undefined : "mm"} tone={perm >= 0.0001 ? "warn" : "ok"} />
          <Readout label="Estado" value={state.t} tone={state.tone} />
          {tty && <Readout label="Aprietes TTY" value={uses} />}
        </>
      }
      legend={[
        { color: "var(--primary)", label: "Curva tensión–deformación (acero 10.9)" },
        { color: "var(--accent)", label: "Dónde está el tornillo ahora" },
        { color: "var(--warn)", label: "Camino de vuelta al soltar" },
        ...(tty ? [{ color: "var(--ok)", label: "Apriete común (por torque)" }, { color: "var(--violet)", label: "Apriete TTY (torque + ángulo)" }] : []),
      ]}
      caption={
        <>
          <p>
            Subí la fuerza despacio. Hasta unos {fmt((RP * AS) / 1000 * 0.95, 0)} kN el punto sube por la <b>recta de Hooke</b>: el tornillo se
            estira como un resorte (décimas de milímetro) y si soltás, <b>vuelve exacto</b>. Al pasar el límite elástico (≈ {RP} MPa) la curva
            se acuesta: con muy poca fuerza más, se estira mucho. Soltá ahí y vas a ver que vuelve por la recta naranja y{" "}
            <b>queda más largo para siempre</b>. Si llegás a la resistencia máxima ({RM} MPa ≈ {fmt(FM, 1)} kN), se forma un cuello y se corta.
          </p>
          <p>
            Prendé <b>Tornillo TTY</b>: los tornillos de tapa de cilindros modernos se aprietan "a torque + ángulo" justo hasta la zona
            violeta, apenas pasada la fluencia. Apretá, soltá y volvé a apretar: cada uso lo deja más largo y más cerca del final de la curva.
            Por eso <b>no se reutilizan</b>. (Estiramiento del dibujo exagerado; en el gráfico, la escala de deformación se comprime después de 0,5 %.)
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 380" role="img" aria-label="Tornillo en ensayo de tracción y curva tensión deformación">
        {/* Máquina: travesaño fijo y mordaza superior */}
        <rect x={40} y={34} width={180} height={18} rx={3} fill="var(--c-metal-dark)" />
        <rect x={BX - 34} y={52} width={68} height={22} fill="var(--c-metal-2)" />
        <rect x={BX - 26} y={66} width={52} height={20} rx={3} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        <text x={BX + 44} y={70} className="svg-small">mordaza fija</text>
        {/* Caña del tornillo */}
        {gap > 0 ? (
          <>
            {shankPath(TOPY, ym, -gap / 2)}
            {shankPath(ym, botY, gap / 2)}
          </>
        ) : (
          shankPath(TOPY, botY, 0)
        )}
        {/* zona roscada abajo */}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={i} x1={BX - w} y1={botY - 40 + i * 6 + gap / 2} x2={BX + w} y2={botY - 44 + i * 6 + gap / 2} stroke="var(--c-metal-dark)" strokeWidth={1.2} />
        ))}
        {/* Mordaza inferior que tira */}
        <g transform={`translate(0 ${gap / 2})`}>
          <rect x={BX - 30} y={botY} width={60} height={20} rx={3} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)" />
          <rect x={40} y={botY + 20} width={180} height={16} rx={3} fill="var(--c-metal-dark)" />
          {!broken && F > 0.2 && <Arrow x1={BX} y1={botY + 40} x2={BX} y2={botY + 40 + arrowLen} color="var(--accent)" width={4} head={12} />}
        </g>
        {/* referencia de largo original */}
        <line x1={BX - 52} y1={TOPY} x2={BX - 52} y2={TOPY + BASE} stroke="var(--muted)" strokeWidth={1} />
        <line x1={BX - 58} y1={TOPY + BASE} x2={BX - 46} y2={TOPY + BASE} stroke="var(--muted)" />
        <text x={BX - 56} y={TOPY + BASE + 16} textAnchor="middle" className="svg-small">largo</text>
        <text x={BX - 56} y={TOPY + BASE + 29} textAnchor="middle" className="svg-small">original</text>
        {gap > 0 && <text x={BX + 30} y={ym + 4} className="svg-label" style={{ ...HALO, fill: "var(--bad)" }}>¡Se cortó!</text>}
        {neck > 0.2 && gap === 0 && <text x={BX + 24} y={ym + 4} className="svg-small" style={HALO}>cuello (estricción)</text>}
        <text x={40} y={22} className="svg-small">M10 clase 10.9 · sección 58 mm² · largo 100 mm</text>

        {/* Gráfico */}
        <rect x={CX0} y={CY0} width={mapE(epsCurve(RP)) - CX0} height={CY1 - CY0} fill="var(--ok)" opacity={0.07} />
        <rect x={mapE(epsCurve(RP))} y={CY0} width={mapE(EPS_U) - mapE(epsCurve(RP))} height={CY1 - CY0} fill="var(--warn)" opacity={0.07} />
        <rect x={mapE(EPS_U)} y={CY0} width={mapE(EPS_F) - mapE(EPS_U)} height={CY1 - CY0} fill="var(--bad)" opacity={0.07} />
        <text x={CX0 + 6} y={CY0 + 14} className="svg-small" style={{ fill: "var(--ok)" }}>elástica</text>
        <text x={mapE(epsCurve(RP)) + 6} y={CY0 + 14} className="svg-small" style={{ fill: "var(--warn)" }}>plástica</text>
        <text x={mapE(EPS_U) + 4} y={CY0 + 14} className="svg-small" style={{ fill: "var(--bad)" }}>cuello y rotura</text>
        <line x1={CX0} y1={CY1} x2={CX1} y2={CY1} stroke="var(--border-strong)" />
        <line x1={CX0} y1={CY0} x2={CX0} y2={CY1} stroke="var(--border-strong)" />
        {/* desde 0,5 % la escala se comprime */}
        <line x1={mapE(E0)} y1={CY0 + 22} x2={mapE(E0)} y2={CY1} stroke="var(--border-strong)" strokeDasharray="2 4" />
        {[0, 0.0025, 0.005, 0.01, 0.02, 0.05, 0.09].map((e) => (
          <g key={e}>
            <line x1={mapE(e)} y1={CY1} x2={mapE(e)} y2={CY1 + 4} stroke="var(--muted)" />
            <text x={mapE(e)} y={CY1 + 16} textAnchor="middle" className="svg-small">{fmt(e * 100, e < 0.01 && e > 0 ? (e === 0.005 ? 1 : 2) : 0)}</text>
          </g>
        ))}
        <text x={CX1} y={CY1 + 32} textAnchor="end" className="svg-small">deformación [%] (escala comprimida después de 0,5 %)</text>
        {[0, 300, 600, 900, 1200].map((s) => (
          <g key={s}>
            <text x={CX0 - 6} y={mapS(s) + 4} textAnchor="end" className="svg-small">{s}</text>
            <line x1={CX0} y1={mapS(s)} x2={CX1} y2={mapS(s)} stroke="var(--border)" strokeDasharray="2 5" />
          </g>
        ))}
        <text x={CX0 - 6} y={CY0 - 10} className="svg-small">tensión σ [MPa]</text>
        <line x1={CX0} y1={mapS(RP)} x2={CX1} y2={mapS(RP)} stroke="var(--warn)" strokeDasharray="5 4" opacity={0.7} />
        <text x={CX1 - 4} y={mapS(RP) + 14} textAnchor="end" className="svg-small" style={{ fill: "var(--warn)" }}>límite elástico Rp0,2 = {RP} MPa</text>
        <text x={CX1 - 4} y={mapS(RM) - 6} textAnchor="end" className="svg-small" style={{ fill: "var(--bad)" }}>Rm = {RM} MPa</text>
        <path d={curve} fill="none" stroke="var(--primary)" strokeWidth={2.6} />
        {tty && (
          <>
            <path d={segAlong(RP * 0.7, RP * 0.9)} fill="none" stroke="var(--ok)" strokeWidth={9} strokeLinecap="round" opacity={0.55} />
            <text x={mapE(epsCurve(RP * 0.8)) + 10} y={mapS(RP * 0.8) + 4} className="svg-small" style={{ ...HALO, fill: "var(--ok)" }}>apriete común</text>
            <path d={segAlong(ttyS0, ttyS1)} fill="none" stroke="var(--violet)" strokeWidth={9} strokeLinecap="round" opacity={0.55} />
            <text x={mapE(epsCurve(ttyS1)) + 6} y={mapS(ttyS1) + 22} className="svg-small" style={{ ...HALO, fill: "var(--violet)" }}>TTY</text>
          </>
        )}
        {unload && <path d={unload} fill="none" stroke="var(--warn)" strokeWidth={2} strokeDasharray="6 4" />}
        {!broken && perm >= 0.0001 && (
          <text x={mapE(perm)} y={CY1 - 8} textAnchor="middle" className="svg-small" style={{ ...HALO, fill: "var(--warn)" }}>queda {fmt(perm * L0, 2)} mm</text>
        )}
        {broken && bp >= 0.75 ? (
          <text x={mapE(EPS_F)} y={mapS(sigOfEps(EPS_F)) + 5} textAnchor="middle" className="svg-title" style={{ fill: "var(--bad)" }}>✕</text>
        ) : (
          <circle cx={mapE(eps)} cy={mapS(sig)} r={7} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        )}
      </svg>
    </AnimFrame>
  );
}
