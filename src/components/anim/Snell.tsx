/* Ley de Snell con reflexión parcial (Fresnel) y reflexión total interna.
   n₁·sen θ₁ = n₂·sen θ₂ ; si n₁ > n₂ y θ₁ > θc = arcsen(n₂/n₁) no hay rayo refractado.
   Los puntos son crestas de la onda: en el medio más denso van más lentas y más juntas (λ/n). */
import { useState } from "react";
import { AnimFrame, Readout, Seg, Slider, Toggle, useAnimClock, fmt, rad, deg } from "../ui/anim-kit";

type Par = "aire-vidrio" | "aire-agua" | "vidrio-aire" | "vidrio-agua";
const MEDIOS: Record<Par, { n1: number; n2: number; a: string; b: string }> = {
  "aire-vidrio": { n1: 1.0, n2: 1.5, a: "Aire", b: "Vidrio" },
  "aire-agua": { n1: 1.0, n2: 1.33, a: "Aire", b: "Agua" },
  "vidrio-aire": { n1: 1.5, n2: 1.0, a: "Vidrio", b: "Aire" },
  "vidrio-agua": { n1: 1.5, n2: 1.33, a: "Vidrio", b: "Agua" },
};
const fillOf = (m: string) => (m === "Vidrio" ? "var(--teal)" : m === "Agua" ? "var(--c-air)" : "transparent");

/** Reflectancia de Fresnel para luz no polarizada. */
function fresnel(n1: number, n2: number, t1: number) {
  const s2 = (n1 / n2) * Math.sin(t1);
  if (s2 >= 1) return 1;
  const t2 = Math.asin(s2);
  const c1 = Math.cos(t1), c2 = Math.cos(t2);
  const rs = (n1 * c1 - n2 * c2) / (n1 * c1 + n2 * c2);
  const rp = (n1 * c2 - n2 * c1) / (n1 * c2 + n2 * c1);
  return (rs * rs + rp * rp) / 2;
}

const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p0 = [cx + r * Math.cos(rad(a0)), cy + r * Math.sin(rad(a0))];
  const p1 = [cx + r * Math.cos(rad(a1)), cy + r * Math.sin(rad(a1))];
  const sweep = a1 > a0 ? 1 : 0;
  return `M${p0[0]},${p0[1]} A${r},${r} 0 0 ${sweep} ${p1[0]},${p1[1]}`;
};

export function Snell() {
  const clock = useAnimClock({ speed: 1 });
  const [par, setPar] = useState<Par>("vidrio-aire");
  const [ang, setAng] = useState(35);
  const [auto, setAuto] = useState(false);
  const M = MEDIOS[par];
  const t1d = auto ? 44 + 44 * Math.sin(clock.t * 0.45) : ang;
  const t1 = rad(t1d);
  const s2 = (M.n1 / M.n2) * Math.sin(t1);
  const tir = s2 >= 1;
  const t2 = tir ? NaN : Math.asin(s2);
  const R = fresnel(M.n1, M.n2, t1);
  const crit = M.n1 > M.n2 ? deg(Math.asin(M.n2 / M.n1)) : NaN;

  const O = { x: 360, y: 210 }, L = 200;
  const S = { x: O.x - L * Math.sin(t1), y: O.y - L * Math.cos(t1) };
  const Rf = { x: O.x + L * Math.sin(t1), y: O.y - L * Math.cos(t1) };
  const Tr = tir ? null : { x: O.x + L * Math.sin(t2), y: O.y + L * Math.cos(t2) };

  // crestas de onda
  const LAM0 = 34, F = 1.1;
  const ph = clock.t * F;
  const fr = ph - Math.floor(ph);
  const l1 = LAM0 / M.n1, l2 = LAM0 / M.n2;
  const dotsIn: { x: number; y: number }[] = [];
  for (let k = 0; ; k++) {
    const d = l1 * (k + 1 - fr);
    if (d > L) break;
    dotsIn.push({ x: O.x - d * Math.sin(t1), y: O.y - d * Math.cos(t1) });
  }
  const dotsOut = (dir: { x: number; y: number }, lam: number) => {
    const out: { x: number; y: number }[] = [];
    for (let k = 0; ; k++) {
      const d = lam * (k + fr);
      if (d > L) break;
      out.push({ x: O.x + d * dir.x, y: O.y + d * dir.y });
    }
    return out;
  };
  const dotsR = dotsOut({ x: Math.sin(t1), y: -Math.cos(t1) }, l1);
  const dotsT = tir ? [] : dotsOut({ x: Math.sin(t2), y: Math.cos(t2) }, l2);
  const rayColor = "var(--c-spark)";

  return (
    <AnimFrame
      title="Refracción y reflexión total: Ley de Snell"
      clock={clock}
      controls={
        <>
          <Seg value={par} onChange={setPar} ariaLabel="Medios"
            options={(Object.keys(MEDIOS) as Par[]).map((k) => ({ value: k, label: `${MEDIOS[k].a} → ${MEDIOS[k].b}` }))} />
          <Slider label="Ángulo de incidencia θ₁" value={Math.round(t1d)} min={0} max={89} step={1} onChange={(v) => { setAuto(false); setAng(v); }} unit="°" />
          <Toggle label="Barrido automático" checked={auto} onChange={setAuto} />
        </>
      }
      readouts={
        <>
          <Readout label="Índices de refracción" value={`${fmt(M.n1, 2)} → ${fmt(M.n2, 2)}`} />
          <Readout label="Ángulo refractado θ₂" value={tir ? "no hay" : fmt(deg(t2), 1)} unit={tir ? "" : "°"} tone={tir ? "bad" : undefined} />
          <Readout label="Ángulo crítico θc" value={Number.isNaN(crit) ? "no existe" : fmt(crit, 1)} unit={Number.isNaN(crit) ? "" : "°"} />
          <Readout label="Luz reflejada" value={fmt(R * 100, R > 0.995 ? 0 : 1)} unit="%" tone={tir ? "accent" : undefined} />
        </>
      }
      legend={[
        { color: "var(--c-spark)", label: "Rayo de luz (los puntos son las crestas de la onda)" },
        { color: "var(--teal)", label: "Vidrio (n ≈ 1,5)" },
        { color: "var(--c-air)", label: "Agua (n ≈ 1,33)" },
      ]}
      caption={
        <>
          <p>
            Al pasar a un medio <b>más denso ópticamente</b> (n más alto), la luz va más lenta: las crestas se juntan y el rayo se
            <b> acerca a la normal</b>. Al revés, se aleja. Siempre una parte rebota: a incidencia casi perpendicular, un vidrio refleja
            sólo un 4 %; rasante, casi todo.
          </p>
          <p>
            Elegí <b>Vidrio → Aire</b> y pasá los {fmt(deg(Math.asin(1 / 1.5)), 1)}°: el rayo refractado desaparece y
            <b> toda la luz se refleja</b>. Es la reflexión total interna, la base del sensor de lluvia y de la fibra óptica. Ahora probá
            Vidrio → Agua: el ángulo crítico sube a {fmt(deg(Math.asin(1.33 / 1.5)), 1)}°, así que con 45° la luz <b>se escapa</b> hacia la gota.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 420" role="img" aria-label="Rayo de luz cambiando de medio">
        <rect x={0} y={0} width={720} height={O.y} fill={fillOf(M.a)} opacity={0.14} />
        <rect x={0} y={O.y} width={720} height={420 - O.y} fill={fillOf(M.b)} opacity={0.14} />
        <line x1={0} y1={O.y} x2={720} y2={O.y} stroke="var(--border-strong)" strokeWidth={2} />
        <text x={14} y={26} className="svg-label" style={{ fontSize: 15 }}>{M.a} · n = {fmt(M.n1, 2)}</text>
        <text x={14} y={O.y + 26} className="svg-label" style={{ fontSize: 15 }}>{M.b} · n = {fmt(M.n2, 2)}</text>
        {/* normal */}
        <line x1={O.x} y1={O.y - 190} x2={O.x} y2={O.y + 190} stroke="var(--muted)" strokeDasharray="5 5" />
        <text x={O.x + 6} y={O.y - 176} className="svg-small">normal</text>
        {/* ángulo crítico */}
        {!Number.isNaN(crit) && (
          <g>
            <line x1={O.x} y1={O.y} x2={O.x - 170 * Math.sin(rad(crit))} y2={O.y - 170 * Math.cos(rad(crit))} stroke="var(--bad)" strokeDasharray="3 4" opacity={0.7} />
            <text x={O.x - 170 * Math.sin(rad(crit)) - 6} y={O.y - 170 * Math.cos(rad(crit)) - 6} textAnchor="end" className="svg-small" style={{ fill: "var(--bad)" }}>
              ángulo crítico {fmt(crit, 1)}°
            </text>
          </g>
        )}
        {/* rayos */}
        <line x1={S.x} y1={S.y} x2={O.x} y2={O.y} stroke={rayColor} strokeWidth={4} strokeLinecap="round" />
        <line x1={O.x} y1={O.y} x2={Rf.x} y2={Rf.y} stroke={rayColor} strokeWidth={1 + 3 * R} opacity={Math.max(0.15, R)} strokeLinecap="round" />
        {Tr && <line x1={O.x} y1={O.y} x2={Tr.x} y2={Tr.y} stroke={rayColor} strokeWidth={1 + 3 * (1 - R)} opacity={Math.max(0.15, 1 - R)} strokeLinecap="round" />}
        {dotsIn.map((d, i) => <circle key={`i${i}`} cx={d.x} cy={d.y} r={4} fill="var(--accent)" />)}
        {dotsR.map((d, i) => <circle key={`r${i}`} cx={d.x} cy={d.y} r={4} fill="var(--accent)" opacity={Math.max(0.12, R)} />)}
        {dotsT.map((d, i) => <circle key={`t${i}`} cx={d.x} cy={d.y} r={4} fill="var(--accent)" opacity={Math.max(0.12, 1 - R)} />)}
        {/* ángulos */}
        <path d={arc(O.x, O.y, 54, -90, -90 - t1d)} fill="none" stroke="var(--text)" strokeWidth={1.5} />
        <text x={O.x - 64 * Math.sin(rad(t1d / 2)) - 4} y={O.y - 64 * Math.cos(rad(t1d / 2))} textAnchor="end" className="svg-label">θ₁ = {fmt(t1d, 0)}°</text>
        <path d={arc(O.x, O.y, 44, -90, -90 + t1d)} fill="none" stroke="var(--muted)" strokeWidth={1.2} />
        {!tir && (
          <g>
            <path d={arc(O.x, O.y, 54, 90, 90 - deg(t2))} fill="none" stroke="var(--text)" strokeWidth={1.5} />
            <text x={O.x + 64 * Math.sin(t2 / 2) + 4} y={O.y + 64 * Math.cos(t2 / 2) + 10} className="svg-label">θ₂ = {fmt(deg(t2), 1)}°</text>
          </g>
        )}
        <circle cx={O.x} cy={O.y} r={4} fill="var(--text)" />
        {tir && (
          <g>
            <rect x={430} y={O.y + 50} width={270} height={52} rx={10} fill="var(--bad-soft)" stroke="var(--bad)" />
            <text x={565} y={O.y + 72} textAnchor="middle" className="svg-label" style={{ fill: "var(--bad)", fontSize: 14 }}>Reflexión total interna</text>
            <text x={565} y={O.y + 90} textAnchor="middle" className="svg-small">no sale luz: toda rebota hacia arriba</text>
          </g>
        )}
      </svg>
    </AnimFrame>
  );
}
