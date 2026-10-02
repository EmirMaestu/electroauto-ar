/* Cuña y rosca. Vista "Cuña": una fuerza chica que baja la cuña genera fuerzas normales grandes
   sobre los costados (más cuanto más fina es la cuña). Vista "Rosca": el filete de un tornillo es
   una cuña enrollada; se "desenrolla" en un plano inclinado y se calcula la precarga con rozamiento. */
import { useState } from "react";
import { AnimFrame, Readout, Seg, Slider, Toggle, useAnimClock, Arrow, TAU, fmt, rad, deg } from "../ui/anim-kit";

const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4, strokeLinejoin: "round" } as const;
const F_IN = 100; // fuerza de entrada en la vista cuña [N]

const THREADS = [
  { id: "M6", d: 6, P: 1, label: "M6×1" },
  { id: "M8", d: 8, P: 1.25, label: "M8×1,25" },
  { id: "M10", d: 10, P: 1.5, label: "M10×1,5" },
  { id: "M12", d: 12, P: 1.5, label: "M12×1,5" },
  { id: "M14", d: 14, P: 1.5, label: "M14×1,5" },
];

/** Resorte horizontal en zigzag entre x0 y x1 a la altura y. */
function hSpring(x0: number, x1: number, y: number, coils = 7, h = 9) {
  const n = coils * 2;
  const step = (x1 - x0) / (n + 2);
  let d = `M${x0},${y} L${x0 + step},${y}`;
  for (let i = 0; i < n; i++) d += ` L${x0 + step * (i + 1.5)},${y + (i % 2 === 0 ? h : -h)}`;
  d += ` L${x1 - step},${y} L${x1},${y}`;
  return d;
}

export function Cuna() {
  const clock = useAnimClock({ speed: 0.6 });
  const [mode, setMode] = useState<"cuna" | "rosca">("cuna");
  // cuña
  const [gamma, setGamma] = useState(20);
  const [fric, setFric] = useState(false);
  // rosca
  const [th, setTh] = useState("M12");
  const [torque, setTorque] = useState(110);
  const [lub, setLub] = useState(false);

  /* ----------------------------------------------------------- cuña */
  const mu = fric ? 0.15 : 0;
  const s2 = Math.sin(rad(gamma / 2)), c2 = Math.cos(rad(gamma / 2)), t2 = Math.tan(rad(gamma / 2));
  const Fn = F_IN / (2 * (s2 + mu * c2));
  const lateral = Fn * (c2 - mu * s2);
  const selfLock = fric && gamma / 2 <= deg(Math.atan(mu));

  /* ----------------------------------------------------------- rosca */
  const T = THREADS.find((x) => x.id === th) ?? THREADS[3];
  const muT = lub ? 0.1 : 0.14;
  const d2 = T.d - 0.6495 * T.P;
  const phi = Math.atan(T.P / (Math.PI * d2));
  const rhoT = Math.atan(muT / Math.cos(rad(30)));
  const a = T.P / (2 * Math.PI); // mm
  const b = 0.577 * muT * d2;
  const c = (muT * 1.35 * T.d) / 2;
  const sum = a + b + c;
  const Fpre = torque / (sum / 1000); // N
  const Fideal = (torque * TAU) / (T.P / 1000); // N
  const shares = { head: c / sum, thread: b / sum, stretch: a / sum };
  const Ft = Fpre * Math.tan(phi + rhoT); // fuerza tangencial en el filete

  const controls =
    mode === "cuna" ? (
      <>
        <Seg value={mode} onChange={setMode} options={[{ value: "cuna", label: "Cuña" }, { value: "rosca", label: "Rosca" }]} ariaLabel="Vista" />
        <Slider label="Ángulo de la cuña" value={gamma} min={4} max={70} step={1} onChange={setGamma} unit="°" />
        <Toggle label="Con rozamiento (μ = 0,15)" checked={fric} onChange={setFric} />
      </>
    ) : (
      <>
        <Seg value={mode} onChange={setMode} options={[{ value: "cuna", label: "Cuña" }, { value: "rosca", label: "Rosca" }]} ariaLabel="Vista" />
        <div style={{ maxWidth: "100%", overflowX: "auto" }}><Seg value={th} onChange={setTh} options={THREADS.map((x) => ({ value: x.id, label: x.label }))} ariaLabel="Rosca" /></div>
        <Slider label="Torque de apriete" value={torque} min={5} max={150} step={5} onChange={setTorque} unit="N·m" />
        <Toggle label="Rosca lubricada" checked={lub} onChange={setLub} />
      </>
    );

  const readouts =
    mode === "cuna" ? (
      <>
        <Readout label="Fuerza que entra" value={F_IN} unit="N" />
        <Readout label="Normal en cada cara" value={fmt(Fn, 0)} unit="N" tone="accent" />
        <Readout label="Multiplica" value={`×${fmt(Fn / F_IN, 1)}`} />
        <Readout label="Empuje lateral c/lado" value={fmt(lateral, 0)} unit="N" />
        <Readout label="Bajás 10 mm, abre" value={fmt(10 * t2, 1)} unit="mm c/lado" />
        {fric && <Readout label="¿Se queda trabada?" value={selfLock ? "Sí" : "No"} tone={selfLock ? "warn" : undefined} />}
      </>
    ) : (
      <>
        <Readout label="Ángulo del filete" value={fmt(deg(phi), 1)} unit="°" />
        <Readout label="Sin rozamiento daría" value={fmt(Fideal / 1000, 0)} unit="kN" />
        <Readout label="Precarga real" value={fmt(Fpre / 1000, 1)} unit="kN" tone="accent" />
        <Readout label="Equivale a colgar" value={fmt(Fpre / 9810, 1)} unit="t" />
        <Readout label="Se pierde en rozamiento" value={fmt((1 - shares.stretch) * 100, 0)} unit="%" tone="warn" />
      </>
    );

  const caption =
    mode === "cuna" ? (
      <>
        <p>
          Empujás la cuña hacia abajo con {F_IN} N y cada cara aprieta contra el bloque con <b>{fmt(Fn, 0)} N</b>. Cuanto más fina la cuña,
          más multiplica… pero más tenés que bajarla para abrir un poquito: con {gamma}° bajás 10 mm y cada bloque se corre apenas{" "}
          {fmt(10 * t2, 1)} mm. Es el mismo trato que la palanca: <b>ganás fuerza, pagás con recorrido</b>.
        </p>
        <p>
          Activá el rozamiento y bajá el ángulo por debajo de ~17°: la cuña <b>se queda trabada sola</b> (autobloqueo). Así se agarran los
          conos de una rótula o de un buje en su asiento, y por eso hace falta un extractor para soltarlos.
        </p>
      </>
    ) : (
      <>
        <p>
          Si "desenrollás" una vuelta del filete de un {T.label}, te queda un plano inclinado de {fmt(Math.PI * d2, 1)} mm de largo que
          sube sólo {fmt(T.P, 2)} mm: una cuña de <b>{fmt(deg(phi), 1)}°</b>. Por eso un torque chico genera una fuerza enorme a lo largo del
          tornillo. Sin rozamiento serían {fmt(Fideal / 1000, 0)} kN, pero en la vida real la mayor parte del torque se va en vencer el
          rozamiento bajo la cabeza y en los filetes: queda una precarga de <b>≈ {fmt(Fpre / 1000, 1)} kN</b>.
        </p>
        <p>
          Prendé "Rosca lubricada": <b>con el mismo torque</b> la precarga sube mucho. Por eso el torque de manual vale para la condición que
          indica el fabricante (seca o aceitada); si la cambiás, el tornillo queda más flojo o se estira de más.
        </p>
      </>
    );

  return (
    <AnimFrame
      title={mode === "cuna" ? "La cuña: poca fuerza, mucho apriete" : "La rosca es una cuña enrollada"}
      clock={clock}
      controls={controls}
      readouts={readouts}
      legend={
        mode === "cuna"
          ? [
              { color: "var(--accent)", label: "Fuerza que entra" },
              { color: "var(--primary)", label: "Fuerza normal sobre cada cara" },
            ]
          : [
              { color: "var(--accent)", label: "Fuerza tangencial en el filete" },
              { color: "var(--primary)", label: "Fuerza a lo largo del tornillo (precarga)" },
              { color: "var(--warn)", label: "Rozamiento bajo la cabeza" },
              { color: "var(--bad)", label: "Rozamiento en la rosca" },
              { color: "var(--ok)", label: "Estira el tornillo" },
            ]
      }
      caption={caption}
    >
      {mode === "cuna" ? (
        <CunaScene t={clock.t} gamma={gamma} Fn={Fn} t2={t2} s2={s2} c2={c2} selfLock={selfLock} />
      ) : (
        <RoscaScene t={clock.t} label={T.label} P={T.P} d2={d2} phi={phi} Fpre={Fpre} Ft={Ft} shares={shares} />
      )}
    </AnimFrame>
  );
}

function CunaScene(p: { t: number; gamma: number; Fn: number; t2: number; s2: number; c2: number; selfLock: boolean }) {
  const { t2, s2, c2 } = p;
  const CX = 360, yb0 = 150, yb1 = 290, H = 236;
  // la cuña baja y sube (si está autobloqueada, baja y se queda)
  const ph = (p.t * 0.5) % 1;
  const sNorm = p.selfLock ? Math.min(1, (p.t * 0.5) % 2) : 0.5 - 0.5 * Math.cos(ph * TAU);
  const s = 34 * sNorm;
  const ytip = yb1 + 14 + s;
  const xL = (y: number) => CX - (ytip - y) * t2;
  const xR = (y: number) => CX + (ytip - y) * t2;
  const top = ytip - H;
  const outL = xL(yb1) - 120, outR = xR(yb1) + 120;
  const ym = (yb0 + yb1) / 2;
  const nLen = 22 + 26 * Math.sqrt(p.Fn / F_IN);
  const pL = { x: xL(ym), y: ym }, pR = { x: xR(ym), y: ym };
  return (
    <svg viewBox="0 0 720 380" role="img" aria-label="Cuña entre dos bloques">
      {/* paredes */}
      <rect x={14} y={yb0 - 10} width={14} height={yb1 - yb0 + 10} fill="var(--c-metal-dark)" />
      <rect x={692} y={yb0 - 10} width={14} height={yb1 - yb0 + 10} fill="var(--c-metal-dark)" />
      {/* piso con ranura */}
      <line x1={14} y1={yb1 + 1} x2={CX - 40} y2={yb1 + 1} stroke="var(--border-strong)" strokeWidth={3} />
      <line x1={CX + 40} y1={yb1 + 1} x2={706} y2={yb1 + 1} stroke="var(--border-strong)" strokeWidth={3} />
      <path d={`M${CX - 40},${yb1 + 1} L${CX - 40},${yb1 + 70} M${CX + 40},${yb1 + 1} L${CX + 40},${yb1 + 70}`} stroke="var(--border-strong)" strokeWidth={2} />
      {/* resortes */}
      <path d={hSpring(28, outL, ym)} fill="none" stroke="var(--c-metal-2)" strokeWidth={2.5} />
      <path d={hSpring(outR, 692, ym)} fill="none" stroke="var(--c-metal-2)" strokeWidth={2.5} />
      {/* bloques */}
      <polygon points={`${outL},${yb0} ${xL(yb0)},${yb0} ${xL(yb1)},${yb1} ${outL},${yb1}`} fill="var(--c-block)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
      <polygon points={`${outR},${yb0} ${xR(yb0)},${yb0} ${xR(yb1)},${yb1} ${outR},${yb1}`} fill="var(--c-block)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
      {/* cuña */}
      <polygon points={`${CX},${ytip} ${CX - H * t2},${top} ${CX + H * t2},${top}`} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={2} />
      {/* ángulo */}
      <path d={`M${CX - 30 * s2},${ytip - 30 * c2} A30,30 0 0 1 ${CX + 30 * s2},${ytip - 30 * c2}`} fill="none" stroke="var(--text)" strokeWidth={1.2} />
      <text x={CX} y={Math.min(ytip - 36, yb1 - 8)} textAnchor="middle" className="svg-label" style={HALO}>γ = {p.gamma}°</text>
      {/* fuerza de entrada */}
      {!(p.selfLock && sNorm >= 1) && (
        <>
          <Arrow x1={CX} y1={top - 58} x2={CX} y2={top - 4} color="var(--accent)" width={4} head={12} />
          <text x={CX + 10} y={top - 40} className="svg-label" style={{ ...HALO, fill: "var(--accent)" }}>F = {F_IN} N</text>
        </>
      )}
      {/* normales: perpendiculares a cada cara, hacia los bloques */}
      <Arrow x1={pL.x} y1={pL.y} x2={pL.x - c2 * nLen} y2={pL.y + s2 * nLen} color="var(--primary)" width={3.5} head={11} />
      <Arrow x1={pR.x} y1={pR.y} x2={pR.x + c2 * nLen} y2={pR.y + s2 * nLen} color="var(--primary)" width={3.5} head={11} />
      <text x={pL.x - c2 * nLen - 6} y={pL.y + s2 * nLen + 18} textAnchor="end" className="svg-label" style={{ ...HALO, fill: "var(--primary)" }}>
        Fₙ = {fmt(p.Fn, 0)} N
      </text>
      <text x={pR.x + c2 * nLen + 6} y={pR.y + s2 * nLen + 18} className="svg-label" style={{ ...HALO, fill: "var(--primary)" }}>
        Fₙ = {fmt(p.Fn, 0)} N
      </text>
      <text x={24} y={352} className="svg-small" style={HALO}>la cuña bajó {fmt(sNorm * 10, 1)} mm → el bloque se corrió {fmt(sNorm * 10 * t2, 2)} mm</text>
      {p.selfLock && sNorm >= 1 && (
        <text x={CX} y={30} textAnchor="middle" className="svg-title" style={{ ...HALO, fill: "var(--warn)" }}>Autobloqueo: soltaste y la cuña no sube</text>
      )}
      <text x={24} y={372} className="svg-small">Fₙ = F / (2 · (sen(γ/2) + μ · cos(γ/2)))</text>
    </svg>
  );
}

function RoscaScene(p: {
  t: number; label: string; P: number; d2: number; phi: number; Fpre: number; Ft: number;
  shares: { head: number; thread: number; stretch: number };
}) {
  const theta = (p.t * TAU * 0.25) % TAU; // la tuerca gira
  // --- tornillo y tuerca (izquierda)
  const BX = 150;
  const faces = [0, 1, 2, 3, 4, 5].map((k) => theta + (k * Math.PI) / 3);
  // --- plano inclinado (derecha)
  const SC = 9; // px/mm
  const EX = 8; // exageración vertical
  const X0 = 322, YB = 262;
  const Bpx = Math.PI * p.d2 * SC;
  const Hpx = p.P * SC * EX;
  const q = theta / TAU;
  const blk = { x: X0 + q * Bpx, y: YB - q * Hpx };
  const visAng = Math.atan2(Hpx, Bpx);
  const ftLen = 16 + 40 * Math.min(1, p.Ft / 20000);
  // barra de reparto
  const BX0 = 322, BX1 = 700, BY = 322;
  const w = BX1 - BX0;
  const segs = [
    { k: "head", v: p.shares.head, c: "var(--warn)", l: "bajo la cabeza" },
    { k: "thread", v: p.shares.thread, c: "var(--bad)", l: "en la rosca" },
    { k: "stretch", v: p.shares.stretch, c: "var(--ok)", l: "estira" },
  ];
  let acc = BX0;
  return (
    <svg viewBox="0 0 720 380" role="img" aria-label="Tornillo y su rosca desenrollada como plano inclinado">
      {/* piezas apretadas */}
      <rect x={60} y={118} width={180} height={50} fill="var(--c-block)" stroke="var(--c-metal-dark)" />
      <rect x={60} y={168} width={180} height={50} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" />
      {/* cabeza */}
      <rect x={BX - 36} y={92} width={72} height={26} rx={3} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
      {/* caña */}
      <rect x={BX - 17} y={118} width={34} height={190} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={BX - 17} y1={250 + i * 6.5} x2={BX + 17} y2={244 + i * 6.5} stroke="var(--c-metal-dark)" strokeWidth={1.4} />
      ))}
      {/* tuerca girando (caras del hexágono que se ven) */}
      <rect x={BX - 36} y={218} width={72} height={28} rx={2} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
      {faces.map((f, i) =>
        Math.cos(f) > 0 ? <line key={i} x1={BX + 36 * Math.sin(f)} y1={219} x2={BX + 36 * Math.sin(f)} y2={245} stroke="var(--c-metal-dark)" strokeWidth={1.5} /> : null,
      )}
      {Math.cos(theta) > 0 && <circle cx={BX + 30 * Math.sin(theta)} cy={232} r={3.5} fill="var(--accent)" />}
      {/* fuerzas de apriete */}
      <Arrow x1={88} y1={124} x2={88} y2={160} color="var(--primary)" width={3} head={9} />
      <Arrow x1={212} y1={124} x2={212} y2={160} color="var(--primary)" width={3} head={9} />
      <Arrow x1={88} y1={212} x2={88} y2={176} color="var(--primary)" width={3} head={9} />
      <Arrow x1={212} y1={212} x2={212} y2={176} color="var(--primary)" width={3} head={9} />
      <text x={BX} y={72} textAnchor="middle" className="svg-label">{p.label}</text>
      <text x={BX} y={330} textAnchor="middle" className="svg-label" style={{ fill: "var(--primary)" }}>aprieta ≈ {fmt(p.Fpre / 1000, 1)} kN</text>
      <text x={BX} y={346} textAnchor="middle" className="svg-small">(≈ {fmt(p.Fpre / 9810, 1)} toneladas)</text>

      {/* plano inclinado = una vuelta de filete desenrollada */}
      <text x={X0} y={44} className="svg-label">Una vuelta de filete, desenrollada</text>
      <polygon points={`${X0},${YB} ${X0 + Bpx},${YB} ${X0 + Bpx},${YB - Hpx}`} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
      <line x1={X0} y1={YB + 14} x2={X0 + Bpx} y2={YB + 14} stroke="var(--muted)" />
      <text x={X0 + Bpx / 2} y={YB + 28} textAnchor="middle" className="svg-small">π · d₂ = {fmt(Math.PI * p.d2, 1)} mm (una vuelta)</text>
      <line x1={X0 + Bpx + 12} y1={YB} x2={X0 + Bpx + 12} y2={YB - Hpx} stroke="var(--muted)" />
      <text x={X0 + Bpx + 8} y={YB - Hpx - 8} textAnchor="end" className="svg-small">paso P = {fmt(p.P, 2)} mm</text>
      <text x={X0} y={62} className="svg-small">ángulo del filete φ = {fmt(deg(p.phi), 1)}° (altura dibujada ×{EX} para que se vea)</text>
      {/* bloque = filete de la tuerca subiendo por el plano */}
      <g transform={`translate(${blk.x} ${blk.y}) rotate(${-deg(visAng)})`}>
        <rect x={-14} y={-16} width={28} height={16} rx={2} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)" />
      </g>
      <Arrow x1={blk.x - ftLen - 14} y1={blk.y - 8} x2={blk.x - 14} y2={blk.y - 8} color="var(--accent)" width={3} head={9} />
      <Arrow x1={blk.x} y1={blk.y - 74} x2={blk.x} y2={blk.y - 18} color="var(--primary)" width={4} head={11} />
      <text x={blk.x + 6} y={blk.y - 62} className="svg-small" style={{ ...HALO, fill: "var(--primary)" }}>{fmt(p.Fpre / 1000, 1)} kN</text>
      <text x={blk.x - ftLen - 18} y={blk.y - 14} textAnchor="end" className="svg-small" style={{ ...HALO, fill: "var(--accent)" }}>{fmt(p.Ft / 1000, 1)} kN</text>

      {/* reparto del torque */}
      <text x={BX0} y={BY - 8} className="svg-label">¿Adónde se va el torque que hacés?</text>
      {segs.map((sg) => {
        const x = acc;
        acc += sg.v * w;
        return <rect key={sg.k} x={x} y={BY} width={sg.v * w} height={18} fill={sg.c} opacity={0.85} />;
      })}
      {(() => {
        let a2 = BX0;
        return segs.map((sg, i) => {
          const x = a2;
          a2 += sg.v * w;
          return (
            <text key={sg.k} x={i === 2 ? BX1 : x + 4} y={BY + 34} textAnchor={i === 2 ? "end" : "start"} className="svg-small" style={{ fill: sg.c }}>
              {sg.l} {fmt(sg.v * 100, 0)} %
            </text>
          );
        });
      })()}
    </svg>
  );
}
