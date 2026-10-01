/* Tubo Venturi y carburador. Continuidad (A·v = cte) acelera el aire en la garganta y Bernoulli baja la presión.
   Vista "Carburador": la depresión de la garganta levanta la nafta de la cuba por el surtidor; con la altura el aire
   es menos denso y la mezcla se enriquece. */
import { useMemo, useState } from "react";
import { AnimFrame, Readout, Seg, Slider, useAnimClock, fmt, clamp } from "../ui/anim-kit";

const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4, strokeLinejoin: "round" } as const;
const RHO_F = 740; // nafta [kg/m³]
const G = 9.81;
const H_NOZ = 0.008; // el pico del surtidor está 8 mm por encima del nivel de la cuba
const CD_AJ = 1.96e-6; // Cd × área del chicler [m²] (≈ Ø 1,9 mm con Cd 0,7; modelo simplificado)
const rhoAir = (h: number) => 1.225 * Math.pow(1 - 2.2558e-5 * h, 4.2559);

// geometría del dibujo (px)
const X0 = 24, XC0 = 180, XT0 = 280, XT1 = 340, XD1 = 560, X1 = 696, CY = 150, PXMM = 1.8;
const smooth = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(u, 0, 1));

// pseudo-aleatorio fijo para las partículas
const RND = Array.from({ length: 64 }, (_, i) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
});

export function Venturi() {
  const clock = useAnimClock({ speed: 0.5 });
  const [mode, setMode] = useState<"tubo" | "carb">("tubo");
  const [Q, setQ] = useState(20); // L/s
  const [dT, setDT] = useState(30); // mm (vista tubo)
  const [alt, setAlt] = useState(750); // m (vista carburador)

  const D1 = mode === "tubo" ? 60 : 40; // mm
  const D2 = mode === "tubo" ? dT : 28;
  const rho = mode === "tubo" ? 1.2 : rhoAir(alt);
  const H1 = (D1 / 2) * PXMM, H2 = (D2 / 2) * PXMM;
  const half = (x: number) => {
    if (x < XC0) return H1;
    if (x < XT0) return H1 + (H2 - H1) * smooth((x - XC0) / (XT0 - XC0));
    if (x < XT1) return H2;
    if (x < XD1) return H2 + (H1 - H2) * smooth((x - XT1) / (XD1 - XT1));
    return H1;
  };
  const q = Q / 1000; // m³/s
  const A1 = (Math.PI / 4) * (D1 / 1000) ** 2, A2 = (Math.PI / 4) * (D2 / 1000) ** 2;
  const v1 = q / A1, v2 = q / A2;
  const vAt = (x: number) => v1 * (H1 / half(x)) ** 2;
  const dyn = (v: number) => 0.5 * rho * v * v;
  const loss = 0.15 * (dyn(v2) - dyn(v1)); // pérdida en el difusor
  const pIn = loss;
  const pStat = (x: number) => {
    const base = pIn + dyn(v1) - dyn(vAt(x));
    if (x <= XT1) return base;
    if (x < XD1) return base - loss * smooth((x - XT1) / (XD1 - XT1));
    return 0;
  };
  // en el carburador el aire entra desde la atmósfera: la presión se mide respecto de ella (la cuba también está a presión atmosférica)
  const ps = mode === "tubo" ? pStat : (x: number) => -dyn(vAt(x));
  const dpThroat = mode === "tubo" ? pIn - pStat(XT0 + 30) : dyn(v2);
  const mmH2O = dpThroat / (1000 * G) * 1000;

  // carburador
  const thr = RHO_F * G * H_NOZ;
  const mAir = rho * q; // kg/s
  const mFuel = dpThroat > thr ? CD_AJ * Math.sqrt(2 * RHO_F * (dpThroat - thr)) : 0;
  const afr = mFuel > 0 ? mAir / mFuel : Infinity;
  const lambda = afr / 14.7;
  const airLoss = (1 - rho / 1.225) * 100;

  // tabla tiempo ↔ posición para mover partículas con la velocidad local
  const vScale = Math.min(7, 480 / Math.max(v2, 0.1));
  const table = useMemo(() => {
    const xs: number[] = [], ts: number[] = [];
    let t = 0;
    for (let x = X0; x <= X1; x += 2) {
      xs.push(x); ts.push(t);
      t += 2 / (vScale * vAt(x + 1));
    }
    return { xs, ts, T: t };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Q, D1, D2, vScale]);
  const xAtTime = (tt: number) => {
    const { xs, ts } = table;
    let lo = 0, hi = ts.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] <= tt) lo = m; else hi = m; }
    const f = (tt - ts[lo]) / Math.max(1e-9, ts[hi] - ts[lo]);
    return xs[lo] + (xs[hi] - xs[lo]) * clamp(f, 0, 1);
  };
  const T = table.T;
  const t = clock.t;

  // contorno del tubo
  let top = "", bot = "";
  for (let x = X0; x <= X1; x += 4) {
    top += `${x === X0 ? "M" : "L"}${x},${(CY - half(x)).toFixed(1)}`;
    bot = `L${x},${(CY + half(x)).toFixed(1)}` + bot;
  }
  const outline = `${top} ${bot.replace(/^L/, "L")} Z`;
  // franjas de color según presión estática
  const pMin = ps((XT0 + XT1) / 2), pMax = ps(X0 + 2);
  const slices = [];
  for (let x = X0; x < X1; x += 8) {
    const pr = clamp((ps(x + 4) - pMin) / Math.max(1e-6, pMax - pMin), 0, 1); // 1 = alta, 0 = baja
    slices.push(
      <rect key={x} x={x} y={CY - half(x + 4)} width={8.5} height={2 * half(x + 4)}
        style={{ fill: `color-mix(in srgb, var(--c-air) ${Math.round(18 + 50 * pr)}%, color-mix(in srgb, var(--accent) ${Math.round(55 * (1 - pr))}%, var(--surface)))` }} />,
    );
  }
  const particles = Array.from({ length: 34 }, (_, i) => {
    const tt = (t + RND[i] * T) % T;
    const x = xAtTime(tt);
    const yf = (RND[i + 30] - 0.5) * 1.7;
    return <circle key={i} cx={x} cy={CY + yf * half(x)} r={2.6} fill="var(--c-air)" opacity={0.9} />;
  });

  // barras de presión estática (escala automática, con valores)
  const stations = mode === "tubo" ? [100, 230, 310, 430, 520, 640] : [100, 230, 310];
  const pScale = Math.max(1, Math.max(Math.abs(pMin), Math.abs(pMax)));
  const BZ = 46;

  // chart (vista tubo)
  const GY0 = 252, GY1 = 372;
  const pTop = pIn + dyn(v1);
  const lo = Math.min(pMin, 0) * 1.15, hi = Math.max(pTop, dyn(v2) * 0.2) * 1.25;
  const my = (pp: number) => GY1 - ((pp - lo) / (hi - lo)) * (GY1 - GY0);
  const pathOf = (fn: (x: number) => number) => {
    let d = "";
    for (let x = X0; x <= X1; x += 4) d += `${x === X0 ? "M" : "L"}${x},${my(fn(x)).toFixed(1)}`;
    return d;
  };

  // carburador
  const NX = (XT0 + XT1) / 2; // surtidor en la garganta
  const BOWL = { x: NX - 70, y: 266, w: 140, h: 78 };
  const fuelY = BOWL.y + 26;
  const nozTop = CY;
  const rise = clamp(dpThroat / thr, 0, 1);
  const fuelFrac = clamp(mFuel / 0.004, 0, 1);
  const throttleAng = 78 - ((Q - 2) / 48) * 72; // grados respecto del eje (90 = cerrada)
  const drops = mode === "carb" && mFuel > 0
    ? Array.from({ length: 22 }, (_, i) => {
        if (i / 22 > 0.25 + 0.75 * fuelFrac) return null;
        const life = 0.9;
        const age = ((t + RND[i + 5] * life) % life);
        const t0 = table.ts[Math.round((NX - X0) / 2)];
        const x = xAtTime(Math.min(T - 1e-6, t0 + age * 0.7));
        const y = nozTop + (RND[i + 12] - 0.5) * 2 * Math.min(half(x) * 0.8, 6 + age * 60);
        return <circle key={i} cx={x} cy={y} r={2.2 - age * 1.2} fill="var(--c-fuel)" opacity={1 - age} />;
      })
    : null;

  return (
    <AnimFrame
      title={mode === "tubo" ? "Efecto Venturi: donde el aire acelera, la presión baja" : "El carburador: la depresión del Venturi chupa la nafta"}
      clock={clock}
      controls={
        <>
          <Seg value={mode} onChange={setMode} options={[{ value: "tubo", label: "Tubo Venturi" }, { value: "carb", label: "Carburador" }]} ariaLabel="Vista" />
          <Slider label={mode === "tubo" ? "Caudal de aire" : "Acelerador (caudal)"} value={Q} min={2} max={50} step={1} onChange={setQ} unit="L/s" />
          {mode === "tubo" ? (
            <Slider label="Ø garganta" value={dT} min={22} max={50} step={1} onChange={setDT} unit="mm" />
          ) : (
            <Slider label="Altura" value={alt} min={0} max={3200} step={50} onChange={setAlt} unit="m" />
          )}
        </>
      }
      readouts={
        mode === "tubo" ? (
          <>
            <Readout label="Velocidad entrada" value={fmt(v1, 1)} unit="m/s" />
            <Readout label="Velocidad garganta" value={fmt(v2, 1)} unit="m/s" tone="accent" />
            <Readout label="Caída de presión" value={fmt(dpThroat / 100, 1)} unit="mbar" tone="warn" />
            <Readout label="En columna de agua" value={fmt(mmH2O, 0)} unit="mm" />
            <Readout label="Relación de áreas" value={`×${fmt(A1 / A2, 1)}`} />
          </>
        ) : (
          <>
            <Readout label="Densidad del aire" value={fmt(rho, 2)} unit="kg/m³" />
            <Readout label="Depresión en garganta" value={fmt(dpThroat / 100, 1)} unit="mbar" tone="warn" />
            <Readout label="Aire" value={fmt(mAir * 1000, 1)} unit="g/s" />
            <Readout label="Nafta" value={fmt(mFuel * 1000, 2)} unit="g/s" tone="accent" />
            <Readout label="Mezcla aire/nafta" value={Number.isFinite(afr) ? `${fmt(afr, 1)}:1` : "no tira"} tone={!Number.isFinite(afr) ? "bad" : lambda < 0.8 ? "warn" : "ok"} />
            <Readout label="Lambda" value={Number.isFinite(lambda) ? fmt(lambda, 2) : "—"} />
            <Readout label="Aire vs nivel del mar" value={`−${fmt(airLoss, 0)}`} unit="%" />
          </>
        )
      }
      legend={
        mode === "tubo"
          ? [
              { color: "var(--c-air)", label: "Aire (más azul = más presión)" },
              { color: "var(--accent)", label: "Zona de baja presión" },
              { color: "var(--primary)", label: "Presión estática" },
              { color: "var(--warn)", label: "Presión dinámica (½·ρ·v²)" },
            ]
          : [
              { color: "var(--c-air)", label: "Aire" },
              { color: "var(--c-fuel)", label: "Nafta" },
            ]
      }
      caption={
        mode === "tubo" ? (
          <>
            <p>
              Por el tubo pasa el mismo caudal en todos lados (lo que entra, sale). Si la sección se achica {fmt(A1 / A2, 1)} veces, el aire{" "}
              <b>tiene que ir {fmt(A1 / A2, 1)} veces más rápido</b>: fijate cómo se aceleran las partículas en la garganta. Para acelerar
              necesita energía, y la saca de su presión: en la garganta la presión cae <b>{fmt(dpThroat / 100, 1)} mbar</b>.
            </p>
            <p>
              En el gráfico de abajo, la presión estática (azul) baja justo donde sube la dinámica (naranja): su suma (línea punteada) se
              mantiene, eso es <b>Bernoulli</b>. En el difusor el aire frena y recupera casi toda la presión; lo que no recupera es la
              <b> pérdida de carga</b>. Duplicá el caudal: la caída de presión se multiplica por cuatro (va con v²).
            </p>
          </>
        ) : (
          <>
            <p>
              La cuba está a presión atmosférica y el pico del surtidor asoma en la garganta. Cuando el aire pasa rápido, la depresión levanta
              la nafta por el surtidor; si supera los ≈ {fmt(thr, 0)} Pa que hacen falta para subirla {H_NOZ * 1000} mm, sale pulverizada y se
              mezcla con el aire. Bajá el caudal a 2–5 L/s (ralentí): <b>el surtidor principal no tira</b>, por eso los carburadores tienen un
              circuito de ralentí aparte.
            </p>
            <p>
              Ahora subí la altura: el aire es menos denso, entra menos masa (menos potencia) pero la nafta casi no cambia. La mezcla{" "}
              <b>se enriquece</b>: en Uspallata o en el Cristo Redentor un auto a carburador regulado en Buenos Aires anda "ahogado" y humea
              negro. La inyección electrónica lo corrige sola midiendo la presión del aire.
            </p>
          </>
        )
      }
    >
      <svg viewBox={`0 0 720 ${mode === "tubo" ? 400 : 360}`} role="img" aria-label="Tubo Venturi con partículas de aire">
        {/* tubo */}
        {slices}
        {particles}
        <path d={outline} fill="none" stroke="var(--c-metal-dark)" strokeWidth={3} />
        <text x={X0 + 6} y={CY + H1 + 18} className="svg-small">Ø {D1} mm</text>
        <text x={(XT0 + XT1) / 2} y={CY + H2 + 16 + (mode === "carb" ? 0 : 0)} textAnchor="middle" className="svg-small" style={HALO}>
          {mode === "carb" ? "" : `Ø ${D2} mm`}
        </text>
        <text x={X1 - 6} y={CY + H1 + 18} textAnchor="end" className="svg-small">→ sale</text>

        {/* barras de presión estática */}
        <line x1={X0} y1={BZ} x2={mode === "tubo" ? X1 : 360} y2={BZ} stroke="var(--border-strong)" strokeDasharray="3 4" />
        <text x={X0} y={BZ - 34} className="svg-small">{mode === "tubo" ? "presión estática (respecto de la salida)" : "presión estática (respecto de la atmósfera)"}</text>
        {stations.map((sx) => {
          const pp = ps(sx);
          const h = (pp / pScale) * 26;
          return (
            <g key={sx}>
              <line x1={sx} y1={BZ} x2={sx} y2={CY - half(sx)} stroke="var(--border)" strokeDasharray="2 3" />
              <rect x={sx - 7} y={h >= 0 ? BZ - h : BZ} width={14} height={Math.max(1, Math.abs(h))} rx={2} fill={pp >= 0 ? "var(--primary)" : "var(--accent)"} />
              <text x={sx + 11} y={h >= 0 ? BZ - Math.max(h, 0) + 9 : BZ + Math.abs(h) - 1} className="svg-small" style={{ ...HALO, fontSize: 9.5 }}>
                {pp >= 0 ? "+" : "−"}{fmt(Math.abs(pp) / 100, 1)}
              </text>
            </g>
          );
        })}
        <text x={mode === "tubo" ? X1 : 360} y={BZ - 34} textAnchor="end" className="svg-small">mbar</text>

        {mode === "tubo" ? (
          <>
            <line x1={X0} y1={my(0)} x2={X1} y2={my(0)} stroke="var(--border-strong)" />
            <text x={X0} y={GY0 - 12} className="svg-label">Presiones a lo largo del tubo</text>
            <path d={pathOf((x) => pStat(x) + dyn(vAt(x)))} fill="none" stroke="var(--text)" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.6} />
            <path d={pathOf((x) => dyn(vAt(x)))} fill="none" stroke="var(--warn)" strokeWidth={2.4} />
            <path d={pathOf(pStat)} fill="none" stroke="var(--primary)" strokeWidth={2.6} />
            <text x={X1} y={my(pTop) - 6} textAnchor="end" className="svg-small">total = estática + dinámica</text>
            <text x={X1} y={my(0) + 13} textAnchor="end" className="svg-small">0 (presión de salida)</text>
            <text x={(XT0 + XT1) / 2} y={my(pMin) + 16} textAnchor="middle" className="svg-small" style={{ ...HALO, fill: "var(--primary)" }}>
              −{fmt(Math.abs(pMin) / 100, 1)} mbar
            </text>
          </>
        ) : (
          <>
            {/* mariposa */}
            <g transform={`rotate(${-throttleAng} 470 ${CY})`}>
              <line x1={470 - half(470) + 3} y1={CY} x2={470 + half(470) - 3} y2={CY} stroke="var(--c-metal-dark)" strokeWidth={4} strokeLinecap="round" />
            </g>
            <circle cx={470} cy={CY} r={3.5} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" />
            <text x={470} y={CY + H1 + 18} textAnchor="middle" className="svg-small">mariposa</text>
            <text x={X1 - 6} y={CY - H1 - 8} textAnchor="end" className="svg-small">al múltiple de admisión</text>
            {/* cuba */}
            <rect x={BOWL.x} y={BOWL.y} width={BOWL.w} height={BOWL.h} rx={6} fill="var(--surface)" stroke="var(--c-metal-dark)" strokeWidth={2} />
            <rect x={BOWL.x + 2} y={fuelY} width={BOWL.w - 4} height={BOWL.y + BOWL.h - fuelY - 2} fill="var(--c-fuel)" opacity={0.55} />
            <rect x={BOWL.x + 14} y={fuelY - 12} width={44} height={20} rx={8} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" />
            <text x={BOWL.x + 36} y={fuelY + 2} textAnchor="middle" className="svg-small" style={{ fontSize: 9 }}>boya</text>
            <line x1={BOWL.x + 36} y1={fuelY - 12} x2={BOWL.x + 36} y2={BOWL.y - 2} stroke="var(--c-metal-dark)" strokeWidth={2} />
            <path d={`M${BOWL.x + 36},${BOWL.y - 2} L${BOWL.x + 36},${BOWL.y - 14} L${BOWL.x - 30},${BOWL.y - 14}`} fill="none" stroke="var(--c-fuel)" strokeWidth={4} opacity={0.7} />
            <text x={BOWL.x - 34} y={BOWL.y - 20} textAnchor="end" className="svg-small">de la bomba de nafta</text>
            <text x={BOWL.x + BOWL.w + 8} y={BOWL.y + 20} className="svg-small">cuba</text>
            <text x={BOWL.x + BOWL.w + 8} y={BOWL.y + 34} className="svg-small">(a presión atmosférica)</text>
            {/* surtidor (tubito) */}
            <rect x={NX - 4} y={nozTop} width={8} height={fuelY + 8 - nozTop} fill="var(--surface)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
            <rect x={NX - 2.5} y={fuelY - (fuelY - nozTop) * rise} width={5} height={(fuelY - nozTop) * rise + 8} fill="var(--c-fuel)" />
            <text x={NX + 12} y={BOWL.y - 34} className="svg-small" style={HALO}>surtidor (chicler abajo)</text>
            {drops}
            {mFuel === 0 && (
              <text x={NX} y={CY - H1 - 10} textAnchor="middle" className="svg-label" style={{ ...HALO, fill: "var(--bad)" }}>
                El surtidor no tira: falta depresión
              </text>
            )}
          </>
        )}
      </svg>
    </AnimFrame>
  );
}
