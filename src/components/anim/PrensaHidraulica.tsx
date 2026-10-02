/* Sistema de frenos como prensa hidráulica: pedal (palanca) → servofreno → bomba → líquido → pinza.
   La presión es la misma en todo el circuito (Pascal); la fuerza se multiplica por la relación de áreas.
   Con aire en el circuito, la burbuja se comprime (Boyle), la bomba se queda sin recorrido y el pedal se va al piso. */
import { useState } from "react";
import { AnimFrame, Readout, Slider, Toggle, useAnimClock, Arrow, fmt, smoothstep, clamp } from "../ui/anim-kit";

const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4, strokeLinejoin: "round" } as const;
const PEDAL_RATIO = 4; // palanca del pedal
const SERVO = 4; // multiplicación del servofreno
const S_MAX = 3.0; // carrera útil de la bomba [cm]
const V_CLEAR = 0.4; // volumen para arrimar pastillas [cm³]
const C_HOSE = 0.012; // elasticidad de flexibles y pinza [cm³/bar]
const V_AIR = 14; // burbuja de aire a presión atmosférica [cm³]
const P_MAX_GAUGE = 160;

export function PrensaHidraulica() {
  const clock = useAnimClock({ speed: 1 });
  const [fMax, setFMax] = useState(200);
  const [dMc, setDMc] = useState(22.2);
  const [dC, setDC] = useState(54);
  const [servo, setServo] = useState(true);
  const [air, setAir] = useState(false);

  const tau = clock.t % 4;
  const press = smoothstep(0.1, 0.9, tau) * (1 - smoothstep(2.7, 3.3, tau));
  const Fp = fMax * press;
  const Amc = (Math.PI / 4) * (dMc / 10) ** 2; // cm²
  const Ac = (Math.PI / 4) * (dC / 10) ** 2; // cm²
  const Fmc = Fp * PEDAL_RATIO * (servo ? SERVO : 1);
  const vol = (p: number) => V_CLEAR + C_HOSE * p + (air ? (V_AIR * p) / (p + 1) : 0); // cm³ que tiene que empujar la bomba
  const pDemand = Fmc / (Amc * 10); // bar (1 bar = 10 N/cm²)
  let p = pDemand;
  let floor = false;
  if (vol(pDemand) / Amc > S_MAX) {
    floor = true;
    let lo = 0, hi = pDemand;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (vol(m) / Amc < S_MAX) lo = m; else hi = m; }
    p = lo;
  }
  const stroke = Math.min(S_MAX, (Fp > 0.5 ? vol(p) : 0) / Amc); // cm
  const pedalTravel = 5 * press + stroke * 10 * PEDAL_RATIO; // mm (incluye juego libre)
  const Fclamp = p * Ac * 10; // N
  const gain = Fp > 1 ? Fclamp / Fp : (Ac / Amc) * PEDAL_RATIO * (servo ? SERVO : 1);
  const pFrac = clamp(p / P_MAX_GAUGE, 0, 1);

  // --- geometría
  const PV = { x: 64, y: 46 }; // pivote del pedal
  const LP = 196, LR = LP / PEDAL_RATIO;
  const phi = (pedalTravel * 0.95) / LP; // rad (px ≈ mm × 0,95)
  const pad = { x: PV.x + LP * Math.sin(phi), y: PV.y + LP * Math.cos(phi) };
  const att = { x: PV.x + LR * Math.sin(phi), y: PV.y + LR * Math.cos(phi) };
  const LY = PV.y + LR; // altura de la línea de empuje ≈ 95
  const SV = { x: 196, r: 44 };
  const MC0 = 246, MC1 = 380; // bomba
  const mcH = dMc * 1.6;
  const pistonX = MC0 + 26 + (stroke / S_MAX) * 70;
  const fluid = `color-mix(in srgb, var(--c-fuel) ${Math.round(35 + 55 * pFrac)}%, var(--surface))`;
  const DISC = 614; // cara interna del disco
  const CAL = { y: 236 }; // eje del pistón de la pinza
  const cH = dC * 1.6; // alto del pistón (a escala con el diámetro)
  const gap = 5 * (1 - smoothstep(0, 2, p)); // luz de pastillas
  const PAD = 20; // espesor de pastilla (soporte + material)
  const calPistonX = DISC - gap - PAD - 40; // pistón de 40 px de largo
  const cL = DISC - 162, cLin = DISC - 34, cR1 = DISC + 12 + 2 + PAD, cR2 = cR1 + 14;
  const cT = CAL.y - cH / 2 - 30, cTin = CAL.y - cH / 2 - 12, cB = CAL.y + cH / 2 + 14, cB2 = CAL.y + 48;
  const LX = 420; // tramo vertical de la cañería
  const GX = 400; // manómetro
  const lineW = 14;
  const bubbleR = air ? 7 * Math.sqrt(1 / (1 + p)) + 1.5 : 0;

  return (
    <AnimFrame
      title="Frenos hidráulicos: Pascal multiplica la fuerza de tu pie"
      clock={clock}
      controls={
        <>
          <Slider label="Fuerza del pie" value={fMax} min={50} max={400} step={10} onChange={setFMax} unit="N" />
          <Slider label="Ø bomba" value={dMc} min={19} max={26} step={0.1} onChange={setDMc} unit="mm" />
          <Slider label="Ø pistón de pinza" value={dC} min={38} max={60} step={1} onChange={setDC} unit="mm" />
          <Toggle label="Servofreno (motor en marcha)" checked={servo} onChange={setServo} />
          <Toggle label="Aire en el circuito" checked={air} onChange={setAir} />
        </>
      }
      readouts={
        <>
          <Readout label="Fuerza del pie" value={fmt(Fp, 0)} unit="N" />
          <Readout label="Empuje en la bomba" value={fmt(floor ? p * Amc * 10 : Fmc, 0)} unit="N" />
          <Readout label="Presión del líquido" value={fmt(p, 0)} unit="bar" tone="accent" />
          <Readout label="Aprieta la pinza" value={fmt(Fclamp / 1000, 1)} unit="kN" tone={floor ? "bad" : "ok"} />
          <Readout label="Multiplicación" value={`×${fmt(gain, 0)}`} />
          <Readout label="Recorrido de pedal" value={fmt(pedalTravel, 0)} unit="mm" tone={floor ? "bad" : undefined} />
        </>
      }
      legend={[
        { color: "var(--accent)", label: "Fuerza del pie" },
        { color: "var(--c-fuel)", label: "Líquido de frenos (más intenso = más presión)" },
        { color: "var(--primary)", label: "Fuerza sobre las pastillas" },
      ]}
      caption={
        <>
          <p>
            El pedal es una palanca (×{PEDAL_RATIO}) y el servofreno usa el vacío del motor para empujar ×{SERVO} más. La bomba convierte ese
            empuje en <b>presión</b>: p = F / A. Esa misma presión llega a la pinza, que tiene un pistón mucho más grande: F = p × A. Con estos
            diámetros la pinza tiene {fmt(Ac / Amc, 1)} veces el área de la bomba, así que tu pie termina apretando las pastillas con{" "}
            <b>{fmt(gain, 0)} veces</b> su fuerza. El precio: el pistón de la pinza se mueve {fmt(Ac / Amc, 1)} veces menos (apenas arrima las pastillas).
          </p>
          <p>
            Sacá el servofreno: es lo que sentís con el motor apagado (pedal duro, frena poco). Y prendé <b>aire en el circuito</b>: el líquido
            casi no se comprime, pero el aire sí. La bomba gasta su recorrido achicando la burbuja, <b>el pedal se va al piso</b> y la presión
            no sube. Por eso, cada vez que se abre el circuito, hay que <b>purgar</b>.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 400" role="img" aria-label="Circuito de freno hidráulico">
        {/* --- pedal --- */}
        <rect x={PV.x - 30} y={PV.y - 22} width={60} height={14} rx={3} fill="var(--c-metal-dark)" />
        <line x1={PV.x} y1={PV.y} x2={pad.x} y2={pad.y} stroke="var(--c-metal-2)" strokeWidth={10} strokeLinecap="round" />
        <rect x={pad.x - 6} y={pad.y - 22} width={14} height={44} rx={4} fill="var(--c-rubber)" transform={`rotate(${(-phi * 180) / Math.PI} ${pad.x} ${pad.y})`} />
        <circle cx={PV.x} cy={PV.y} r={6} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        {Fp > 3 && <Arrow x1={pad.x - 54 - Fp * 0.08} y1={pad.y} x2={pad.x - 10} y2={pad.y} color="var(--accent)" width={4} head={12} />}
        <text x={pad.x - 14} y={pad.y + 40} textAnchor="middle" className="svg-label" style={{ ...HALO, fill: "var(--accent)" }}>{fmt(Fp, 0)} N</text>
        <text x={PV.x + 12} y={PV.y + 4} className="svg-small">pivote</text>
        {/* piso del habitáculo (tope del pedal) */}
        <line x1={PV.x + 116} y1={PV.y + 120} x2={PV.x + 134} y2={PV.y + 212} stroke="var(--border-strong)" strokeWidth={3} />
        <text x={PV.x + 138} y={PV.y + 206} className="svg-small">piso</text>
        {/* varilla de empuje */}
        <line x1={att.x} y1={att.y} x2={SV.x - SV.r + 4} y2={LY} stroke="var(--c-metal-dark)" strokeWidth={5} />
        <circle cx={att.x} cy={att.y} r={4} fill="var(--c-metal-dark)" />

        {/* --- servofreno --- */}
        <ellipse cx={SV.x} cy={LY} rx={SV.r * 0.62} ry={SV.r} fill={servo ? "var(--c-metal-light)" : "var(--surface-2)"} stroke="var(--c-metal-dark)" strokeWidth={2} strokeDasharray={servo ? undefined : "4 3"} />
        <line x1={SV.x} y1={LY - SV.r + 6} x2={SV.x} y2={LY + SV.r - 6} stroke="var(--c-metal-2)" strokeWidth={2} />
        <text x={SV.x} y={LY + SV.r + 16} textAnchor="middle" className="svg-small">servofreno</text>
        <text x={SV.x} y={LY + SV.r + 29} textAnchor="middle" className="svg-small" style={{ fill: servo ? "var(--ok)" : "var(--bad)" }}>{servo ? `vacío: ×${SERVO}` : "sin vacío"}</text>
        <line x1={SV.x + SV.r * 0.62} y1={LY} x2={pistonX - 10} y2={LY} stroke="var(--c-metal-dark)" strokeWidth={5} />

        {/* --- bomba de freno --- */}
        <rect x={300} y={LY - mcH / 2 - 44} width={62} height={30} rx={4} fill="var(--surface)" stroke="var(--c-metal-2)" />
        <rect x={302} y={LY - mcH / 2 - 30} width={58} height={14} fill="var(--c-fuel)" opacity={0.55} />
        <line x1={331} y1={LY - mcH / 2 - 14} x2={331} y2={LY - mcH / 2} stroke="var(--c-metal-2)" strokeWidth={4} />
        <text x={331} y={LY - mcH / 2 - 50} textAnchor="middle" className="svg-small">depósito</text>
        <rect x={MC0} y={LY - mcH / 2 - 6} width={MC1 - MC0} height={mcH + 12} rx={6} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        <rect x={pistonX} y={LY - mcH / 2} width={MC1 - pistonX} height={mcH} style={{ fill: fluid }} />
        <rect x={pistonX - 12} y={LY - mcH / 2} width={12} height={mcH} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)" />
        <text x={(MC0 + MC1) / 2} y={LY + mcH / 2 + 22} textAnchor="middle" className="svg-small">bomba Ø {fmt(dMc, 1)} mm</text>

        {/* --- cañería --- */}
        <path d={`M${MC1},${LY} L${LX},${LY} L${LX},${CAL.y} L${cL + 12},${CAL.y}`} fill="none" stroke="var(--c-metal-dark)" strokeWidth={lineW + 4} strokeLinejoin="round" />
        <path d={`M${MC1},${LY} L${LX},${LY} L${LX},${CAL.y} L${cL + 12},${CAL.y}`} fill="none" style={{ stroke: fluid }} strokeWidth={lineW} strokeLinejoin="round" />
        {air && [0, 1, 2].map((i) => (
          <circle key={i} cx={LX} cy={LY + 40 + i * 34} r={bubbleR * (1 - i * 0.12)} fill="var(--surface)" stroke="var(--muted)" strokeWidth={1} />
        ))}
        {air && <text x={LX + 14} y={LY + 78} className="svg-small" style={HALO}>aire</text>}
        {/* manómetro */}
        <line x1={GX} y1={LY} x2={GX} y2={LY - 34} stroke="var(--c-metal-dark)" strokeWidth={3} />
        <circle cx={GX} cy={LY - 58} r={26} fill="var(--surface)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        {[0, 0.25, 0.5, 0.75, 1].map((k) => {
          const a = Math.PI * (1.25 - 1.5 * k);
          return <line key={k} x1={GX + 20 * Math.cos(a)} y1={LY - 58 - 20 * Math.sin(a)} x2={GX + 25 * Math.cos(a)} y2={LY - 58 - 25 * Math.sin(a)} stroke="var(--muted)" />;
        })}
        {(() => {
          const a = Math.PI * (1.25 - 1.5 * pFrac);
          return <line x1={GX} y1={LY - 58} x2={GX + 20 * Math.cos(a)} y2={LY - 58 - 20 * Math.sin(a)} stroke="var(--bad)" strokeWidth={2.5} strokeLinecap="round" />;
        })()}
        <text x={GX + 34} y={LY - 66} className="svg-mono" style={{ fontSize: 13 }}>{fmt(p, 0)} bar</text>
        <text x={GX + 34} y={LY - 50} className="svg-small">igual en todo el circuito</text>

        {/* --- pinza y disco (corte: la pinza abraza el borde del disco) --- */}
        <rect x={DISC} y={cTin + 6} width={12} height={CAL.y + 150 - (cTin + 6)} rx={2} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)" />
        <text x={DISC + 20} y={CAL.y + 140} className="svg-small">disco</text>
        <path d={`M${cL},${cT} L${cR2},${cT} L${cR2},${cB2} L${cR1},${cB2} L${cR1},${cTin} L${cLin},${cTin} L${cLin},${cB} L${cL},${cB} Z`}
          fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
        <text x={cL + 4} y={cT - 8} className="svg-small">pinza</text>
        {/* cámara con líquido y pistón */}
        <rect x={cL + 12} y={CAL.y - cH / 2} width={cLin - cL - 12} height={cH} fill="var(--surface-2)" />
        <rect x={cL + 12} y={CAL.y - cH / 2} width={calPistonX - (cL + 12)} height={cH} style={{ fill: fluid }} />
        <rect x={calPistonX} y={CAL.y - cH / 2} width={40} height={cH} rx={3} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" />
        {/* pastillas: soporte metálico + material de fricción */}
        <rect x={calPistonX + 40} y={CAL.y - 40} width={6} height={80} fill="var(--c-metal-dark)" />
        <rect x={calPistonX + 46} y={CAL.y - 40} width={PAD - 6} height={80} fill="var(--c-exhaust)" />
        <rect x={DISC + 14} y={CAL.y - 40} width={PAD - 6} height={80} fill="var(--c-exhaust)" />
        <rect x={DISC + 14 + PAD - 6} y={CAL.y - 40} width={6} height={80} fill="var(--c-metal-dark)" />
        <text x={(cL + cLin) / 2} y={cB + 16} textAnchor="middle" className="svg-small">pistón Ø {dC} mm</text>
        {p > 1 && (
          <>
            <Arrow x1={DISC - 30} y1={CAL.y + 58} x2={DISC - 3} y2={CAL.y + 58} color="var(--primary)" width={3.5} head={10} />
            <Arrow x1={DISC + 42} y1={CAL.y + 58} x2={DISC + 15} y2={CAL.y + 58} color="var(--primary)" width={3.5} head={10} />
            <text x={DISC + 50} y={CAL.y + 84} className="svg-label" style={{ ...HALO, fill: "var(--primary)" }}>{fmt(Fclamp / 1000, 1)} kN</text>
          </>
        )}

        {/* comparación de áreas a escala */}
        <text x={24} y={318} className="svg-label">Áreas a escala</text>
        <circle cx={60} cy={360} r={(dMc * 0.7) / 2} fill="var(--c-fuel)" opacity={0.7} />
        <text x={60} y={392} textAnchor="middle" className="svg-small">{fmt(Amc, 1)} cm²</text>
        <circle cx={150} cy={360} r={(dC * 0.7) / 2} fill="var(--c-fuel)" opacity={0.7} />
        <text x={150} y={392} textAnchor="middle" className="svg-small">{fmt(Ac, 1)} cm²</text>
        <text x={200} y={364} className="svg-small">pinza / bomba = ×{fmt(Ac / Amc, 1)}</text>

        {floor && (
          <text x={24} y={290} className="svg-title" style={{ ...HALO, fill: "var(--bad)" }}>¡Pedal al piso! El aire se comprime</text>
        )}
      </svg>
    </AnimFrame>
  );
}
