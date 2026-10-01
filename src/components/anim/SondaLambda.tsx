/* Sonda lambda de banda angosta (circonio) en el escape, con la ECU en lazo cerrado.
   Simulación a 100 Hz: la ECU sube y baja la nafta (STFT) según la sonda; la mezcla tarda en llegar
   al escape (retardo de transporte) y la sonda tarda en responder (más si está vieja). */
import { useRef, useState } from "react";
import { AnimFrame, Readout, Seg, Slider, Toggle, Scope, useAnimClock, fmt, clamp } from "../ui/anim-kit";
import { useNarrowScreen } from "./RuedaFonica";

/** Tensión de una sonda de circonio sana, en volts, según el lambda que le llega. */
export function lambdaVolts(lam: number, amp = 0.4, k = 120) {
  return 0.48 + amp * Math.tanh((1 - lam) * k);
}
/** Oxígeno residual (%) y CO (%) aproximados en el escape crudo (antes del catalizador). */
export function exhaustGas(lam: number) {
  const o2 = lam >= 1 ? 0.3 + (19 * (lam - 1)) / lam : Math.max(0.05, 0.3 - 3 * (1 - lam));
  const co = lam < 1 ? 0.5 + 28 * (1 - lam) : Math.max(0.05, 0.5 - 8 * (lam - 1));
  return { o2, co };
}

const DT = 0.01;
const HIST = 1000; // 10 s de historia
const DELAY = 25; // 0,25 s desde el inyector hasta la sonda (a ~2.500 rpm)

interface Sim {
  t: number; stft: number; vs: number; rich: boolean;
  lamQ: number[]; vH: Float32Array; sH: Float32Array; lH: Float32Array; head: number; n: number;
}
interface Cfg { modo: "ecu" | "manual"; lamManual: number; vieja: boolean; fuga: boolean; fria: boolean }
function blank(): Sim {
  return { t: 0, stft: 0, vs: 0.45, rich: false, lamQ: new Array(DELAY).fill(1), vH: new Float32Array(HIST).fill(0.45), sH: new Float32Array(HIST), lH: new Float32Array(HIST).fill(1), head: 0, n: 0 };
}
/** Un paso de 10 ms: mezcla → retardo → sonda → ECU */
function step(S: Sim, c: Cfg) {
  const closed = c.modo === "ecu" && !c.fria;
  const base = c.modo === "manual" ? c.lamManual : 1.0;
  const lamNow = (base * (c.fuga ? 1.15 : 1)) / (1 + (closed ? S.stft : 0));
  S.lamQ.push(lamNow);
  const lamS = S.lamQ.shift()!;
  let vt: number, tau: number;
  if (c.fria) { vt = 0.45 + 0.01 * Math.sin(S.t * 13); tau = 0.3; }
  else if (c.vieja) { vt = lambdaVolts(lamS, 0.24, 60); tau = 0.5; }
  else { vt = lambdaVolts(lamS); tau = 0.05; }
  S.vs += (vt - S.vs) * Math.min(1, DT / tau);
  if (closed) {
    const rich = S.vs > 0.45;
    if (rich !== S.rich) S.stft += rich ? -0.025 : 0.025;
    S.stft += (rich ? -0.04 : 0.04) * DT;
    S.stft = clamp(S.stft, -0.25, 0.25);
    S.rich = rich;
  } else {
    S.stft += (0 - S.stft) * Math.min(1, DT / 0.3);
  }
  S.vH[S.head] = S.vs; S.sH[S.head] = S.stft * 100; S.lH[S.head] = lamS;
  S.head = (S.head + 1) % HIST; S.n++;
  S.t += DT;
}
/** Simulación nueva, ya "andando" hace 10 s para que la pantalla arranque llena */
function newSim(): Sim {
  const S = blank();
  const c: Cfg = { modo: "ecu", lamManual: 1, vieja: false, fuga: false, fria: false };
  for (let i = 0; i < HIST; i++) step(S, c);
  S.t = 0;
  return S;
}

export function SondaLambda() {
  const clock = useAnimClock({ speed: 1 });
  const narrow = useNarrowScreen();
  const [modo, setModo] = useState<"ecu" | "manual">("ecu");
  const [lamManual, setLamManual] = useState(1.0);
  const [vieja, setVieja] = useState(false);
  const [fuga, setFuga] = useState(false);
  const [fria, setFria] = useState(false);
  const sim = useRef<Sim | null>(null);
  if (!sim.current) sim.current = newSim();

  // --- avanzar la simulación hasta el tiempo actual del reloj (idempotente)
  const s = sim.current;
  if (clock.t < s.t - 0.5) sim.current = newSim();
  const S = sim.current;
  let steps = 0;
  const closed = modo === "ecu" && !fria;
  const cfg: Cfg = { modo, lamManual, vieja, fuga, fria };
  while (S.t < clock.t && steps < 600) { steps++; step(S, cfg); }
  const at = (arr: Float32Array, ms: number) => {
    const k = Math.floor(ms / 10); // 1 muestra cada 10 ms
    return arr[(S.head + clamp(k, 0, HIST - 1)) % HIST];
  };
  const last = (arr: Float32Array) => arr[(S.head + HIST - 1) % HIST];
  const v = last(S.vH), stft = last(S.sH), lamS = last(S.lH);
  // frecuencia de conmutación en los últimos 10 s
  let cross = 0;
  for (let i = 1; i < Math.min(S.n, HIST); i++) {
    const a = S.vH[(S.head + HIST - i) % HIST], b = S.vH[(S.head + HIST - i - 1) % HIST];
    if ((a - 0.45) * (b - 0.45) < 0) cross++;
  }
  const hz = cross / 2 / (Math.min(S.n, HIST) / 100 || 1);
  const gas = exhaustGas(lamS);
  const estado = fria ? "Lazo abierto (sonda fría)" : modo === "manual" ? "Mezcla fija (sin corrección)" : "Lazo cerrado";

  // --- dibujo
  const t = clock.t;
  const nO = Math.min(30, Math.round(2 + gas.o2 * 7));
  const nC = Math.min(26, Math.round(gas.co * 6));
  const PX = 245; // eje de la sonda
  const lamToX = (l: number) => 510 + ((clamp(l, 0.8, 1.2) - 0.8) / 0.4) * 190;
  const ionRate = clamp((v - 0.1) / 0.8, 0, 1);

  return (
    <AnimFrame
      title="Sonda lambda: cómo la ECU mantiene λ = 1"
      clock={clock}
      controls={
        <>
          <Seg value={modo} onChange={setModo} ariaLabel="Modo" options={[{ value: "ecu", label: "ECU en lazo cerrado" }, { value: "manual", label: "Mezcla a mano" }]} />
          {modo === "manual" && (
            <Slider label="λ" value={lamManual} min={0.85} max={1.15} step={0.01} onChange={setLamManual} format={(x) => fmt(x, 2)} />
          )}
          <Toggle label="Sonda vieja / lenta" checked={vieja} onChange={setVieja} />
          <Toggle label="Pérdida de vacío" checked={fuga} onChange={setFuga} />
          <Toggle label="Calentador cortado" checked={fria} onChange={setFria} />
        </>
      }
      readouts={
        <>
          <Readout label="λ en la sonda" value={fmt(lamS, 3)} tone={Math.abs(lamS - 1) < 0.02 ? "ok" : "warn"} />
          <Readout label="Tensión sonda" value={fmt(v, 2)} unit="V" />
          <Readout label="STFT" value={(stft > 0 ? "+" : "") + fmt(stft, 1)} unit="%" tone={Math.abs(stft) > 10 ? "bad" : "ok"} />
          <Readout label="Conmutaciones" value={fmt(hz, 1)} unit="Hz" tone={closed ? (hz >= 0.8 ? "ok" : "bad") : undefined} />
          <Readout label="O₂ en escape" value={fmt(gas.o2, 1)} unit="%" />
          <Readout label="CO en escape" value={fmt(gas.co, 1)} unit="%" />
          <Readout label="Estado" value={<span style={{ fontSize: ".8rem" }}>{estado}</span>} tone={fria ? "warn" : "accent"} />
        </>
      }
      legend={[
        { color: "var(--c-air)", label: "O₂ (oxígeno que sobró)" },
        { color: "var(--c-exhaust)", label: "CO (nafta mal quemada)" },
        { color: "#ffd23f", label: "Tensión de la sonda" },
        { color: "#ff9a5a", label: "Corrección STFT" },
      ]}
      caption={
        <>
          <p>
            La sonda compara el oxígeno del escape con el del aire de afuera. <b>Mezcla rica</b>: casi no sobra O₂, la diferencia es
            enorme y la sonda da <b>~0,8–0,9 V</b>. <b>Pobre</b>: sobra O₂ y da <b>~0,1 V</b>. No dice “cuánto” rica: sólo de qué lado
            de λ = 1 está. Por eso la ECU <b>zigzaguea</b>: resta nafta hasta que la sonda cae, suma hasta que sube. La corrección
            naranja (STFT) es ese zigzag.
          </p>
          <p>
            Activá la <b>pérdida de vacío</b>: la ECU sube el STFT hasta compensar (+15 %) y la sonda vuelve a oscilar; en mezcla a mano,
            queda clavada abajo. Con la <b>sonda vieja</b> conmuta lento y con poca amplitud (P0133). Con el <b>calentador cortado</b> se
            queda en ~0,45 V y la ECU no puede cerrar el lazo (P0135).
          </p>
        </>
      }
    >
      <svg viewBox={narrow ? "14 0 478 236" : "0 0 720 250"} style={narrow ? { overflow: "hidden" } : undefined} role="img" aria-label="Sonda lambda en el caño de escape">
        {/* caño de escape */}
        <rect x={20} y={110} width={450} height={92} fill="var(--c-exhaust)" opacity={0.14} />
        <rect x={20} y={102} width={450} height={8} fill="var(--c-metal-dark)" />
        <rect x={20} y={202} width={450} height={8} fill="var(--c-metal-dark)" />
        <text x={28} y={224} className="svg-small">del motor →</text>
        <text x={462} y={224} textAnchor="end" className="svg-small">→ al catalizador</text>
        {Array.from({ length: nO }, (_, k) => {
          const x = 24 + ((k * 61.3 + t * 70) % 440);
          const y = 118 + ((k * 37.7) % 76);
          return <circle key={"o" + k} cx={x} cy={y} r={3.2} fill="var(--c-air)" opacity={0.9} />;
        })}
        {Array.from({ length: nC }, (_, k) => {
          const x = 24 + ((k * 47.9 + 20 + t * 70) % 440);
          const y = 121 + ((k * 29.3 + 11) % 72);
          return <rect key={"c" + k} x={x - 3} y={y - 3} width={6} height={6} rx={1} fill="var(--c-exhaust)" />;
        })}
        {/* sonda: cuerpo roscado */}
        <rect x={PX - 22} y={58} width={44} height={22} rx={3} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        <rect x={PX - 16} y={80} width={32} height={22} fill="var(--c-metal-2)" />
        {[84, 89, 94, 99].map((y) => <line key={y} x1={PX - 16} y1={y} x2={PX + 16} y2={y} stroke="var(--c-metal-dark)" />)}
        <rect x={PX - 8} y={30} width={16} height={28} rx={3} fill="var(--c-rubber)" />
        {/* dedal cerámico (corte) */}
        <path d={`M${PX - 16},104 L${PX - 16},166 Q${PX - 16},184 ${PX},184 Q${PX + 16},184 ${PX + 16},166 L${PX + 16},104`} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
        <path d={`M${PX - 9},104 L${PX - 9},164 Q${PX - 9},175 ${PX},175 Q${PX + 9},175 ${PX + 9},164 L${PX + 9},104`} fill="var(--surface)" stroke="var(--c-metal-2)" />
        {/* electrodos */}
        <path d={`M${PX - 17.5},106 L${PX - 17.5},166 Q${PX - 17.5},185.5 ${PX},185.5 Q${PX + 17.5},185.5 ${PX + 17.5},166 L${PX + 17.5},106`} fill="none" stroke="var(--c-metal-dark)" strokeWidth={1.2} strokeDasharray="3 2" />
        {/* aire de referencia */}
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <circle key={k} cx={PX - 4 + (k % 2) * 8} cy={114 + k * 9} r={2.2} fill="var(--c-air)" />
        ))}
        {/* calentador */}
        <path d={`M${PX - 3},108 L${PX - 3},158 L${PX + 3},158 L${PX + 3},108`} fill="none" stroke={fria ? "var(--c-metal-2)" : "var(--c-hot)"} strokeWidth={2} strokeDasharray={fria ? "4 3" : undefined} />
        {/* iones O2- atravesando la cerámica */}
        {!fria && [0, 1, 2].map((k) => {
          const ph = (t * (0.6 + ionRate * 1.6) + k / 3) % 1;
          return <circle key={k} cx={PX - 9 - ph * 8} cy={130 + k * 14} r={1.8} fill="var(--violet)" opacity={0.3 + 0.7 * ionRate} />;
        })}
        {/* cables */}
        {[-5, -1.5, 1.5, 5].map((dx, k) => (
          <path key={k} d={`M${PX + dx},30 C${PX + dx},12 ${PX + 60},14 ${300 + k * 3},14`} fill="none"
            stroke={k === 0 ? "#ffd23f" : k === 1 ? "var(--c-metal-dark)" : "var(--c-hot)"} strokeWidth={1.8} opacity={0.9} />
        ))}
        <text x={316} y={18} className="svg-small">señal, masa y calentador (4 cables)</text>
        {/* rótulos */}
        <line x1={PX + 18} y1={150} x2={330} y2={128} stroke="var(--muted)" strokeDasharray="3 3" />
        <text x={334} y={124} className="svg-small">cerámica de circonio</text>
        <text x={334} y={137} className="svg-small">con electrodos de platino</text>
        <line x1={PX - 4} y1={116} x2={150} y2={70} stroke="var(--muted)" strokeDasharray="3 3" />
        <text x={146} y={58} textAnchor="end" className="svg-small">adentro: aire de</text>
        <text x={146} y={71} textAnchor="end" className="svg-small">afuera (21 % O₂)</text>
        <line x1={PX + 3} y1={156} x2={150} y2={92} stroke="var(--muted)" strokeDasharray="3 3" />
        <text x={146} y={96} textAnchor="end" className="svg-small" style={{ fill: fria ? "var(--bad)" : "var(--muted)" }}>{fria ? "calentador cortado" : "calentador (~650 °C)"}</text>

        {/* panel derecho: lambda + voltímetro */}
        <text x={605} y={28} textAnchor="middle" className="svg-title" style={{ fontSize: 13 }}>Mezcla en la sonda</text>
        <rect x={510} y={40} width={190} height={16} rx={8} fill="var(--surface-2)" stroke="var(--border)" />
        <rect x={510} y={40} width={lamToX(0.99) - 510} height={16} rx={8} fill="var(--c-fuel)" opacity={0.35} />
        <rect x={lamToX(1.01)} y={40} width={700 - lamToX(1.01)} height={16} rx={8} fill="var(--c-air)" opacity={0.3} />
        <rect x={lamToX(0.99)} y={40} width={lamToX(1.01) - lamToX(0.99)} height={16} fill="var(--ok)" opacity={0.55} />
        <polygon points={`${lamToX(lamS)},60 ${lamToX(lamS) - 6},70 ${lamToX(lamS) + 6},70`} fill="var(--text)" />
        <text x={512} y={84} className="svg-small">rica 0,8</text>
        <text x={605} y={84} textAnchor="middle" className="svg-small">λ = 1</text>
        <text x={698} y={84} textAnchor="end" className="svg-small">pobre 1,2</text>
        <rect x={520} y={100} width={170} height={64} rx={10} fill="var(--scope-bg)" stroke="var(--border)" />
        <text x={605} y={142} textAnchor="middle" className="svg-mono" style={{ fontSize: 26, fill: "#ffd23f" }}>{fmt(v, 2)} V</text>
        <text x={605} y={158} textAnchor="middle" className="svg-small" style={{ fill: "#9fe3b8" }}>señal de la sonda</text>
        <text x={605} y={190} textAnchor="middle" className="svg-label" style={{ fill: v > 0.45 ? "var(--c-fuel)" : "var(--c-air)" }}>
          {fria ? "ECU: sonda sin señal útil" : v > 0.45 ? "ECU lee RICA → resta nafta" : "ECU lee POBRE → suma nafta"}
        </text>
        {modo === "manual" && !fria && <text x={605} y={206} textAnchor="middle" className="svg-small">(en modo manual no corrige)</text>}
      </svg>
      <div style={{ marginTop: 8 }}>
        <Scope
          traces={[
            { fn: (ms) => at(S.vH, ms), color: "#ffd23f", vDiv: 0.2, zero: 0.9, label: "Sonda V" },
            { fn: (ms) => at(S.sH, ms), color: "#ff9a5a", vDiv: 10, zero: 6.3, label: "STFT %" },
          ]}
          msDiv={1000}
          width={narrow ? 480 : 720}
          height={narrow ? 280 : 240}
          label="Tensión de la sonda y corrección STFT, últimos 10 segundos"
        />
      </div>
    </AnimFrame>
  );
}
