/* Escala de decibeles: logarítmica, con situaciones de referencia del taller y de la calle.
   Nivel en el oído:  L = L₁ + 10·log₁₀(N) − 20·log₁₀(r)   (N fuentes iguales, r metros, campo libre)
   Presión sonora:     p = 20 µPa · 10^(L/20)
   Exposición máxima:  8 h a 85 dB(A); la mitad del tiempo por cada 3 dB más. */
import { useId, useState } from "react";
import { AnimFrame, Readout, Seg, Slider, useAnimClock, fmt } from "../ui/anim-kit";

const REFS = [
  { db: 0, t: "Umbral de audición" },
  { db: 20, t: "Dormitorio de noche" },
  { db: 40, t: "Oficina tranquila" },
  { db: 60, t: "Conversación a 1 m" },
  { db: 70, t: "Adentro del auto a 100 km/h" },
  { db: 80, t: "Compresor de taller, cerca" },
  { db: 90, t: "Motor acelerando, capot abierto" },
  { db: 100, t: "Amoladora, en el oído" },
  { db: 110, t: "Llave de impacto · bocina a 2 m" },
  { db: 120, t: "Martillo sobre chapa, muy cerca" },
  { db: 130, t: "Umbral de dolor" },
];

const FUENTES = [
  { id: "comp", label: "Compresor", L1: 85 },
  { id: "amol", label: "Amoladora", L1: 100 },
  { id: "imp", label: "Llave de impacto", L1: 105 },
];

function exposicion(L: number) {
  if (L <= 85) return { v: "8 h o más", tone: "ok" as const };
  const h = 8 / 2 ** ((L - 85) / 3);
  if (h >= 1) return { v: `${fmt(h, h < 2 ? 1 : 0)} h`, tone: "warn" as const };
  const min = h * 60;
  if (min >= 1) return { v: `${fmt(min, 0)} min`, tone: "bad" as const };
  return { v: `${fmt(min * 60, 0)} s`, tone: "bad" as const };
}

export function Decibeles() {
  const clock = useAnimClock({ speed: 1 });
  const [src, setSrc] = useState("amol");
  const [n, setN] = useState(1);
  const [r, setR] = useState(1);
  const uid = useId().replace(/:/g, "");
  const F = FUENTES.find((x) => x.id === src)!;
  const L = F.L1 + 10 * Math.log10(n) - 20 * Math.log10(r);
  const p = 20e-6 * 10 ** (L / 20);
  const ratio = n / (r * r);
  const ex = exposicion(L);

  /* escala */
  const BX = 150, BW = 24, YB = 372, YT = 36;
  const y = (db: number) => YB - (Math.max(-5, Math.min(135, db)) / 130) * (YB - YT);

  /* escena */
  const SX = 458, SY = 186;
  const lx = (m: number) => 520 + Math.log2(m) * 35;
  const LX = lx(r);
  const icons = Array.from({ length: n }, (_, i) => ({ x: SX - 22 + (i % 2) * 26, y: SY - 58 + Math.floor(i / 2) * 26 }));
  const ring = (k: number) => ((clock.t * 0.9 + k / 3) % 1);

  return (
    <AnimFrame
      title="Decibeles: una escala que suma multiplicando"
      clock={clock}
      controls={
        <>
          <Seg value={src} onChange={setSrc} ariaLabel="Fuente" options={FUENTES.map((x) => ({ value: x.id, label: x.label }))} />
          <Seg value={n} onChange={setN} ariaLabel="Cantidad de máquinas" options={[1, 2, 4, 10].map((v) => ({ value: v, label: `${v} ${v === 1 ? "máquina" : "iguales"}` }))} />
          <Slider label="Distancia a tu oído" value={r} min={1} max={32} step={0.5} onChange={setR} unit="m" format={(v) => fmt(v, v < 10 ? 1 : 0)} />
        </>
      }
      readouts={
        <>
          <Readout label="Nivel en tu oído" value={fmt(L, 0)} unit="dB(A)" tone={L > 85 ? "bad" : L > 80 ? "warn" : "ok"} />
          <Readout label="Presión sonora" value={p < 1 ? fmt(p * 1000, 0) : fmt(p, 1)} unit={p < 1 ? "mPa" : "Pa"} />
          <Readout label="Potencia que te llega" value={ratio >= 1 ? `×${fmt(ratio, 0)}` : `÷${fmt(1 / ratio, 0)}`} unit="vs 1 a 1 m" />
          <Readout label="Exposición máxima por día" value={ex.v} tone={ex.tone} />
        </>
      }
      legend={[
        { color: "var(--ok)", label: "Sin riesgo para el oído" },
        { color: "var(--warn)", label: "80–85 dB(A): usá protección si es todo el día" },
        { color: "var(--bad)", label: "Más de 85 dB(A): protección auditiva sí o sí" },
      ]}
      caption={
        <>
          <p>
            Probá con <b>2 máquinas iguales</b>: el nivel sube sólo <b>3 dB</b>, aunque la potencia es el doble. Con 10 máquinas sube 10 dB
            (diez veces la potencia), y el oído lo siente como &quot;el doble de fuerte&quot;. Ahora alejate: cada vez que <b>duplicás la
            distancia</b>, bajan <b>6 dB</b> (la potencia se reparte en un área cuatro veces mayor).
          </p>
          <p>
            Esa es la trampa del decibel: 100 dB no es &quot;un poco más&quot; que 90; es <b>diez veces</b> más potencia. Y el tiempo que tu
            oído aguanta se corta a la mitad cada 3 dB: 8 horas a 85 dB(A), 15 minutos a 100. Valores de referencia aproximados.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 400" role="img" aria-label="Escala de decibeles con referencias">
        {/* barra */}
        <rect x={BX} y={y(80)} width={BW} height={y(0) - y(80)} fill="var(--ok)" opacity={0.55} />
        <rect x={BX} y={y(85)} width={BW} height={y(80) - y(85)} fill="var(--warn)" opacity={0.75} />
        <rect x={BX} y={y(130)} width={BW} height={y(85) - y(130)} fill="var(--bad)" opacity={0.6} />
        <rect x={BX} y={y(130)} width={BW} height={y(0) - y(130)} fill="none" stroke="var(--border-strong)" rx={3} />
        <line x1={BX - 10} y1={y(85)} x2={BX + BW + 4} y2={y(85)} stroke="var(--bad)" strokeWidth={2} strokeDasharray="4 3" />
        {Math.abs(L - 85) > 7 && <text x={BX - 12} y={y(85) + 4} textAnchor="end" className="svg-small" style={{ fill: "var(--bad)", fontWeight: 700 }}>85: límite 8 h</text>}
        {REFS.map((R) => (
          <g key={R.db}>
            <line x1={BX + BW} y1={y(R.db)} x2={BX + BW + 8} y2={y(R.db)} stroke="var(--muted)" />
            <text x={BX + BW + 12} y={y(R.db) + 4} className="svg-mono" style={{ fontSize: 11 }}>{R.db}</text>
            <text x={BX + BW + 40} y={y(R.db) + 4} className="svg-label" style={{ fontSize: 11.5 }}>{R.t}</text>
          </g>
        ))}
        <text x={BX + BW / 2} y={YB + 20} textAnchor="middle" className="svg-small">dB(A)</text>
        {/* marcador */}
        <g>
          <polygon points={`${BX - 2},${y(L)} ${BX - 14},${y(L) - 8} ${BX - 14},${y(L) + 8}`} fill="var(--accent)" />
          <line x1={BX - 2} y1={y(L)} x2={BX + BW} y2={y(L)} stroke="var(--accent)" strokeWidth={3} />
          <text x={BX - 18} y={y(L) - 4} textAnchor="end" className="svg-label" style={{ fill: "var(--accent)", fontSize: 13 }}>tu oído</text>
          <text x={BX - 18} y={y(L) + 12} textAnchor="end" className="svg-mono" style={{ fill: "var(--accent)" }}>{fmt(L, 0)} dB</text>
        </g>

        {/* escena: fuentes y distancia */}
        <rect x={418} y={24} width={292} height={360} rx={10} fill="var(--surface)" stroke="var(--border)" />
        <text x={432} y={46} className="svg-title" style={{ fontSize: 13 }}>Fuentes y distancia</text>
        <defs><clipPath id={`sc${uid}`}><rect x={420} y={56} width={288} height={250} /></clipPath></defs>
        <g clipPath={`url(#sc${uid})`}>
          {[0, 1, 2].map((k) => {
            const f = ring(k);
            return <circle key={k} cx={SX} cy={SY} r={24 + f * 110} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={(1 - f) * 0.5} />;
          })}
        </g>
        {icons.map((ic, i) => (
          <g key={i}>
            <rect x={ic.x} y={ic.y} width={20} height={18} rx={3} fill="var(--c-metal-dark)" />
            <circle cx={ic.x + 10} cy={ic.y + 9} r={5} fill="var(--c-metal-light)" />
          </g>
        ))}
        <text x={SX} y={SY + 92} textAnchor="middle" className="svg-small">{n} × {F.label.toLowerCase()}</text>
        <text x={SX} y={SY + 106} textAnchor="middle" className="svg-small">{F.L1} dB a 1 m c/u</text>
        {/* eje de distancia (logarítmico) */}
        <line x1={lx(1)} y1={326} x2={lx(32)} y2={326} stroke="var(--border-strong)" />
        {[1, 2, 4, 8, 16, 32].map((m, i) => (
          <g key={m}>
            <line x1={lx(m)} y1={320} x2={lx(m)} y2={332} stroke="var(--muted)" />
            <text x={lx(m)} y={346} textAnchor="middle" className="svg-small">{m} m</text>
            {i > 0 && <text x={(lx(m) + lx(m / 2)) / 2} y={316} textAnchor="middle" className="svg-small" style={{ fill: "var(--primary)" }}>−6</text>}
          </g>
        ))}
        <text x={432} y={368} className="svg-small">cada vez que duplicás la distancia: −6 dB</text>
        {/* oyente */}
        <line x1={LX} y1={262} x2={LX} y2={320} stroke="var(--accent)" strokeDasharray="3 3" />
        <g>
          <circle cx={LX} cy={244} r={13} fill="var(--c-flame)" opacity={0.9} />
          <ellipse cx={LX - 12} cy={245} rx={4} ry={6} fill="var(--c-flame)" />
          <rect x={LX - 12} y={258} width={24} height={14} rx={6} fill="var(--c-metal-2)" />
        </g>
        <text x={LX} y={222} textAnchor={LX > 640 ? "end" : "middle"} className="svg-mono" style={{ fill: "var(--accent)" }}>{fmt(L, 0)} dB(A)</text>
      </svg>
    </AnimFrame>
  );
}
