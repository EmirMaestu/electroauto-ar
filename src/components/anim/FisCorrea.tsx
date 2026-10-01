/* Rozamiento de correas (fórmula de Euler): F1 = F2 · e^(μ·β). La correa del alternador transmite fuerza sólo por
   rozamiento; si la carga supera lo que da la tensión, patina y chilla. */
import { useState } from "react";
import { AnimFrame, Readout, Seg, Slider, Toggle, useAnimClock, Arrow, TAU, fmt, rad } from "../ui/anim-kit";

const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4, strokeLinejoin: "round" } as const;
// μ efectivo de una correa poly-V: el canal en V (40°) multiplica el rozamiento por 1/sen(20°) ≈ 2,9
const CONDS = [
  { id: "nueva", label: "Nueva y seca", mu: 0.9 },
  { id: "vieja", label: "Cristalizada", mu: 0.55 },
  { id: "mojada", label: "Mojada", mu: 0.45 },
  { id: "aceite", label: "Con aceite", mu: 0.25 },
];
const R_PUL = 0.028; // radio de la polea del alternador [m]

export function FisCorrea() {
  const clock = useAnimClock({ speed: 1 });
  const [T0, setT0] = useState(300); // tensión de montaje por ramal [N]
  const [beta, setBeta] = useState(150); // ángulo abrazado [°]
  const [cond, setCond] = useState("nueva");
  const [amps, setAmps] = useState(60);
  const [blip, setBlip] = useState(false);

  const mu = (CONDS.find((c) => c.id === cond) ?? CONDS[0]).mu;
  const eMB = Math.exp(mu * rad(beta));
  const FuMax = (2 * T0 * (eMB - 1)) / (eMB + 1);
  // carga: potencia eléctrica / rendimiento, en ralentí (900 rpm de motor, alternador ×2,6)
  const omegaAlt = ((900 * 2.6) / 60) * TAU;
  const Tq = (14 * amps) / 0.55 / omegaAlt;
  const FuElec = Tq / R_PUL;
  const ph = clock.t % 3;
  const pulse = blip ? Math.exp(-(((ph - 1.2) / 0.18) ** 2)) : 0; // acelerón: la inercia del rotor pide un pico de fuerza
  const FuNeed = FuElec + 150 * pulse;
  const slip = FuNeed > FuMax;
  const Fu = Math.min(FuNeed, FuMax);
  const F1 = T0 + Fu / 2, F2 = Math.max(0, T0 - Fu / 2);

  // geometría
  const C = { x: 500, y: 196 }, R = 52;
  const a = rad(beta / 2);
  const topP = { x: C.x + R * Math.cos(a), y: C.y - R * Math.sin(a) };
  const botP = { x: C.x + R * Math.cos(a), y: C.y + R * Math.sin(a) };
  const dTop = { x: -Math.sin(a), y: -Math.cos(a) };
  const dBot = { x: -Math.sin(a), y: Math.cos(a) };
  const SL = 300;
  const topE = { x: topP.x + dTop.x * SL, y: topP.y + dTop.y * SL };
  const botE = { x: botP.x + dBot.x * SL, y: botP.y + dBot.y * SL };
  const largeArc = beta > 180 ? 1 : 0;
  const beltPath = `M${topE.x},${topE.y} L${topP.x},${topP.y} A${R},${R} 0 ${largeArc} 1 ${botP.x},${botP.y} L${botE.x},${botE.y}`;
  const beltSpeed = 120; // px/s visual
  const dash = -(clock.t * beltSpeed) % 40;
  const pulleyAng = (clock.t * beltSpeed * (slip ? 0.55 : 1)) / R;

  const sc = 90 / 700; // px por N para flechas
  return (
    <AnimFrame
      title="Correa y polea: el rozamiento que mueve el alternador"
      clock={clock}
      controls={
        <>
          <Slider label="Tensión de la correa" value={T0} min={100} max={700} step={10} onChange={setT0} unit="N" />
          <Slider label="Ángulo abrazado" value={beta} min={100} max={200} step={5} onChange={setBeta} unit="°" />
          <Slider label="Consumo eléctrico" value={amps} min={10} max={150} step={5} onChange={setAmps} unit="A" />
          <Seg value={cond} onChange={setCond} options={CONDS.map((c) => ({ value: c.id, label: c.label }))} ariaLabel="Estado de la correa" />
          <Toggle label="Acelerones" checked={blip} onChange={setBlip} />
        </>
      }
      readouts={
        <>
          <Readout label="Fuerza que pide" value={fmt(FuNeed, 0)} unit="N" />
          <Readout label="Máximo que agarra" value={fmt(FuMax, 0)} unit="N" tone={slip ? "bad" : "ok"} />
          <Readout label="Ramal tenso F1" value={fmt(F1, 0)} unit="N" />
          <Readout label="Ramal flojo F2" value={fmt(F2, 0)} unit="N" />
          <Readout label="Relación máx. F1/F2" value={fmt(eMB, 1)} />
          <Readout label="Estado" value={slip ? "Patina: chilla" : "Agarra"} tone={slip ? "bad" : "ok"} />
        </>
      }
      legend={[
        { color: "var(--bad)", label: "Ramal tenso (F1)" },
        { color: "var(--primary)", label: "Ramal flojo (F2)" },
        { color: "var(--accent)", label: "Arco abrazado β" },
      ]}
      caption={
        <>
          <p>
            La correa no engrana: arrastra la polea <b>sólo por rozamiento</b>. La fórmula de Euler dice que, como mucho, el ramal tenso
            puede tirar e<sup>μβ</sup> veces más que el flojo. Por eso importan tres cosas: la <b>tensión</b> (que da el tensor), el{" "}
            <b>ángulo abrazado</b> (más vuelta, más agarre; para eso están las poleas locas) y el <b>μ</b> (una correa poly-V agarra casi
            3 veces más que una plana por el efecto cuña de sus canales).
          </p>
          <p>
            El cálculo es en ralentí, que es cuando el alternador pide más fuerza para la misma corriente. Subí el consumo (luces,
            electroventilador y luneta a la vez) o prendé los acelerones, y bajá la tensión o mojá la correa: cuando
            la fuerza que pide el alternador supera lo que la correa puede agarrar, <b>patina y chilla</b>. Una correa con aceite o
            cristalizada patina aunque esté bien tensada.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 360" role="img" aria-label="Correa sobre la polea del alternador">
        {/* arco abrazado */}
        {(() => {
          const r2 = R + 22;
          const p1 = { x: C.x + r2 * Math.cos(a), y: C.y - r2 * Math.sin(a) };
          const p2 = { x: C.x + r2 * Math.cos(a), y: C.y + r2 * Math.sin(a) };
          return (
            <g>
              <path d={`M${p1.x},${p1.y} A${r2},${r2} 0 ${largeArc} 1 ${p2.x},${p2.y}`} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 4" />
              <text x={C.x + r2 + 8} y={C.y + 4} className="svg-label" style={{ ...HALO, fill: "var(--accent)" }}>β = {beta}°</text>
            </g>
          );
        })()}
        {/* polea */}
        <circle cx={C.x} cy={C.y} r={R} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const an = pulleyAng + (i * TAU) / 6;
          return <line key={i} x1={C.x + 12 * Math.cos(an)} y1={C.y + 12 * Math.sin(an)} x2={C.x + (R - 10) * Math.cos(an)} y2={C.y + (R - 10) * Math.sin(an)} stroke="var(--c-metal-2)" strokeWidth={4} />;
        })}
        <circle cx={C.x} cy={C.y} r={12} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        <circle cx={C.x + (R - 6) * Math.cos(pulleyAng)} cy={C.y + (R - 6) * Math.sin(pulleyAng)} r={4} fill="var(--accent)" />
        <text x={C.x} y={C.y + R + 50} textAnchor="middle" className="svg-small">polea del alternador</text>
        {/* correa */}
        <path d={beltPath} fill="none" stroke="var(--c-metal-dark)" strokeWidth={12} strokeLinejoin="round" />
        <path d={beltPath} fill="none" stroke="var(--c-belt)" strokeWidth={9} strokeLinejoin="round" />
        <path d={beltPath} fill="none" stroke="var(--c-metal-light)" strokeWidth={2} strokeDasharray="10 30" strokeDashoffset={dash} opacity={0.8} />
        {/* tensiones en los ramales */}
        {(() => {
          const mid = 170;
          const pT = { x: topP.x + dTop.x * mid, y: topP.y + dTop.y * mid };
          const pB = { x: botP.x + dBot.x * mid, y: botP.y + dBot.y * mid };
          const nT = { x: Math.cos(a), y: -Math.sin(a) }; // normal hacia afuera del ramal de arriba
          const nB = { x: Math.cos(a), y: Math.sin(a) }; // normal hacia afuera del ramal de abajo
          const lenT = 20 + F2 * sc, lenB = 20 + F1 * sc;
          return (
            <g>
              <Arrow x1={pT.x + nT.x * 18} y1={pT.y + nT.y * 18} x2={pT.x + nT.x * 18 + dTop.x * lenT} y2={pT.y + nT.y * 18 + dTop.y * lenT} color="var(--primary)" width={3.5} head={10} />
              <text x={pT.x + nT.x * 40} y={pT.y + nT.y * 40} textAnchor="middle" className="svg-label" style={{ ...HALO, fill: "var(--primary)" }}>F2 = {fmt(F2, 0)} N (flojo)</text>
              <Arrow x1={pB.x + nB.x * 18} y1={pB.y + nB.y * 18} x2={pB.x + nB.x * 18 + dBot.x * lenB} y2={pB.y + nB.y * 18 + dBot.y * lenB} color="var(--bad)" width={3.5} head={10} />
              <text x={pB.x + nB.x * 44} y={pB.y + nB.y * 44} textAnchor="middle" className="svg-label" style={{ ...HALO, fill: "var(--bad)" }}>F1 = {fmt(F1, 0)} N (tenso)</text>
            </g>
          );
        })()}
        <text x={24} y={C.y + 4} className="svg-small">← al cigüeñal</text>
        {/* chillido */}
        {slip &&
          [0, 1, 2].map((i) => {
            const k = ((clock.t * 2.5 + i / 3) % 1);
            const rr = R + 30 + k * 60;
            return <path key={i} d={`M${C.x + rr * Math.cos(0.3)},${C.y + rr * Math.sin(0.3)} A${rr},${rr} 0 0 1 ${C.x + rr * Math.cos(1.1)},${C.y + rr * Math.sin(1.1)}`}
              fill="none" stroke="var(--bad)" strokeWidth={2.5} opacity={1 - k} />;
          })}
        <text x={24} y={30} className="svg-title" style={{ fill: slip ? "var(--bad)" : "var(--ok)" }}>
          {slip ? "¡Patina! La polea gira más lento que la correa" : "Agarra: la correa arrastra la polea"}
        </text>
        <text x={24} y={50} className="svg-small">F1 ≤ F2 · e^(μ·β) · μ efectivo {fmt(mu, 2)}</text>
      </svg>
    </AnimFrame>
  );
}
