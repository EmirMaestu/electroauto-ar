/* Motor de 4 cilindros en línea, cigüeñal a 180°, orden de encendido 1-3-4-2.
   Cada cilindro se pinta según el tiempo en que está; abajo, el diagrama de tiempos
   de los 4 cilindros y el torque instantáneo que entregan los gases al cigüeñal. */
import { useMemo, useRef, useState } from "react";
import { AnimFrame, Readout, Toggle, useAnimClock, clamp, fmt, wrap } from "../ui/anim-kit";
import { D2R, STROKES, cycleOptsFor, cycleState, leverArm, liftAdm, liftEsc, pistonX, strokeIndex, useWide } from "./motor1-kit";

const DEG_PER_S = 90;
/** desfase del ciclo de cada cilindro respecto del cilindro 1 (orden 1-3-4-2) */
const OFF = [0, 180, 540, 360];
const ORDER = [1, 3, 4, 2];
const AREA = (Math.PI / 4) * 0.08 * 0.08; // m²

export function OrdenEncendido() {
  const clock = useAnimClock({ speed: 1 });
  const [solo, setSolo] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const wide = useWide(boxRef, 600);
  const phi = wrap(clock.t * DEG_PER_S, 720);
  const opts = useMemo(() => cycleOptsFor(2500, true), []);

  const torqueOf = (c: number) => {
    const st = cycleState(c, opts);
    return ((st.p - 1) * 1e5 * AREA * leverArm(wrap(c, 360))) / 1000; // N·m
  };
  const curves = useMemo(() => {
    const tot: number[] = [], one: number[] = [];
    for (let f = 0; f <= 720; f += 2) {
      let s = 0;
      for (let i = 0; i < 4; i++) s += torqueOf(f + OFF[i]);
      tot.push(s);
      one.push(torqueOf(f));
    }
    return { tot, one, mean: tot.reduce((a, b) => a + b, 0) / tot.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts]);

  const cyl = [0, 1, 2, 3].map((i) => {
    const c = wrap(phi + OFF[i], 720);
    const st = cycleState(c, opts);
    return { i, c, st, si: strokeIndex(c), lI: liftAdm(c), lE: liftEsc(c), x: pistonX(wrap(c, 360)) };
  });
  const firing = cyl.find((k) => k.si === 2)!;
  const tNow = cyl.reduce((s, k) => s + torqueOf(k.c), 0);

  // ======================================================== PANEL MOTOR
  const S = 0.55; // px/mm
  const XS = [57, 139, 221, 303];
  const BORE = 80 * S + 12; // un poco exagerado para que se vea
  const R = 40 * S, L = 133 * S, PTC = 30 * S, PH = 48 * S;
  const YD = 62; // junta
  const CROWN0 = YD + 1;
  const CY = CROWN0 + PTC + L + R + 4;
  const engine = (
    <g>
      <text x={8} y={14} className="svg-label">Orden de encendido</text>
      {ORDER.map((n, k) => {
        const on = firing.i === n - 1;
        return (
          <g key={k}>
            <rect x={130 + k * 44} y={2} width={34} height={18} rx={9} fill={on ? "var(--c-hot)" : "var(--surface-2)"} stroke={on ? "none" : "var(--border)"} />
            <text x={147 + k * 44} y={15} textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: on ? "#fff" : "var(--text-2)" }}>{n}</text>
            {k < 3 && <text x={168 + k * 44} y={15} textAnchor="middle" className="svg-small">›</text>}
          </g>
        );
      })}
      {/* tapa */}
      <rect x={12} y={28} width={336} height={YD - 28} rx={6} fill="var(--c-metal-light)" stroke="var(--c-metal-2)" />
      {/* block */}
      <rect x={12} y={YD} width={336} height={CY - YD - 20} fill="var(--c-block)" stroke="var(--c-metal-2)" />
      <path d={`M12,${CY - 20} L12,${CY + 34} Q12,${CY + 46} 24,${CY + 46} L336,${CY + 46} Q348,${CY + 46} 348,${CY + 34} L348,${CY - 20} Z`} fill="var(--surface-2)" stroke="var(--border-strong)" />
      {/* eje del cigüeñal */}
      <line x1={14} y1={CY} x2={346} y2={CY} stroke="var(--c-metal-dark)" strokeWidth={9} strokeLinecap="round" />
      {cyl.map((k) => {
        const x = XS[k.i];
        const crown = CROWN0 + k.x * S;
        const th = wrap(k.c, 360) * D2R;
        const pinY = CY - R * Math.cos(th);
        const depth = Math.sin(th); // + hacia el que mira
        const s = STROKES[k.si];
        const hot = clamp((k.st.T - 273 - 450) / 1500, 0, 0.85);
        const spark = k.c >= k.st.ign - 1 && k.c <= k.st.ign + 14;
        const lI = k.lI * 0.9, lE = k.lE * 0.9;
        return (
          <g key={k.i}>
            {/* cilindro */}
            <rect x={x - BORE / 2} y={YD} width={BORE} height={CY - YD - 26} fill="var(--surface)" />
            <rect x={x - BORE / 2} y={YD - 6} width={BORE} height={crown - YD + 6} fill={s.color} opacity={0.22 + (k.si === 1 ? 0.25 * (1 - k.x / 80) : 0)} />
            {hot > 0 && <rect x={x - BORE / 2} y={YD - 6} width={BORE} height={crown - YD + 6} fill="var(--c-hot)" opacity={hot} />}
            {/* válvulas (adm. izquierda, esc. derecha) */}
            <rect x={x - 17} y={YD - 22 + lI} width={3} height={18} fill="var(--c-metal-dark)" />
            <rect x={x - 23} y={YD - 6 + lI} width={15} height={4} rx={1} fill="var(--c-air)" />
            <rect x={x + 14} y={YD - 22 + lE} width={3} height={18} fill="var(--c-metal-dark)" />
            <rect x={x + 8} y={YD - 6 + lE} width={15} height={4} rx={1} fill="var(--c-exhaust)" />
            {/* bujía */}
            <rect x={x - 3} y={30} width={6} height={YD - 34} fill="var(--c-metal-dark)" />
            {spark && <circle cx={x} cy={YD - 4} r={9} fill="var(--c-spark)" opacity={0.85} />}
            {/* pistón y biela */}
            <rect x={x - BORE / 2 + 1.5} y={crown} width={BORE - 3} height={PH} rx={2} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
            <line x1={x - BORE / 2 + 1.5} y1={crown + 4} x2={x + BORE / 2 - 1.5} y2={crown + 4} stroke="var(--c-metal-dark)" strokeWidth={1.5} />
            <line x1={x - BORE / 2 + 1.5} y1={crown + 8} x2={x + BORE / 2 - 1.5} y2={crown + 8} stroke="var(--c-metal-dark)" strokeWidth={1.5} />
            <line x1={x} y1={crown + PTC} x2={x} y2={pinY} stroke="var(--c-metal-2)" strokeWidth={9} strokeLinecap="round" />
            {/* manivela vista de costado */}
            <rect x={x - 17} y={Math.min(CY, pinY) - 6} width={7} height={Math.abs(pinY - CY) + 12} rx={3} fill="var(--c-metal-dark)" opacity={0.75 + 0.25 * depth} />
            <rect x={x + 10} y={Math.min(CY, pinY) - 6} width={7} height={Math.abs(pinY - CY) + 12} rx={3} fill="var(--c-metal-dark)" opacity={0.75 + 0.25 * depth} />
            <rect x={x - 12} y={pinY - 6} width={24} height={12} rx={4} fill={depth > 0 ? "var(--c-metal-light)" : "var(--c-metal-2)"} stroke="var(--c-metal-dark)" />
            {/* número y tiempo */}
            <circle cx={x - 30} cy={44} r={8.5} fill="var(--text)" />
            <text x={x - 30} y={48} textAnchor="middle" style={{ fontSize: 11, fontWeight: 800, fill: "var(--bg)" }}>{k.i + 1}</text>
            <rect x={x - 38} y={CY + 54} width={76} height={20} rx={10} fill={s.color} />
            <text x={x} y={CY + 68} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 800, fill: "#fff", letterSpacing: ".02em" }}>{s.name.toUpperCase()}</text>
          </g>
        );
      })}
      <text x={180} y={CY + 90} textAnchor="middle" className="svg-small">
        Muñones de 1 y 4 arriba juntos, 2 y 3 abajo juntos (cigüeñal a 180°)
      </text>
    </g>
  );

  // ======================================================== PANEL DIAGRAMA
  const tx0 = 44, tx1 = 350;
  const mx = (f: number) => tx0 + (f / 720) * (tx1 - tx0);
  const gy0 = 176, gy1 = 282;
  const tMin = -150, tMax = Math.max(450, Math.ceil(Math.max(...curves.tot) / 50) * 50 + 20);
  const my = (t: number) => gy1 - ((clamp(t, tMin, tMax) - tMin) / (tMax - tMin)) * (gy1 - gy0);
  const path = (arr: number[]) => arr.map((v, j) => `${j ? "L" : "M"}${mx(j * 2).toFixed(1)},${my(v).toFixed(1)}`).join("");
  const chart = (
    <g>
      <text x={8} y={14} className="svg-label">Qué hace cada cilindro en los 720°</text>
      {[0, 1, 2, 3].map((i) => {
        const y = 24 + i * 24;
        return (
          <g key={i}>
            <text x={tx0 - 8} y={y + 14} textAnchor="end" style={{ fontSize: 11, fontWeight: 800, fill: "var(--text)" }}>cil. {i + 1}</text>
            {[0, 1, 2, 3].map((k) => {
              // franja de cada tiempo en el eje global
              const a = wrap(k * 180 - OFF[i], 720);
              const si = k % 4;
              const segs = a + 180 <= 720 ? [[a, a + 180]] : [[a, 720], [0, a + 180 - 720]];
              return segs.map(([s0, s1], j) => (
                <rect key={`${k}-${j}`} x={mx(s0) + 0.5} y={y} width={Math.max(0, mx(s1) - mx(s0) - 1)} height={19} rx={3}
                  fill={STROKES[si].color} opacity={si === 2 ? 0.95 : 0.4} />
              ));
            })}
            {(() => {
              const fa = wrap(360 - OFF[i], 720);
              return <text x={mx(fa) + 4} y={y + 13.5} style={{ fontSize: 9.5, fontWeight: 800, fill: "#fff" }}>EXPLOSIÓN</text>;
            })()}
          </g>
        );
      })}
      {[0, 180, 360, 540, 720].map((f) => (
        <g key={f}>
          <line x1={mx(f)} y1={120} x2={mx(f)} y2={125} stroke="var(--muted)" />
          <text x={mx(f)} y={136} textAnchor="middle" className="svg-small">{f}°</text>
        </g>
      ))}
      <text x={(tx0 + tx1) / 2} y={150} textAnchor="middle" className="svg-small" style={{ fontWeight: 700 }}>
        cada 180° de cigüeñal explota un cilindro: nunca hay un hueco
      </text>
      {/* torque */}
      <text x={8} y={170} className="svg-label">Torque de los gases sobre el cigüeñal</text>
      <rect x={tx0} y={gy0} width={tx1 - tx0} height={gy1 - gy0} rx={5} fill="var(--surface)" stroke="var(--border)" />
      {[0, 200, 400].map((t) => (
        <g key={t}>
          <line x1={tx0} y1={my(t)} x2={tx1} y2={my(t)} stroke="var(--border)" strokeDasharray={t === 0 ? "" : "2 4"} />
          <text x={tx0 - 5} y={my(t) + 3.5} textAnchor="end" className="svg-small">{t}</text>
        </g>
      ))}
      <text x={tx0 + 4} y={gy0 + 11} className="svg-small">N·m</text>
      {solo && <path d={path(curves.one)} fill="none" stroke="var(--muted)" strokeWidth={1.8} strokeDasharray="5 3" />}
      <path d={path(curves.tot)} fill="none" stroke="var(--accent)" strokeWidth={2.4} />
      <line x1={tx0} y1={my(curves.mean)} x2={tx1} y2={my(curves.mean)} stroke="var(--ok)" strokeWidth={1.5} strokeDasharray="6 3" />
      <text x={tx1 - 4} y={my(curves.mean) - 4} textAnchor="end" className="svg-small" style={{ fill: "var(--ok)", fontWeight: 700 }}>promedio ≈ {fmt(curves.mean, 0)} N·m</text>
      {solo && <text x={tx0 + 4} y={gy1 - 5} className="svg-small" style={{ fill: "var(--muted)", fontWeight: 700 }}>--- un solo cilindro</text>}
      {/* cursor */}
      <line x1={mx(phi)} y1={20} x2={mx(phi)} y2={gy1} stroke="var(--text)" strokeWidth={1.4} opacity={0.8} />
      <circle cx={mx(phi)} cy={my(tNow)} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />
    </g>
  );

  const W = wide ? 720 : 360, HA = CY + 96, HB = 290;
  const H = wide ? Math.max(HA, HB) : HA + HB;
  return (
    <AnimFrame
      title="Orden de encendido 1-3-4-2 en un 4 cilindros en línea"
      clock={clock}
      controls={<Toggle label="Comparar con un solo cilindro" checked={solo} onChange={setSolo} />}
      readouts={
        <>
          <Readout label="Cigüeñal (cil. 1)" value={fmt(phi, 0)} unit="° de 720" />
          <Readout label="En explosión" value={`cil. ${firing.i + 1}`} tone="accent" />
          <Readout label="Presión en ese cil." value={fmt(firing.st.p, 0)} unit="bar" />
          <Readout label="Torque instantáneo" value={fmt(tNow, 0)} unit="N·m" tone={tNow < 0 ? "bad" : "ok"} />
        </>
      }
      legend={STROKES.map((s) => ({ color: s.color, label: s.name }))}
      caption={
        <>
          <p>
            Los muñones del cigüeñal de un 4 en línea están a <b>180°</b>: los pistones 1 y 4 suben y bajan juntos, y el 2 y el 3
            también, pero al revés. Aunque 1 y 4 llegan juntos al PMS, <b>no hacen lo mismo</b>: cuando uno está terminando la compresión
            (y salta su chispa), el otro está terminando el escape. Eso lo decide el árbol de levas, no el cigüeñal.
          </p>
          <p>
            Con el orden <b>1-3-4-2</b> hay una explosión cada 180°, o sea dos por vuelta. Mirá la curva de torque: es una montaña rusa
            (hay momentos en que los gases incluso frenan al cigüeñal, en rojo en el indicador), pero no tiene huecos largos. Activá{" "}
            <b>“un solo cilindro”</b> y vas a ver por qué un monocilíndrico necesita un volante pesado: entre una explosión y la otra
            pasan 720° sin empuje.
          </p>
        </>
      }
    >
      <div ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Orden de encendido de un motor de 4 cilindros">
          <g>{engine}</g>
          <g transform={wide ? "translate(360,0)" : `translate(0,${HA})`}>{chart}</g>
        </svg>
      </div>
    </AnimFrame>
  );
}
