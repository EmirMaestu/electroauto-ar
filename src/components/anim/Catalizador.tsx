/* Catalizador de tres vías.
   - Eficiencia de conversión de CO, HC y NOx según λ (curvas típicas, ventana estrecha alrededor de λ = 1).
   - Temperatura de encendido (light-off) ~250–300 °C: debajo de eso casi no convierte.
   - La ECU hace oscilar λ alrededor de 1 (lazo cerrado); un catalizador sano "amortigua" esa oscilación porque
     guarda y suelta oxígeno: la sonda de atrás queda casi quieta. Uno agotado no amortigua → la sonda de atrás
     copia a la de adelante → P0420. */
import { useRef, useState } from "react";
import { AnimFrame, Readout, Slider, Toggle, useAnimClock, Scope, plotPath, clamp, lerp, fmt, TAU } from "../ui/anim-kit";

const etaCO = (l: number) => 0.99 * (l >= 1 ? 1 : Math.exp(-Math.pow((1 - l) / 0.035, 1.6)));
const etaHC = (l: number) => 0.97 * (l >= 1 ? 1 : Math.exp(-Math.pow((1 - l) / 0.045, 1.6)));
const etaNOx = (l: number) => 0.98 * (l <= 0.995 ? 1 : Math.exp(-Math.pow((l - 0.995) / 0.02, 1.3)));
const lightOff = (T: number, t50: number) => 1 / (1 + Math.exp(-(T - t50) / 22));
/** sonda lambda de banda angosta [V] */
const vLambda = (l: number) => 0.45 + 0.42 * Math.tanh((1 - l) / 0.006);

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

type Sp = "CO" | "HC" | "NOx" | "O2";
const SP_COL: Record<string, string> = {
  CO: "var(--c-metal-dark)",
  HC: "var(--c-fuel)",
  NOx: "var(--bad)",
  O2: "var(--c-air)",
  CO2: "var(--c-metal-light)",
  H2O: "var(--primary)",
  N2: "var(--teal)",
};
const TXT_COL: Record<string, string> = {
  CO: "var(--c-metal-light)", NOx: "var(--surface)", H2O: "var(--surface)", N2: "var(--surface)",
  HC: "var(--c-belt)", O2: "var(--c-belt)", CO2: "var(--c-belt)",
};
const SP_TXT: Record<string, string> = { CO: "CO", HC: "HC", NOx: "NOx", O2: "O₂", CO2: "CO₂", H2O: "H₂O", N2: "N₂" };
const PRODUCT: Record<Sp, string> = { CO: "CO2", HC: "H2O", NOx: "N2", O2: "" };

export function Catalizador() {
  const clock = useAnimClock({ speed: 1 });
  const [lam, setLam] = useState(1.0);
  const [Tbase, setTbase] = useState(550);
  const [viejo, setViejo] = useState(false);
  const [misfire, setMisfire] = useState(false);
  const st = useRef({ last: clock.t, ph: 0, monitor: 0 });
  const s = st.current;
  let dt = clock.t - s.last;
  if (dt < 0) dt = 0;
  s.last = clock.t;
  dt = Math.min(dt, 0.1);

  const T = Tbase + (misfire ? 320 : 0);
  const t50 = viejo ? 330 : 270;
  const fCO = lightOff(T, t50), fHC = lightOff(T, t50 + 20), fNOx = lightOff(T, t50 + 30);
  const aging = viejo ? 0.55 : 1;
  const hot = fCO > 0.5;
  // amortiguación de la oscilación de λ por el oxígeno almacenado (OSC)
  const kOsc = viejo || !hot ? 0.85 : 0.08;
  const AMP = 0.02, W = TAU * 1.0;
  const lamAt = (tt: number) => lam + AMP * Math.sin(W * tt);
  const lamPostAt = (tt: number) => lam + AMP * kOsc * Math.sin(W * tt - (viejo ? 0.5 : 1.2)) - (kOsc < 0.5 ? 0.0025 : 0);
  // eficiencia promedio en un ciclo
  let eCO = 0, eHC = 0, eNO = 0;
  for (let i = 0; i < 24; i++) {
    const l = lam + AMP * kOsc * Math.sin((i / 24) * TAU);
    eCO += etaCO(l); eHC += etaHC(l); eNO += etaNOx(l);
  }
  eCO = (eCO / 24) * fCO * aging;
  eHC = (eHC / 24) * fHC * aging * (misfire ? 0.85 : 1);
  eNO = (eNO / 24) * fNOx * aging;
  const eff: Record<Sp, number> = { CO: eCO, HC: eHC, NOx: eNO, O2: lam < 1 ? 1 : lam > 1.005 ? 0.2 : 0.7 };

  // monitor de catalizador (como la ECU): compara la actividad de la sonda de atrás con la de adelante
  const closedLoop = Math.abs(lam - 1) < 0.012;
  if (closedLoop && hot && viejo) s.monitor += dt; else s.monitor = Math.max(0, s.monitor - dt * 0.5);
  const p0420 = s.monitor > 3;

  s.ph += dt * 0.12;
  const t = clock.t;
  const vPre = vLambda(lamAt(t));
  const vPost = vLambda(lamPostAt(t));

  // ---------------------------------------------------------- moléculas
  const NM = 34;
  const X0 = 6, X1 = 520, MX0 = 172, MX1 = 368, MID = 270;
  const yPipe = (i: number) => 120 + ((i * 3) % 5) * 7.5;
  const yLane = (i: number) => 84 + ((i * 7) % 11) * 10.5;
  const mols = Array.from({ length: NM }, (_, i) => {
    const raw = s.ph + i / NM + hash(i) * 0.013;
    const pass = Math.floor(raw);
    const u = raw - pass;
    const x = X0 + u * (X1 - X0);
    let y: number;
    if (x < 128) y = yPipe(i);
    else if (x < MX0) y = lerp(yPipe(i), yLane(i), (x - 128) / (MX0 - 128));
    else if (x < MX1) y = yLane(i);
    else if (x < 412) y = lerp(yLane(i), yPipe(i), (x - MX1) / (412 - MX1));
    else y = yPipe(i);
    // especie según la mezcla
    const r = hash(i * 13 + pass * 7);
    const rich = clamp((1 - lam) / 0.05, 0, 1), lean = clamp((lam - 1) / 0.05, 0, 1);
    const wCO = 0.28 + 0.3 * rich, wHC = 0.2 + 0.12 * rich + (misfire ? 0.3 : 0), wNO = 0.22 + 0.15 * lean, wO2 = 0.12 + 0.35 * lean;
    const sum = wCO + wHC + wNO + wO2;
    const q = r * sum;
    const sp: Sp = q < wCO ? "CO" : q < wCO + wHC ? "HC" : q < wCO + wHC + wNO ? "NOx" : "O2";
    const converted = x > MID && hash(i * 29 + pass * 3) < eff[sp];
    const name = converted ? PRODUCT[sp] : sp;
    if (!name) return null; // el O₂ se consumió
    return (
      <g key={i} transform={`translate(${x} ${y})`}>
        <circle r={7.5} style={{ fill: SP_COL[name] }} stroke="var(--surface)" strokeWidth={1} />
        <text y={2.8} textAnchor="middle" style={{ fontSize: 7, fontWeight: 700, fill: TXT_COL[name] }}>{SP_TXT[name]}</text>
      </g>
    );
  });

  // ---------------------------------------------------------- gráfico de eficiencia
  const GX = 540, GY = 40, GW = 166, GH = 168;
  const mx = (l: number) => GX + ((l - 0.9) / 0.2) * GW;
  const my = (e: number) => GY + GH - e * GH;
  const k = (f: number) => f * aging;
  const pCO = plotPath((l) => etaCO(l) * k(fCO), 0.9, 1.1, 120, mx, my);
  const pHC = plotPath((l) => etaHC(l) * k(fHC), 0.9, 1.1, 120, mx, my);
  const pNO = plotPath((l) => etaNOx(l) * k(fNOx), 0.9, 1.1, 120, mx, my);

  const glow = clamp((T - 250) / 700, 0, 1);
  const melting = T > 950;
  const estado = melting ? "¡se funde!" : !hot ? "frío" : p0420 ? "P0420" : lam < 0.99 ? "rica" : lam > 1.005 ? "pobre" : "en ventana";
  const estadoTone = melting || !hot || p0420 ? "bad" : lam < 0.99 || lam > 1.005 || misfire ? "warn" : "ok";

  return (
    <AnimFrame
      title="Catalizador de tres vías: la ventana de λ = 1"
      clock={clock}
      controls={
        <>
          <Slider label="λ (mezcla)" value={lam} min={0.9} max={1.1} step={0.005} onChange={setLam} format={(v) => fmt(v, 3)} />
          <Slider label="Temp. catalizador" value={Tbase} min={100} max={900} step={10} unit="°C" onChange={setTbase} />
          <Toggle label="Catalizador agotado" checked={viejo} onChange={setViejo} />
          <Toggle label="Falla de encendido (nafta cruda)" checked={misfire} onChange={setMisfire} />
        </>
      }
      readouts={
        <>
          <Readout label="CO convertido" value={fmt(eCO * 100, 0)} unit="%" tone={eCO > 0.85 ? "ok" : eCO > 0.5 ? "warn" : "bad"} />
          <Readout label="HC convertido" value={fmt(eHC * 100, 0)} unit="%" tone={eHC > 0.85 ? "ok" : eHC > 0.5 ? "warn" : "bad"} />
          <Readout label="NOx convertido" value={fmt(eNO * 100, 0)} unit="%" tone={eNO > 0.85 ? "ok" : eNO > 0.5 ? "warn" : "bad"} />
          <Readout label="Temperatura" value={fmt(T, 0)} unit="°C" tone={melting ? "bad" : T > 850 ? "warn" : undefined} />
          <Readout label="Sonda antes" value={fmt(vPre, 2)} unit="V" />
          <Readout label="Sonda después" value={fmt(vPost, 2)} unit="V" />
          <Readout label="Estado" value={estado} tone={estadoTone} />
        </>
      }
      legend={[
        { color: SP_COL.CO, label: "CO" },
        { color: SP_COL.HC, label: "HC (nafta sin quemar)" },
        { color: SP_COL.NOx, label: "NOx" },
        { color: SP_COL.O2, label: "O₂" },
        { color: SP_COL.CO2, label: "CO₂" },
        { color: SP_COL.H2O, label: "H₂O" },
        { color: SP_COL.N2, label: "N₂" },
      ]}
      caption={
        <>
          <p>
            Adentro hay un panal de cerámica con miles de canalitos recubiertos de metales nobles (platino, paladio, rodio). Ahí el CO y
            los HC se <b>oxidan</b> (toman oxígeno) y los NOx se <b>reducen</b> (largan oxígeno). Las dos cosas a la vez sólo se pueden con
            la mezcla justa: <b>λ entre ~0,99 y 1,005</b>. Un poquito rica y pasan CO y HC; un poquito pobre y pasan los NOx. Y por debajo
            de unos <b>250–300 °C</b> no convierte casi nada: por eso contamina tanto un motor frío.
          </p>
          <p>
            Mirá el osciloscopio: la ECU hace “respirar” la mezcla alrededor de λ = 1 y la sonda de adelante salta entre 0,1 y 0,9 V. Un
            catalizador sano guarda oxígeno y la sonda de atrás queda <b>quieta, cerca de 0,6–0,7 V</b>. Activá “agotado”: la de atrás
            empieza a copiar a la de adelante y la ECU guarda <b>P0420</b>. Con falla de encendido la nafta cruda se quema adentro del
            catalizador: la temperatura se dispara y el panal se puede derretir.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 250" role="img" aria-label="Catalizador con moléculas entrando y saliendo">
        {/* caño de entrada y salida */}
        <rect x={0} y={110} width={130} height={50} fill="var(--c-metal-2)" opacity={0.35} />
        <rect x={410} y={110} width={118} height={50} fill="var(--c-metal-2)" opacity={0.35} />
        <line x1={0} x2={130} y1={110} y2={110} stroke="var(--c-metal-dark)" strokeWidth={3} />
        <line x1={0} x2={130} y1={160} y2={160} stroke="var(--c-metal-dark)" strokeWidth={3} />
        <line x1={410} x2={528} y1={110} y2={110} stroke="var(--c-metal-dark)" strokeWidth={3} />
        <line x1={410} x2={528} y1={160} y2={160} stroke="var(--c-metal-dark)" strokeWidth={3} />
        {/* carcasa */}
        <path d="M130,110 L156,62 L384,62 L410,110 L410,160 L384,208 L156,208 L130,160 Z" fill="var(--c-metal-2)" opacity={0.3} stroke="var(--c-metal-dark)" strokeWidth={3} strokeLinejoin="round" />
        {/* monolito */}
        <rect x={170} y={74} width={200} height={122} rx={6} fill="var(--c-metal-light)" opacity={0.75} />
        <rect x={170} y={74} width={200} height={122} rx={6} fill={melting ? "var(--bad)" : "var(--c-hot)"} opacity={melting ? 0.55 + 0.2 * Math.sin(t * 8) : glow * 0.45} />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1={170} x2={370} y1={79 + i * 10.5} y2={79 + i * 10.5} stroke="var(--c-metal-2)" strokeWidth={1} opacity={0.8} />
        ))}
        <text x={270} y={56} textAnchor="middle" className="svg-small" style={{ fill: "var(--text-2)" }}>
          panal cerámico con platino · paladio · rodio
        </text>
        <text x={270} y={226} textAnchor="middle" className="svg-mono" style={{ fill: melting ? "var(--bad)" : hot ? "var(--accent)" : "var(--c-air)" }}>
          {fmt(T, 0)} °C {melting ? "· ¡se derrite!" : hot ? "· convierte" : "· frío"}
        </text>
        {mols}
        {/* sondas */}
        {[[74, "antes", vPre], [462, "después", vPost]].map(([x, lbl, v]) => (
          <g key={lbl as string}>
            <rect x={(x as number) - 6} y={84} width={12} height={28} rx={3} fill="var(--c-metal-dark)" />
            <rect x={(x as number) - 4} y={108} width={8} height={8} fill="var(--c-metal)" />
            <line x1={x as number} x2={x as number} y1={84} y2={60} stroke="var(--c-elec)" strokeWidth={1.5} />
            <text x={x as number} y={40} textAnchor="middle" className="svg-small" style={{ fill: "var(--c-elec)", fontWeight: 700 }}>sonda {lbl as string}</text>
            <text x={x as number} y={54} textAnchor="middle" className="svg-mono" style={{ fontSize: 11 }}>{fmt(v as number, 2)} V</text>
          </g>
        ))}
        {/* ECU */}
        <rect x={404} y={186} width={118} height={44} rx={7} fill="var(--surface-2)" stroke="var(--c-elec)" />
        <text x={414} y={203} className="svg-small" style={{ fill: "var(--c-elec)", fontWeight: 700 }}>ECU · monitor cat.</text>
        <text x={414} y={221} className="svg-mono" style={{ fontSize: 11, fill: p0420 ? "var(--bad)" : "var(--ok)" }}>
          {p0420 ? "P0420" : !hot ? "esperando" : "OK"}
        </text>

        {/* gráfico de eficiencia */}
        <rect x={GX} y={GY} width={GW} height={GH} rx={6} fill="var(--surface)" stroke="var(--border)" />
        <text x={GX + GW / 2} y={GY - 12} textAnchor="middle" className="svg-small" style={{ fill: "var(--text)", fontWeight: 700 }}>Conversión vs λ</text>
        <rect x={mx(0.99)} y={GY} width={mx(1.005) - mx(0.99)} height={GH} fill="var(--ok-soft)" />
        {[0, 0.5, 1].map((e) => (
          <g key={e}>
            <line x1={GX} x2={GX + GW} y1={my(e)} y2={my(e)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={GX - 4} y={my(e) + 4} textAnchor="end" className="svg-small">{e * 100}%</text>
          </g>
        ))}
        {[0.9, 1.0, 1.1].map((l) => (
          <text key={l} x={mx(l)} y={GY + GH + 14} textAnchor="middle" className="svg-small">{fmt(l, 2)}</text>
        ))}
        <text x={mx(0.92)} y={GY + GH + 28} className="svg-small">← rica</text>
        <text x={mx(1.08)} y={GY + GH + 28} textAnchor="end" className="svg-small">pobre →</text>
        <path d={pCO} fill="none" stroke={SP_COL.CO} strokeWidth={2.2} />
        <path d={pHC} fill="none" stroke={SP_COL.HC} strokeWidth={2.2} />
        <path d={pNO} fill="none" stroke={SP_COL.NOx} strokeWidth={2.2} />
        <text x={GX + 6} y={my(0.08)} className="svg-small" style={{ fill: SP_COL.NOx, fontWeight: 700 }}>NOx</text>
        <text x={GX + GW - 6} y={my(0.08)} textAnchor="end" className="svg-small" style={{ fill: SP_COL.CO, fontWeight: 700 }}>CO · <tspan style={{ fill: SP_COL.HC }}>HC</tspan></text>
        <line x1={mx(lam)} x2={mx(lam)} y1={GY} y2={GY + GH} stroke="var(--text)" strokeWidth={1.5} opacity={0.7} />
      </svg>
      <div style={{ padding: "0 .6rem .4rem" }}>
        <Scope
          msDiv={400}
          height={170}
          label="Sondas lambda antes y después del catalizador"
          traces={[
            { fn: (ms) => vLambda(lamAt(t - 4 + ms / 1000)), color: "#3ddc84", vDiv: 0.25, zero: 4, label: "sonda antes" },
            { fn: (ms) => vLambda(lamPostAt(t - 4 + ms / 1000)), color: "#ffd23f", vDiv: 0.25, zero: 0, label: "sonda después" },
          ]}
        />
      </div>
    </AnimFrame>
  );
}
