/* Los aros del pistón en primer plano. La "cámara" viaja pegada al pistón: lo que se mueve es la pared.
   - La presión de los gases se mete detrás del aro y lo aprieta contra la pared y contra el flanco de abajo.
   - El aceitero raspa el aceite de la pared y lo devuelve por los agujeros de drenaje.
   - Con aros gastados: blow-by (gases al cárter) y aceite que sube a la cámara (humo azul). */
import { useMemo, useRef, useState } from "react";
import { AnimFrame, Readout, Toggle, useAnimClock, Arrow, clamp, fmt, wrap } from "../ui/anim-kit";
import { STROKES, cycleOptsFor, cycleState, pistonX, strokeIndex, useWide } from "./motor1-kit";

const DEG_PER_S = 70;

export function Aros() {
  const clock = useAnimClock({ speed: 1 });
  const [worn, setWorn] = useState(false);
  const [forces, setForces] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);
  const wide = useWide(boxRef, 600);
  const opts = useMemo(() => cycleOptsFor(2500, true), []);
  const phi = wrap(clock.t * DEG_PER_S, 720);
  const st = cycleState(phi, opts);
  const si = strokeIndex(phi);
  const xmm = pistonX(wrap(phi, 360));
  const down = si === 0 || si === 2; // el pistón baja en admisión y explosión
  const pRel = Math.max(0, st.p - 1);

  // ======================================================== PANEL A (zoom)
  const WX = 262; // superficie de la pared (camisa)
  const PX = 254; // borde del pistón (luz exagerada)
  const YC = 122; // corona del pistón (fija: la cámara viaja con el pistón)
  const GD = 30; // profundidad de ranura
  const ring = worn ? 3.5 : 0; // desgaste: el aro ya no llega a la pared
  const grooves = [
    { y: 140, h: 14, rh: 10.5, kind: "comp" },
    { y: 170, h: 14, rh: 10.5, kind: "second" },
    { y: 200, h: 24, rh: 21, kind: "oil" },
  ] as const;
  // posición del aro en la ranura: abajo si hay presión o si el pistón sube; arriba si baja sin presión
  const onLower = st.p > 2.5 || !down;
  const wallOff = wrap(-xmm * 2.4, 24);
  const hatch: React.ReactNode[] = [];
  for (let y = -24; y < 380; y += 12) {
    const yy = y + wallOff;
    if (yy < 14 || yy > 352) continue;
    hatch.push(<line key={`a${y}`} x1={WX} y1={yy} x2={WX + 12} y2={yy + 9} stroke="var(--c-metal-2)" strokeWidth={0.8} opacity={0.6} />);
    hatch.push(<line key={`b${y}`} x1={WX} y1={yy + 9} x2={WX + 12} y2={yy} stroke="var(--c-metal-2)" strokeWidth={0.8} opacity={0.6} />);
  }
  // partículas
  const blowN = worn ? 14 : 3;
  const blowOn = clamp(pRel / 20, 0, 1) * (worn ? 1 : 0.55);
  const blow = blowOn > 0.05
    ? Array.from({ length: blowN }, (_, i) => {
        const u = wrap(i / blowN + phi / 35, 1);
        return <circle key={i} cx={PX + 4 + ((i * 5) % 3) - 1} cy={104 + u * 250} r={2.6} fill="var(--bad)" opacity={blowOn * (1 - u * 0.5)} />;
      })
    : null;
  const oilUpOn = worn && (si === 0 || (si === 3 && phi > 650)) ? 1 : 0;
  const oilUp = oilUpOn
    ? Array.from({ length: 8 }, (_, i) => {
        const u = wrap(i / 8 + phi / 55, 1);
        const y = 236 - u * 170;
        const x = y < YC ? PX - (YC - y) * 1.6 : PX + 4;
        return <circle key={i} cx={x} cy={y} r={3} fill="var(--c-oil)" />;
      })
    : null;
  const scrape = down
    ? Array.from({ length: 5 }, (_, i) => {
        const u = wrap(i / 5 + phi / 30, 1);
        const x = PX - GD - u * 40;
        const y = 210 + Math.max(0, u - 0.6) * 150;
        return <circle key={i} cx={x} cy={y} r={2.6} fill="var(--c-oil)" />;
      })
    : null;
  const blueSmoke = worn && phi > 380 && phi < 700;

  const s = STROKES[si];
  const panelA = (
    <g>
      <text x={8} y={12} className="svg-label">Zoom a los aros (la cámara viaja con el pistón)</text>
      {/* cámara de combustión */}
      <rect x={14} y={20} width={WX - 14} height={YC - 20} fill="var(--surface)" />
      <rect x={14} y={20} width={WX - 14} height={YC - 20} fill={s.color} opacity={0.18 + clamp(pRel / 80, 0, 0.36)} />
      {blueSmoke && <rect x={14} y={20} width={WX - 14} height={YC - 20} fill="var(--c-mix)" opacity={0.35} />}
      <text x={26} y={42} style={{ fontSize: 14, fontWeight: 800, fill: "var(--text)" }}>{s.name.toUpperCase()}</text>
      <text x={26} y={58} className="svg-small" style={{ fontWeight: 700, fill: "var(--text-2)" }}>{fmt(st.p, st.p < 10 ? 1 : 0)} bar sobre el pistón</text>
      {blueSmoke && <text x={26} y={74} className="svg-small" style={{ fill: "var(--c-air)", fontWeight: 700 }}>aceite quemado → humo azul</text>}
      {/* pared del cilindro */}
      <rect x={WX} y={14} width={86} height={348} fill="var(--c-block)" />
      <rect x={WX + 40} y={36} width={30} height={300} rx={8} fill="var(--c-coolant)" opacity={0.4} />
      <text x={WX + 55} y={190} textAnchor="middle" className="svg-small" transform={`rotate(-90 ${WX + 55} 190)`} style={{ fill: "var(--text-2)" }}>agua (camisa)</text>
      <g>{hatch}</g>
      {worn && <rect x={WX - 2} y={14} width={4} height={56} fill="var(--c-block)" />}
      {worn && <text x={WX + 14} y={28} className="svg-small" style={{ fill: "var(--text)", fontWeight: 700 }}>escalón</text>}
      {/* película de aceite en la pared */}
      <rect x={WX - 3} y={222} width={3} height={140} fill="var(--c-oil)" opacity={0.9} />
      <rect x={WX - 1.4} y={150} width={1.4} height={72} fill="var(--c-oil)" opacity={0.6} />
      {worn && <rect x={WX - 2.5} y={70} width={2.5} height={80} fill="var(--c-oil)" opacity={0.7} />}
      {/* pistón */}
      <path d={`M14,${YC} L${PX},${YC} L${PX},362 L${PX - GD - 24},362 L${PX - GD - 24},232 Q${PX - GD - 24},214 ${PX - GD - 44},214 L14,214 Z`}
        fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={1.2} />
      <text x={40} y={YC + 34} style={{ fontSize: 12, fontWeight: 800, fill: "var(--text)" }}>pistón</text>
      <text x={34} y={250} className="svg-small">interior del pistón</text>
      <text x={34} y={263} className="svg-small">(cárter abajo)</text>
      {/* ranuras y aros */}
      {grooves.map((g, i) => {
        const y = g.y + (onLower ? g.h - g.rh : 0);
        const xo = WX - (g.kind === "oil" ? ring * 0.6 : ring);
        const xi = PX - GD + 4;
        return (
          <g key={i}>
            <rect x={PX - GD} y={g.y} width={GD} height={g.h} fill="var(--surface)" />
            {g.kind === "comp" && (
              <path d={`M${xi},${y} L${xo - 3},${y} Q${xo + 0.8},${y + g.rh / 2} ${xo - 3},${y + g.rh} L${xi},${y + g.rh} Z`} fill="var(--c-metal-dark)" />
            )}
            {g.kind === "second" && (
              <path d={`M${xi},${y} L${xo - 2.5},${y} L${xo},${y + g.rh - 3} L${xo - 4},${y + g.rh - 3} L${xo - 4},${y + g.rh} L${xi},${y + g.rh} Z`} fill="var(--c-metal-dark)" />
            )}
            {g.kind === "oil" && (
              <g>
                <rect x={PX - 14} y={y} width={xo - (PX - 14)} height={3.6} fill="var(--c-metal-dark)" />
                <rect x={PX - 14} y={y + g.rh - 3.6} width={xo - (PX - 14)} height={3.6} fill="var(--c-metal-dark)" />
                <path d={`M${xi - 2},${y + 4} L${PX - 16},${y + 7} L${xi - 2},${y + 10} L${PX - 16},${y + 13} L${xi - 2},${y + 16}`} fill="none" stroke="var(--c-metal-dark)" strokeWidth={1.6} />
              </g>
            )}
          </g>
        );
      })}
      {/* agujero de drenaje del aceitero */}
      <rect x={PX - GD - 24} y={208} width={24} height={6} fill="var(--surface)" />
      {scrape}
      {/* fuerzas de los gases */}
      {forces && pRel > 1.5 && (
        <g opacity={clamp(pRel / 15, 0.4, 1)}>
          <Arrow x1={PX + 4} y1={92} x2={PX + 4} y2={136} color="var(--c-hot)" width={2.4} head={8} />
          <Arrow x1={PX - GD + 1} y1={148} x2={PX - GD + 11} y2={148} color="var(--c-hot)" width={2.4} head={7} />
          <Arrow x1={PX - 10} y1={126} x2={PX - 10} y2={140} color="var(--c-hot)" width={2.4} head={7} />
          <text x={26} y={96} className="svg-small" style={{ fill: "var(--text)", fontWeight: 800 }}>el gas entra por arriba y por detrás del aro:</text>
          <text x={26} y={109} className="svg-small" style={{ fill: "var(--text)", fontWeight: 800 }}>lo aprieta contra la pared y contra la ranura</text>
        </g>
      )}
      {blow}
      {oilUp}
      {/* rótulos */}
      <text x={PX - GD - 6} y={151} textAnchor="end" style={{ fontSize: 11, fontWeight: 700, fill: "var(--text)" }}>1 compresión</text>
      <text x={PX - GD - 6} y={181} textAnchor="end" style={{ fontSize: 11, fontWeight: 700, fill: "var(--text)" }}>2 segundo aro</text>
      <text x={PX - GD - 6} y={204} textAnchor="end" style={{ fontSize: 11, fontWeight: 700, fill: "var(--text)" }}>3 aceitero</text>
      <text x={PX - GD - 34} y={344} textAnchor="end" className="svg-small" style={{ fill: "var(--text)", fontWeight: 700 }}>la pared {down ? "sube ↑" : "baja ↓"} respecto del pistón</text>
      {down && <text x={PX - GD - 30} y={290} textAnchor="end" className="svg-small" style={{ fill: "var(--c-oil)", fontWeight: 700 }}>aceite raspado → cárter</text>}
      {worn && pRel > 3 && <text x={WX + 6} y={246} className="svg-small" style={{ fill: "var(--bad)", fontWeight: 800 }}>← blow-by</text>}
      {worn && pRel > 3 && <text x={WX + 6} y={259} className="svg-small" style={{ fill: "var(--bad)", fontWeight: 800 }}>gas al cárter</text>}
      {oilUpOn > 0 && <text x={WX + 6} y={120} className="svg-small" style={{ fill: "var(--c-oil)", fontWeight: 800 }}>← sube aceite</text>}
    </g>
  );

  // ======================================================== PANEL B
  const gapMm = worn ? 1.1 : 0.3;
  const RC = { x: 92, y: 112 }, RR = 64;
  const gapA = (gapMm * 9) / RR; // exagerado para que se vea
  const a0 = -Math.PI / 2 + gapA / 2, a1 = -Math.PI / 2 - gapA / 2 + Math.PI * 2;
  const ringArc = `M${RC.x + RR * Math.cos(a0)},${RC.y + RR * Math.sin(a0)} A${RR},${RR} 0 1 1 ${RC.x + RR * Math.cos(a1)},${RC.y + RR * Math.sin(a1)}`;
  // mini cilindro
  const MX = 280, MT = 44, K = 0.9;
  const mCrown = MT + 12 + xmm * K;
  const panelB = (
    <g>
      <text x={8} y={14} className="svg-label">Luz entre puntas (aro dentro del cilindro)</text>
      <circle cx={RC.x} cy={RC.y} r={RR + 8} fill="var(--c-block)" />
      <circle cx={RC.x} cy={RC.y} r={RR + 1} fill="var(--surface)" />
      <path d={ringArc} fill="none" stroke="var(--c-metal-dark)" strokeWidth={9} />
      <rect x={RC.x - 30} y={RC.y - RR - 30} width={60} height={20} rx={3} fill="var(--warn)" opacity={0.25} />
      <rect x={RC.x - (gapMm * 9) / 2 + 0.5} y={RC.y - RR - 12} width={Math.max(1.5, gapMm * 9 - 1)} height={18} fill="var(--warn)" />
      <text x={RC.x} y={RC.y - RR - 16} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 800, fill: "var(--text)" }}>galga {fmt(gapMm, 2)}</text>
      <text x={RC.x} y={RC.y + 4} textAnchor="middle" style={{ fontSize: 15, fontWeight: 800, fill: worn ? "var(--bad)" : "var(--ok)" }}>{fmt(gapMm, 2)} mm</text>
      <text x={RC.x} y={RC.y + 20} textAnchor="middle" className="svg-small">{worn ? "pasado del límite" : "dentro de lo normal"}</text>
      <text x={14} y={206} className="svg-small">Aro de compresión nuevo: ≈ 0,20–0,40 mm</text>
      <text x={14} y={220} className="svg-small">Límite de desgaste: ≈ 1 mm (según fabricante)</text>
      {/* mini cilindro con lupa */}
      <text x={MX} y={30} textAnchor="middle" className="svg-small" style={{ fontWeight: 700 }}>dónde está el zoom</text>
      <rect x={MX - 34} y={MT} width={8} height={130} fill="var(--c-block)" />
      <rect x={MX + 26} y={MT} width={8} height={130} fill="var(--c-block)" />
      <rect x={MX - 26} y={MT} width={52} height={mCrown - MT} fill={s.color} opacity={0.3} />
      <rect x={MX - 25} y={mCrown} width={50} height={40} rx={2} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
      <rect x={MX + 6} y={mCrown - 6} width={26} height={30} fill="none" stroke="var(--accent)" strokeWidth={2} rx={3} />
      <line x1={MX - 26} y1={MT - 2} x2={MX + 26} y2={MT - 2} stroke="var(--c-metal-dark)" strokeWidth={4} />
      {/* los 3 aros */}
      {[
        ["1 · Aro de compresión (de fuego)", "Sella la presión. El gas lo empuja contra la pared."],
        ["2 · Segundo aro", "Ayuda a sellar y raspa aceite hacia abajo."],
        ["3 · Aceitero", "Deja una película finita y devuelve el resto al cárter."],
      ].map(([t, d], i) => (
        <g key={i}>
          <text x={14} y={248 + i * 34} style={{ fontSize: 11.5, fontWeight: 800, fill: "var(--text)" }}>{t}</text>
          <text x={14} y={262 + i * 34} className="svg-small" style={{ fill: "var(--text-2)" }}>{d}</text>
        </g>
      ))}
    </g>
  );

  const W = wide ? 720 : 360, HA = 364, HB = 350;
  return (
    <AnimFrame
      title="Aros: cómo sellan y qué pasa cuando se gastan"
      clock={clock}
      controls={
        <>
          <Toggle label="Aros gastados" checked={worn} onChange={setWorn} />
          <Toggle label="Mostrar fuerzas del gas" checked={forces} onChange={setForces} />
        </>
      }
      readouts={
        <>
          <Readout label="Tiempo" value={s.name} />
          <Readout label="Presión sobre el pistón" value={fmt(st.p, st.p < 10 ? 1 : 0)} unit="bar" tone={st.p > 20 ? "accent" : undefined} />
          <Readout label="Blow-by" value={worn ? "alto" : "mínimo"} tone={worn ? "bad" : "ok"} />
          <Readout label="Aceite a la cámara" value={worn ? "sí: humo azul" : "casi nada"} tone={worn ? "bad" : "ok"} />
          <Readout label="Compresión (prueba)" value={worn ? "≈ 8,5" : "≈ 12,5"} unit="bar" tone={worn ? "bad" : "ok"} />
        </>
      }
      legend={[
        { color: "var(--c-hot)", label: "Presión del gas" },
        { color: "var(--c-oil)", label: "Aceite" },
        { color: "var(--bad)", label: "Blow-by (gas que se escapa)" },
        { color: "var(--c-coolant)", label: "Refrigerante" },
      ]}
      caption={
        <>
          <p>
            El aro no sella “por resorte” solamente: en compresión y explosión el gas se mete por arriba y por <b>detrás</b> del aro de
            compresión y lo aprieta contra la pared y contra el flanco de abajo de la ranura. Cuanta más presión, mejor sella. El
            segundo aro frena lo poco que pasa y, con su cara inclinada, raspa aceite hacia abajo. El <b>aceitero</b> (dos rieles finitos y
            un expansor) deja una película de micrones para lubricar y manda el resto por los agujeros de drenaje al interior del pistón.
          </p>
          <p>
            Activá <b>aros gastados</b>: el aro ya no apoya bien, la luz entre puntas creció y aparece el escalón arriba del cilindro. En
            compresión y explosión se escapa gas al cárter (<b>blow-by</b>: sale humo por la tapa de aceite o el respiradero) y en admisión,
            con vacío en la cámara, sube aceite que después se quema: <b>humo azul</b> y consumo de aceite. Las luces de la ranura y la
            película de aceite están muy exageradas para que se vean: en la realidad son centésimas de milímetro.
          </p>
        </>
      }
    >
      <div ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${wide ? Math.max(HA, HB) : HA + HB}`} role="img" aria-label="Aros del pistón en corte">
          <g>{panelA}</g>
          <g transform={wide ? "translate(360,0)" : `translate(0,${HA})`}>{panelB}</g>
        </svg>
      </div>
    </AnimFrame>
  );
}
