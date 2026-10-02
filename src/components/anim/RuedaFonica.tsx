/* Rueda fónica 60-2 frente al sensor de cigüeñal (CKP), con la señal en el osciloscopio.
   El modelo es físico: cada diente "acerca" flujo magnético al sensor (una campana gaussiana).
   - Inductivo: la tensión es la derivada del flujo (ley de Faraday) → crece con las rpm.
   - Hall: un chip compara el campo con un umbral → cuadrada 0–5 V, igual a cualquier rpm. */
import { useEffect, useMemo, useState } from "react";
import { AnimFrame, Readout, Seg, Slider, Scope, useAnimClock, fmt, clamp } from "../ui/anim-kit";

const TEETH = 60;
const DAMAGED = 20; // diente que se rompe en la falla
type Tipo = "inductivo" | "hall";
type Falla = "ok" | "diente" | "entrehierro" | "ruido";

/** true en pantallas angostas (celular) para agrandar el osciloscopio */
export function useNarrowScreen(px = 560) {
  const q = `(max-width: ${px}px)`;
  const [n, setN] = useState(() => typeof matchMedia !== "undefined" && matchMedia(q).matches);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const m = matchMedia(q);
    const on = () => setN(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [q]);
  return n;
}

/** En celular, agranda la letra de un SVG puntual (se identifica por id). */
export function narrowFonts(id: string, small: number, label: number, mono = label) {
  return `#${id} .svg-small{font-size:${small}px} #${id} .svg-label{font-size:${label}px} #${id} .svg-mono{font-size:${mono}px !important}`;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

function toothWeight(i: number, falla: Falla) {
  const k = mod(i, TEETH);
  if (k === 58 || k === 59) return 0; // los dos dientes que faltan: el "hueco"
  if (falla === "diente" && k === DAMAGED) return 0.3;
  return 1;
}

/** Flujo magnético relativo bajo el sensor y su derivada, para una posición p medida en dientes. */
function fluxAt(p: number, falla: Falla, sigma: number) {
  const i0 = Math.floor(p);
  let f = 0, df = 0;
  for (let i = i0 - 2; i <= i0 + 3; i++) {
    const w = toothWeight(i, falla);
    if (!w) continue;
    const d = (p - i) / sigma;
    const e = Math.exp(-d * d);
    f += w * e;
    df += w * (-2 * d / sigma) * e;
  }
  return { f, df };
}

/** "Ruido" determinístico: picos de las chispas (2 por vuelta en un 4 cilindros) + un poco de ruido fino. */
function interference(p: number, amp: number) {
  const q = mod(p, 30) - 12; // un pico cada 30 dientes (cada 180°: una chispa en un 4 cilindros)
  let v = 0;
  if (q > 0 && q < 0.8) v += (1.5 + 1.6 * amp) * Math.exp(-q * 5) * Math.cos(q * 40);
  v += 0.12 * (0.6 + amp) * Math.sin(p * 37.3) * Math.sin(p * 11.1 + 1.3);
  return v;
}

const SIG_IND = 0.42;
const SIG_HALL = 0.3;
const NORM = (() => {
  let m = 0;
  for (let k = 0; k <= 400; k++) m = Math.max(m, Math.abs(fluxAt(20 + k / 400, "ok", SIG_IND).df));
  return m;
})();

function inductiveAmp(rpm: number) { return 0.25 + rpm * 0.0012; }

function signalAt(p: number, rpm: number, tipo: Tipo, falla: Falla) {
  const runout = 1 + 0.3 * Math.sin((p / TEETH) * Math.PI * 2); // rueda levemente excéntrica
  const gapFactor = falla === "entrehierro" ? 0.3 * runout : 1;
  if (tipo === "inductivo") {
    const { df } = fluxAt(p, falla, SIG_IND);
    let v = -(df / NORM) * inductiveAmp(rpm) * gapFactor;
    if (falla === "ruido") v += interference(p, inductiveAmp(rpm));
    return v;
  }
  const { f } = fluxAt(p, falla, SIG_HALL);
  const field = f * (falla === "entrehierro" ? 0.42 * runout : 1);
  let v = field > 0.45 ? 5 : 0.1;
  if (falla === "ruido") {
    const n = interference(p, 1.5);
    if (Math.abs(n) > 1.6) v = n > 0 ? 5 : 0.1;
    v += n * 0.3;
  }
  return v;
}

/** Contorno de los 58 dientes (path único) */
function teethPath(cx: number, cy: number, rRoot: number, rTip: number, skip: number[]) {
  let d = "";
  const P = (a: number, r: number) => `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  for (let i = 0; i < TEETH; i++) {
    if (i === 58 || i === 59 || skip.includes(i)) continue;
    const c = (-i * 6 * Math.PI) / 180;
    const a1 = (1.75 * Math.PI) / 180, a2 = (1.25 * Math.PI) / 180;
    d += `M${P(c - a1, rRoot - 1)} L${P(c - a2, rTip)} L${P(c + a2, rTip)} L${P(c + a1, rRoot - 1)} Z `;
  }
  return d;
}

export function RuedaFonica() {
  const clock = useAnimClock({ speed: 1 });
  const narrow = useNarrowScreen();
  const [rpm, setRpm] = useState(850);
  const [tipo, setTipo] = useState<Tipo>("inductivo");
  const [falla, setFalla] = useState<Falla>("ok");
  const [base, setBase] = useState<"auto" | "fija">("auto");

  // Rueda en cámara lenta (si girara a velocidad real sería un borrón)
  const visRps = 0.07 + 0.1 * (rpm / 6500);
  const pNow = clock.t * visRps * TEETH; // posición en dientes que pasa frente al sensor
  const phiDeg = pNow * 6;

  // Osciloscopio: disparado en el mismo punto de la vuelta (como un equipo real con trigger)
  const P0 = 50;
  const teethPerMs = rpm / 1000; // 60 dientes por vuelta → rpm/1000 dientes por ms
  const msDivAuto = (() => {
    const raw = 78 / teethPerMs / 10;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    return Math.round((raw / mag) * 10) / 10 * mag;
  })();
  const msDiv = base === "auto" ? Number(msDivAuto.toPrecision(2)) : 2;
  const windowMs = msDiv * 10;
  const fn = (ms: number) => signalAt(P0 + ms * teethPerMs, rpm, tipo, falla);

  const markers: { ms: number; label: string; color?: string }[] = [];
  for (let g = 58.5; g < P0 + windowMs * teethPerMs + 60; g += 60) {
    if (g < P0) continue;
    const ms = (g - P0) / teethPerMs;
    if (ms < windowMs * 0.97) markers.push({ ms, label: "hueco", color: "rgba(255,170,90,.75)" });
  }
  if (falla === "diente") {
    const ms = (DAMAGED + 60 - P0) / teethPerMs;
    if (ms < windowMs) markers.push({ ms, label: "diente roto", color: "rgba(255,107,107,.8)" });
  }
  const pw = mod(pNow - P0, 60) + P0;
  const cursorMs = (pw - P0) / teethPerMs;
  if (cursorMs < windowMs) markers.push({ ms: cursorMs, label: "sensor ahora", color: "rgba(140,200,255,.9)" });

  // Lo que "ve" la ECU
  const amp = tipo === "inductivo" ? inductiveAmp(rpm) * (falla === "entrehierro" ? 0.3 : 1) : 5;
  const ampMin = tipo === "inductivo" ? amp * (falla === "entrehierro" ? 0.7 : 1) : 5;
  const vpp = tipo === "inductivo" ? 2 * amp * 1.35 : 5;
  // escala vertical elegida con la amplitud SANA, así una señal débil se ve chica
  const vDivInd = [0.2, 0.5, 1, 2, 5, 10].find((d) => (inductiveAmp(rpm) * 1.35) / d <= 3.3) ?? 10;
  const threshold = 0.3;
  let ecuRpm: number | null = rpm;
  let estado = "Sincronizada";
  let tone: "ok" | "warn" | "bad" = "ok";
  if (tipo === "inductivo" && falla === "entrehierro" && ampMin * 1.3 < threshold) {
    ecuRpm = null; estado = "Sin señal: no arranca"; tone = "bad";
  } else if (tipo === "inductivo" && falla === "entrehierro" && ampMin < threshold) {
    ecuRpm = rpm * (Math.sin(clock.t * 3.1) > 0 ? 1 : 0); estado = "Señal intermitente"; tone = "bad";
  } else if (tipo === "hall" && falla === "entrehierro") {
    ecuRpm = null; estado = "Faltan pulsos: pierde sincronismo"; tone = "bad";
  } else if (falla === "diente") {
    estado = "Hueco falso: pierde sincronismo"; tone = "bad";
  } else if (falla === "ruido") {
    ecuRpm = rpm * (1 + 0.06 * Math.sin(clock.t * 5.3) + 0.04 * Math.sin(clock.t * 13.7));
    estado = "Cuenta pulsos de más"; tone = "warn";
  }
  const toothNow = Math.floor(mod(pNow + 0.5, 60));
  const inGap = toothNow === 58 || toothNow === 59;

  // Geometría
  const CX = 168, CY = 150, RR = 102, RT = 120;
  const gapPx = falla === "entrehierro" ? 16 : 5;
  const SX = CX + RT + gapPx; // punta del sensor
  const path = useMemo(() => teethPath(CX, CY, RR, RT, falla === "diente" ? [DAMAGED] : []), [falla]);
  const dmgA = (-DAMAGED * 6 * Math.PI) / 180;
  const gapA0 = (-57.5 * 6 * Math.PI) / 180, gapA1 = (-59.5 * 6 * Math.PI) / 180;
  const arc = (r: number) =>
    `M${CX + r * Math.cos(gapA0)},${CY + r * Math.sin(gapA0)} A${r},${r} 0 0 0 ${CX + r * Math.cos(gapA1)},${CY + r * Math.sin(gapA1)}`;

  const wires = tipo === "inductivo"
    ? [{ y: CY - 8, c: "var(--c-signal)", l: "señal +" }, { y: CY + 8, c: "var(--c-metal-dark)", l: "señal −" }]
    : [{ y: CY - 14, c: "var(--bad)", l: "5 V (ref.)" }, { y: CY, c: "var(--c-signal)", l: "señal" }, { y: CY + 14, c: "var(--c-metal-dark)", l: "masa" }];

  return (
    <AnimFrame
      title="Rueda fónica 60-2 y sensor de cigüeñal (CKP)"
      clock={clock}
      controls={
        <>
          <Seg value={tipo} onChange={setTipo} ariaLabel="Tipo de sensor" options={[{ value: "inductivo", label: "Inductivo" }, { value: "hall", label: "Hall" }]} />
          <Slider label="RPM" value={rpm} min={150} max={6500} step={50} onChange={setRpm} />
          <Seg value={falla} onChange={setFalla} ariaLabel="Falla" options={[
            { value: "ok", label: "Sano" }, { value: "diente", label: "Diente roto" },
            { value: "entrehierro", label: "Entrehierro grande" }, { value: "ruido", label: "Interferencia" },
          ]} />
          <Seg value={base} onChange={setBase} ariaLabel="Base de tiempo" options={[{ value: "auto", label: "Base auto" }, { value: "fija", label: "2 ms/div fija" }]} />
        </>
      }
      readouts={
        <>
          <Readout label="RPM reales" value={fmt(rpm, 0)} />
          <Readout label="Frecuencia dientes" value={fmt(rpm, 0)} unit="Hz" />
          <Readout label={tipo === "inductivo" ? "Amplitud" : "Nivel"} value={tipo === "inductivo" ? fmt(vpp, 1) : "0–5"} unit={tipo === "inductivo" ? "Vpp" : "V"} tone={tipo === "inductivo" && amp < 0.5 ? "warn" : undefined} />
          <Readout label="RPM según ECU" value={ecuRpm === null ? "—" : fmt(ecuRpm, 0)} tone={ecuRpm === null ? "bad" : falla === "ruido" ? "warn" : "ok"} />
          <Readout label="Estado ECU" value={<span style={{ fontSize: ".82rem" }}>{estado}</span>} tone={tone} />
        </>
      }
      legend={[
        { color: "var(--c-metal)", label: "Rueda fónica (58 dientes + hueco)" },
        { color: "var(--accent)", label: "Hueco de referencia" },
        { color: "var(--c-signal)", label: "Cable de señal" },
        { color: "#8cc8ff", label: "Cursor: lo que pasa frente al sensor ahora" },
      ]}
      caption={
        <>
          <p>
            La rueda gira en <b>cámara lenta</b>; el osciloscopio muestra la señal en <b>tiempo real</b>, disparado siempre en el mismo
            punto de la vuelta. Con 60 posiciones por vuelta, la frecuencia de los dientes en Hz es igual a las rpm. El <b>hueco</b> de dos
            dientes es la marca de referencia: la ECU mide el tiempo entre dientes y, cuando uno dura unas tres veces más que el anterior,
            sabe que pasó el hueco y desde ahí cuenta los grados hasta el PMS.
          </p>
          <p>
            Probá el <b>inductivo</b> a 150 rpm (arranque) y a 6.000: la tensión crece con la velocidad, porque la genera el propio
            movimiento. El <b>Hall</b> da siempre 0–5 V, aun girando a paso de hombre. Después rompé un diente o abrí el entrehierro y
            mirá qué le pasa a la ECU.
          </p>
        </>
      }
    >
      <svg viewBox={narrow ? "28 20 432 280" : "0 0 720 300"} style={narrow ? { overflow: "hidden" } : undefined} role="img" aria-label="Rueda fónica con sensor CKP">
        {/* rueda */}
        <g transform={`rotate(${phiDeg} ${CX} ${CY})`}>
          <circle cx={CX} cy={CY} r={RR} fill="var(--c-metal-2)" />
          <path d={path} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={0.6} />
          {falla === "diente" && (
            <path
              d={`M${CX + (RR - 1) * Math.cos(dmgA - 0.03)},${CY + (RR - 1) * Math.sin(dmgA - 0.03)} L${CX + (RR + 5) * Math.cos(dmgA - 0.02)},${CY + (RR + 5) * Math.sin(dmgA - 0.02)} L${CX + (RR + 7) * Math.cos(dmgA + 0.022)},${CY + (RR + 7) * Math.sin(dmgA + 0.022)} L${CX + (RR - 1) * Math.cos(dmgA + 0.03)},${CY + (RR - 1) * Math.sin(dmgA + 0.03)} Z`}
              fill="var(--bad)"
            />
          )}
          <path d={arc(RT + 6)} fill="none" stroke="var(--accent)" strokeWidth={4} strokeLinecap="round" />
          <circle cx={CX} cy={CY} r={RR - 18} fill="none" stroke="var(--c-metal-dark)" strokeWidth={1} opacity={0.6} />
          <circle cx={CX} cy={CY} r={36} fill="var(--c-metal-dark)" />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <circle key={k} cx={CX + 56 * Math.cos((k * Math.PI) / 3)} cy={CY + 56 * Math.sin((k * Math.PI) / 3)} r={7} fill="var(--surface)" stroke="var(--c-metal-dark)" />
          ))}
          <circle cx={CX} cy={CY} r={14} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" />
        </g>
        <text x={CX} y={CY + RT + 24} textAnchor="middle" className="svg-small">rueda fónica en el cigüeñal (gira en cámara lenta)</text>

        {/* sensor */}
        <g>
          {tipo === "inductivo" ? (
            <>
              <rect x={SX} y={CY - 9} width={20} height={18} rx={3} fill="var(--c-metal-dark)" />
              <rect x={SX + 20} y={CY - 20} width={78} height={40} rx={6} fill="var(--c-rubber)" />
              {[0, 1, 2, 3, 4, 5, 6].map((k) => (
                <line key={k} x1={SX + 26 + k * 9} y1={CY - 16} x2={SX + 30 + k * 9} y2={CY + 16} stroke="var(--c-oil)" strokeWidth={3} />
              ))}
              <rect x={SX + 4} y={CY - 4} width={86} height={8} fill="var(--c-metal-light)" opacity={0.85} />
              <text x={SX + 58} y={CY - 26} textAnchor="middle" className="svg-small">imán + bobina</text>
            </>
          ) : (
            <>
              <rect x={SX} y={CY - 10} width={12} height={20} rx={2} fill="var(--violet)" />
              <rect x={SX + 12} y={CY - 20} width={86} height={40} rx={6} fill="var(--c-rubber)" />
              <rect x={SX + 16} y={CY - 10} width={22} height={20} fill="var(--bad)" opacity={0.85} />
              <rect x={SX + 38} y={CY - 10} width={22} height={20} fill="var(--primary)" opacity={0.85} />
              <text x={SX + 58} y={CY - 26} textAnchor="middle" className="svg-small">chip Hall + imán</text>
            </>
          )}
          {/* entrehierro */}
          <line x1={CX + RT} y1={CY + 22} x2={CX + RT} y2={CY + 32} stroke="var(--muted)" />
          <line x1={SX} y1={CY + 22} x2={SX} y2={CY + 32} stroke="var(--muted)" />
          <text x={SX + 6} y={CY + 32} className="svg-small" style={{ fill: falla === "entrehierro" ? "var(--bad)" : "var(--muted)" }}>
            {falla === "entrehierro" ? "entrehierro 2,5 mm" : "entrehierro 0,8 mm"}
          </text>
          {/* cables */}
          {wires.map((w, k) => (
            <g key={k}>
              <path d={`M${SX + 98},${w.y} C${SX + 140},${w.y} ${470},${110 + k * 26} ${528},${110 + k * 26}`} fill="none" stroke={w.c} strokeWidth={3} />
              <text x={500} y={104 + k * 26} textAnchor="middle" className="svg-small">{w.l}</text>
            </g>
          ))}
          {tipo === "inductivo" && (
            <text x={narrow ? 455 : 430} y={CY + 52} textAnchor={narrow ? "end" : "middle"} className="svg-small">2 cables + malla blindada</text>
          )}
        </g>

        {/* ECU */}
        <g>
          <rect x={530} y={58} width={178} height={190} rx={12} fill="var(--surface)" stroke="var(--c-elec)" strokeWidth={2} />
          <text x={619} y={80} textAnchor="middle" className="svg-title" style={{ fill: "var(--c-elec)" }}>ECU</text>
          <text x={542} y={100} className="svg-small">{tipo === "inductivo" ? "comparador con umbral" : "pull-up + entrada digital"}</text>
          <text x={542} y={114} className="svg-small">{tipo === "inductivo" ? "adaptativo (≈ 0,3 V)" : "cuenta flancos"}</text>
          <rect x={542} y={124} width={154} height={50} rx={8} fill="var(--surface-2)" stroke="var(--border)" />
          <text x={552} y={143} className="svg-small">diente frente al sensor</text>
          <text x={552} y={164} className="svg-mono" style={{ fontSize: 17, fill: inGap ? "var(--accent)" : "var(--text)" }}>
            {inGap ? "HUECO" : `n.º ${toothNow + 1}`}
          </text>
          <text x={542} y={194} className="svg-small">hueco → cuenta grados</text>
          <text x={542} y={208} className="svg-small">hasta el PMS del cil. 1</text>
          <text x={542} y={232} className="svg-small" style={{ fill: tone === "ok" ? "var(--ok)" : tone === "warn" ? "var(--warn)" : "var(--bad)", fontWeight: 700 }}>
            {estado}
          </text>
        </g>
      </svg>
      <div style={{ marginTop: 8 }}>
        <Scope
          traces={[{ fn, color: "#3ddc84", vDiv: tipo === "hall" ? 2 : vDivInd, zero: tipo === "hall" ? 1.5 : 4, label: tipo === "hall" ? "CKP Hall" : "CKP inductivo" }]}
          msDiv={msDiv}
          markers={markers}
          width={narrow ? 480 : 720}
          height={narrow ? 280 : 250}
          label="Señal del sensor de cigüeñal"
        />
      </div>
    </AnimFrame>
  );
}
