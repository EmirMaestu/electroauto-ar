/* Gas encerrado en un cilindro (válvulas cerradas) que el pistón comprime y deja expandir.
   Politrópica p·Vⁿ = cte  →  p = p₁·(V₁/V)ⁿ ,  T = T₁·(V₁/V)ⁿ⁻¹
   n = 1: lento, el calor se escapa (isotérmico). n = 1,4: tan rápido que no se escapa nada
   (adiabático ideal). Un motor real anda cerca de n ≈ 1,35. */
import { useMemo, useRef, useState } from "react";
import { AnimFrame, Readout, Seg, Slider, Toggle, useAnimClock, plotPath, fmt, TAU, Arrow } from "../ui/anim-kit";
import { crankKinematics } from "./Biela";

type Proc = "iso" | "real" | "adi";
const PROC: Record<Proc, { n: number; label: string; color: string }> = {
  iso: { n: 1, label: "Lento (isotérmico)", color: "var(--c-air)" },
  real: { n: 1.35, label: "Rápido, motor real (n ≈ 1,35)", color: "var(--accent)" },
  adi: { n: 1.4, label: "Ideal adiabático (κ = 1,4)", color: "var(--bad)" },
};
const VH = 500;            // cm³: un cilindro de un 2.0 de 4 cilindros
const RK = 45, LK = 145;   // mm: manivela y biela (sólo para el movimiento)

export function GasIdeal() {
  const clock = useAnimClock({ speed: 1 });
  const [proc, setProc] = useState<Proc>("real");
  const [eps, setEps] = useState(18);
  const [tIn, setTIn] = useState(20);
  const [mza, setMza] = useState(false);
  const acc = useRef({ t: 0, psi: 0 });

  const n = PROC[proc].n;
  const p1 = mza ? 0.925 : 1.013;  // bar
  const T1 = tIn + 273.15;
  const Vc = VH / (eps - 1);
  const V1 = VH + Vc;

  const theta = clock.t * TAU * 0.22 + Math.PI; // arranca en el PMI
  const k = crankKinematics(theta, RK, LK);
  const frac = k.x / (2 * RK);                  // 0 en PMS, 1 en PMI
  const V = Vc + VH * frac;
  const r = V1 / V;
  const p = p1 * r ** n;
  const T = T1 * r ** (n - 1);
  const Tc = T - 273.15;
  const compressing = Math.sin(theta) < 0;      // de PMI a PMS (θ entre π y 2π)

  // fase de las moléculas: avanzan más rápido cuanto más caliente (v ∝ √T)
  if (clock.t < acc.current.t) acc.current = { t: clock.t, psi: 0 };
  acc.current.psi += (clock.t - acc.current.t) * Math.sqrt(T / 293);
  acc.current.t = clock.t;
  const psi = acc.current.psi;
  const mol = useMemo(() => {
    let s = 3;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 34 }, () => ({ u: rnd(), v: rnd(), vu: 0.25 + rnd() * 0.5, vv: 0.25 + rnd() * 0.5 }));
  }, []);
  const tri = (x: number) => { const f = ((x % 2) + 2) % 2; return f > 1 ? 2 - f : f; };

  /* cilindro */
  const CX0 = 54, CW = 150, TOP = 54, HMAX = 250;
  const h = (HMAX * V) / 620;            // alto del gas (escala fija en cm³)
  const pistonY = TOP + h;
  const heat = Math.min(1, Math.max(0, Tc / 750));
  const hot = Tc > 250;

  /* termómetro */
  const TX = 238, TT = 60, TB = 320, TMAX = 800;
  const ty = (c: number) => TB - (Math.max(-20, Math.min(TMAX, c)) / TMAX) * (TB - TT);

  /* diagrama p-V */
  const GX = 344, GY = 36, GW = 358, GH = 284, PMAX = 80, VMAX = 620;
  const gx = (v: number) => GX + (v / VMAX) * GW;
  const gy = (pp: number) => GY + GH - (Math.min(pp, PMAX) / PMAX) * GH;
  const curve = (nn: number) => plotPath((v) => p1 * (V1 / v) ** nn, Vc, V1, 90, gx, gy);

  return (
    <AnimFrame
      title="Comprimir aire lo calienta: el principio del diesel"
      clock={clock}
      controls={
        <>
          <Seg value={proc} onChange={setProc} ariaLabel="Proceso" options={(Object.keys(PROC) as Proc[]).map((k) => ({ value: k, label: PROC[k].label }))} />
          <Slider label="Relación de compresión ε" value={eps} min={6} max={22} step={0.5} onChange={setEps} format={(v) => `${fmt(v, v % 1 ? 1 : 0)}:1`} />
          <Slider label="Aire que entra" value={tIn} min={-10} max={60} step={1} onChange={setTIn} unit="°C" />
          <Toggle label="En Mendoza (925 hPa)" checked={mza} onChange={setMza} />
        </>
      }
      readouts={
        <>
          <Readout label="Volumen" value={fmt(V, 0)} unit="cm³" />
          <Readout label="Presión" value={fmt(p, 1)} unit="bar" tone="accent" />
          <Readout label="Temperatura" value={fmt(Tc, 0)} unit="°C" tone={Tc > 400 ? "bad" : Tc > 150 ? "warn" : undefined} />
          <Readout label="Al final de la compresión" value={`${fmt(p1 * eps ** n, 0)} bar · ${fmt(T1 * eps ** (n - 1) - 273.15, 0)}`} unit="°C" />
        </>
      }
      legend={(Object.keys(PROC) as Proc[]).map((k) => ({ color: PROC[k].color, label: PROC[k].label }))}
      caption={
        <>
          <p>
            Con las válvulas cerradas, el pistón aprieta el aire. Si lo hace <b>lento</b>, el calor que se genera tiene tiempo de irse por
            las paredes y la temperatura no cambia: la presión sube sólo ε veces. En un motor la compresión dura milésimas de segundo:
            el calor casi no llega a escaparse y el aire <b>se calienta muchísimo</b>. Con ε = 18 y aire a 20 °C, un motor real llega a unos
            530 °C (el ideal, unos 650 °C): el gasoil inyectado ahí se enciende solo. <b>Así funciona el diesel</b>, sin bujías.
          </p>
          <p>
            La misma física explica por qué el aire sale caliente del turbo (por eso existe el intercooler) y por qué la presión que marca un
            compresómetro es mucho menor que la teórica: a la velocidad del burro de arranque se escapa calor y algo de aire por los aros.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 380" role="img" aria-label="Pistón comprimiendo aire y diagrama presión-volumen">
        {/* cilindro */}
        <rect x={CX0 - 14} y={TOP - 22} width={CW + 28} height={22} rx={4} fill="var(--c-metal-dark)" />
        <text x={CX0 + CW / 2} y={TOP - 7} textAnchor="middle" className="svg-small" style={{ fill: "var(--c-metal-light)" }}>válvulas cerradas</text>
        <rect x={CX0 - 14} y={TOP} width={14} height={HMAX + 70} fill="var(--c-block)" />
        <rect x={CX0 + CW} y={TOP} width={14} height={HMAX + 70} fill="var(--c-block)" />
        <rect x={CX0} y={TOP} width={CW} height={h} fill="var(--c-air)" opacity={0.18} />
        <rect x={CX0} y={TOP} width={CW} height={h} fill="var(--c-hot)" opacity={heat * 0.7} />
        {mol.map((m, i) => (
          <circle key={i} cx={CX0 + 5 + tri(m.u + m.vu * psi) * (CW - 10)} cy={TOP + 4 + tri(m.v + m.vv * psi) * Math.max(0, h - 8)} r={3.2}
            fill={hot ? "var(--c-hot)" : Tc > 100 ? "var(--c-flame)" : "var(--c-air)"} />
        ))}
        {/* pistón */}
        <rect x={CX0 + 2} y={pistonY} width={CW - 4} height={58} rx={5} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        {[9, 17].map((o) => <line key={o} x1={CX0 + 2} y1={pistonY + o} x2={CX0 + CW - 2} y2={pistonY + o} stroke="var(--c-metal-dark)" strokeWidth={2} />)}
        <Arrow x1={CX0 + CW / 2} y1={pistonY + 90} x2={CX0 + CW / 2} y2={pistonY + (compressing ? 66 : 112)} color="var(--muted)" width={2.5} />
        {/* calor que se escapa por las paredes */}
        {proc !== "adi" && Tc - tIn > -1 && [0.3, 0.7].map((f) => {
          const y = TOP + h * f;
          const big = proc === "iso" ? 1 : 0.5;
          if (h < 30) return null;
          const out = compressing;
          return (
            <g key={f} opacity={0.85 * big}>
              <Arrow x1={out ? CX0 - 4 : CX0 - 34} y1={y} x2={out ? CX0 - 34 : CX0 - 4} y2={y} color="var(--c-hot)" width={2.5} />
              <Arrow x1={out ? CX0 + CW + 4 : CX0 + CW + 34} y1={y} x2={out ? CX0 + CW + 34 : CX0 + CW + 4} y2={y} color="var(--c-hot)" width={2.5} />
            </g>
          );
        })}
        <text x={CX0 + CW / 2} y={16} textAnchor="middle" className="svg-small">
          {proc === "adi" ? "no se escapa calor" : proc === "iso" ? "el calor se va por las paredes" : "se escapa un poco de calor"}
        </text>
        {/* termómetro */}
        <rect x={TX - 7} y={TT} width={14} height={TB - TT} rx={7} fill="var(--surface)" stroke="var(--border-strong)" />
        <rect x={TX - 4} y={ty(Tc)} width={8} height={TB - ty(Tc)} rx={4} fill={hot ? "var(--c-hot)" : "var(--c-flame)"} />
        <circle cx={TX} cy={TB + 8} r={11} fill={hot ? "var(--c-hot)" : "var(--c-flame)"} />
        {[0, 200, 400, 600, 800].map((c) => (
          <text key={c} x={TX + 12} y={ty(c) + 4} className="svg-small">{c}°</text>
        ))}
        <line x1={TX - 12} y1={ty(250)} x2={TX + 8} y2={ty(250)} stroke="var(--bad)" strokeWidth={2} />
        <text x={TX + 42} y={ty(250) - 2} className="svg-small" style={{ fill: "var(--bad)", fontWeight: 700 }}>250 °C</text>
        <text x={TX + 42} y={ty(250) + 10} className="svg-small" style={{ fill: "var(--bad)", fontSize: 9.5 }}>se enciende</text>
        <text x={TX + 42} y={ty(250) + 21} className="svg-small" style={{ fill: "var(--bad)", fontSize: 9.5 }}>el gasoil</text>

        {/* diagrama p-V */}
        <rect x={GX} y={GY} width={GW} height={GH} rx={8} fill="var(--surface)" stroke="var(--border)" />
        {[20, 40, 60, 80].map((b) => (
          <g key={b}>
            <line x1={GX} y1={gy(b)} x2={GX + GW} y2={gy(b)} stroke="var(--border)" strokeDasharray="2 5" />
            <text x={GX - 6} y={gy(b) + 4} textAnchor="end" className="svg-small">{b}</text>
          </g>
        ))}
        <text x={GX - 6} y={GY - 10} className="svg-small">bar</text>
        {[100, 200, 300, 400, 500, 600].map((v) => (
          <text key={v} x={gx(v)} y={GY + GH + 15} textAnchor="middle" className="svg-small">{v}</text>
        ))}
        <text x={GX + GW} y={GY + GH + 30} textAnchor="end" className="svg-small">volumen [cm³]</text>
        {(Object.keys(PROC) as Proc[]).map((k) => (
          <path key={k} d={curve(PROC[k].n)} fill="none" stroke={PROC[k].color} strokeWidth={k === proc ? 3.2 : 1.4} opacity={k === proc ? 1 : 0.5}
            strokeDasharray={k === proc ? undefined : "5 4"} />
        ))}
        <line x1={gx(Vc)} y1={GY} x2={gx(Vc)} y2={GY + GH} stroke="var(--muted)" strokeDasharray="3 4" />
        <text x={gx(Vc) + 4} y={GY + 14} className="svg-small">PMS</text>
        <line x1={gx(V1)} y1={GY} x2={gx(V1)} y2={GY + GH} stroke="var(--muted)" strokeDasharray="3 4" />
        <text x={gx(V1) - 4} y={GY + 14} textAnchor="end" className="svg-small">PMI</text>
        <circle cx={gx(V)} cy={gy(p)} r={7} fill={PROC[proc].color} stroke="#fff" strokeWidth={2} />
        <text x={GX + GW - 10} y={GY + 34} textAnchor="end" className="svg-label">p · Vⁿ = constante</text>
        {hot && frac < 0.06 && (
          <g>
            <circle cx={CX0 + CW / 2} cy={TOP + h / 2} r={Math.max(6, h / 2)} fill="var(--c-flame)" opacity={0.85} />
            <text x={GX + 12} y={GY + 62} className="svg-label" style={{ fill: "var(--bad)" }}>Aire a {fmt(Tc, 0)} °C: si se inyecta gasoil, se enciende solo</text>
          </g>
        )}
      </svg>
    </AnimFrame>
  );
}
