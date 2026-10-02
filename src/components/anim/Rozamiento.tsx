/* Rozamiento. Vista "Bloque": tirás con fuerza creciente; el rozamiento estático iguala tu fuerza hasta el pico
   (μs·N), el bloque arranca y la fuerza necesaria baja al valor dinámico (μk·N).
   Vista "Cubierta y ABS": curva de adherencia vs patinamiento (modelo de Burckhardt) y cómo el ABS se queda cerca del pico. */
import { useState } from "react";
import { AnimFrame, Readout, Seg, Slider, useAnimClock, Arrow, plotPath, TAU, fmt, smoothstep, clamp } from "../ui/anim-kit";

const G = 9.81;
const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4, strokeLinejoin: "round" } as const;

const MATS = [
  { id: "acero", label: "Acero/acero seco", ms: 0.18, mk: 0.12, top: "var(--c-metal)", bot: "var(--c-metal-2)" },
  { id: "lub", label: "Acero lubricado", ms: 0.1, mk: 0.07, top: "var(--c-metal)", bot: "var(--c-oil)" },
  { id: "pastilla", label: "Pastilla/disco", ms: 0.48, mk: 0.42, top: "var(--c-exhaust)", bot: "var(--c-metal-2)" },
  { id: "goma", label: "Goma/asfalto seco", ms: 0.95, mk: 0.72, top: "var(--c-rubber)", bot: "var(--c-metal-dark)" },
  { id: "hielo", label: "Goma/hielo", ms: 0.1, mk: 0.06, top: "var(--c-rubber)", bot: "var(--c-mix)" },
];

type Surf = "seco" | "mojado" | "ripio" | "hielo";
const SURF: Record<Surf, { label: string; mu: (s: number) => number }> = {
  // Burckhardt: μ(s) = c1·(1 − e^(−c2·s)) − c3·s  (s de 0 a 1)
  seco: { label: "Asfalto seco", mu: (s) => 1.15 * (1 - Math.exp(-24 * s)) - 0.45 * s },
  mojado: { label: "Asfalto mojado", mu: (s) => 0.857 * (1 - Math.exp(-33.8 * s)) - 0.347 * s },
  // ripio suelto: la rueda bloqueada arma una cuña de piedras delante y frena un poco más
  ripio: { label: "Ripio suelto", mu: (s) => 0.5 * (1 - Math.exp(-14 * s)) + 0.1 * s },
  hielo: { label: "Hielo", mu: (s) => 0.1 * (1 - Math.exp(-100 * s)) - 0.03 * s },
};

export function Rozamiento() {
  const clock = useAnimClock({ speed: 1 });
  const [view, setView] = useState<"bloque" | "abs">("bloque");
  const [mat, setMat] = useState("acero");
  const [kg, setKg] = useState(10);
  const [surf, setSurf] = useState<Surf>("seco");
  const [absMode, setAbsMode] = useState<"sin" | "con" | "manual">("con");
  const [slipMan, setSlipMan] = useState(15);

  /* ---------------- bloque */
  const M = MATS.find((m) => m.id === mat) ?? MATS[0];
  const N = kg * G;
  const Fs = M.ms * N, Fk = M.mk * N;
  const CYC = 7;
  const tau = clock.t % CYC;
  const fric = (x: number) => {
    if (x < 3) return (Fs * x) / 3;
    if (x < 3.15) return Fs + ((Fk - Fs) * (x - 3)) / 0.15;
    if (x < 6) return Fk * (1 + 0.025 * Math.sin(x * 37) + 0.015 * Math.sin(x * 83));
    if (x < 6.4) return Fk * (1 - (x - 6) / 0.4);
    return 0;
  };
  const Fnow = fric(tau);
  const sliding = tau >= 3 && tau < 6;
  const moved = tau < 3 ? 0 : Math.min(tau, 6) - 3;

  /* ---------------- ABS */
  const S = SURF[surf];
  const W_ABS = TAU * 1.6;
  const absSlip = (x: number) => 0.15 + 0.07 * Math.sin(x * W_ABS);
  const tA = clock.t % 4;
  const slip = absMode === "manual" ? slipMan / 100 : absMode === "sin" ? clamp(tA / 0.5, 0, 1) : absSlip(clock.t);
  // giro acumulado de la rueda (en "segundos de rueda libre"): integral de (1 − patinamiento)
  const roll =
    absMode === "manual"
      ? (1 - slip) * clock.t
      : absMode === "sin"
        ? Math.floor(clock.t / 4) * 0.25 + (tA < 0.5 ? tA - tA * tA : 0.25)
        : 0.85 * clock.t + (0.07 / W_ABS) * Math.cos(clock.t * W_ABS);
  const muX = Math.max(0, S.mu(slip));
  // adherencia lateral disponible (para doblar) a un ángulo de deriva típico: cae fuerte con el patinamiento
  let muPeak = 0;
  for (let i = 0; i <= 100; i++) muPeak = Math.max(muPeak, S.mu(i / 100));
  const muY = (s: number) => muPeak * 0.85 * Math.exp(-3.2 * s);
  // μ medio para calcular la distancia de frenado
  let muBrake = muX;
  if (absMode === "con") {
    let acc = 0;
    for (let i = 0; i < 40; i++) acc += S.mu(absSlip(i / 40 / 1.6));
    muBrake = acc / 40;
  } else if (absMode === "sin") muBrake = S.mu(1);
  const v = 100 / 3.6;
  const dist = (v * v) / (2 * Math.max(0.02, muBrake) * G);

  const controlsBloque = (
    <>
      <Seg value={view} onChange={setView} options={[{ value: "bloque", label: "Bloque" }, { value: "abs", label: "Cubierta y ABS" }]} ariaLabel="Vista" />
      <div style={{ maxWidth: "100%", overflowX: "auto" }}><Seg value={mat} onChange={setMat} options={MATS.map((m) => ({ value: m.id, label: m.label }))} ariaLabel="Materiales" /></div>
      <Slider label="Masa del bloque" value={kg} min={2} max={30} step={1} onChange={setKg} unit="kg" />
    </>
  );
  const controlsAbs = (
    <>
      <Seg value={view} onChange={setView} options={[{ value: "bloque", label: "Bloque" }, { value: "abs", label: "Cubierta y ABS" }]} ariaLabel="Vista" />
      <Seg value={surf} onChange={setSurf} options={(Object.keys(SURF) as Surf[]).map((k) => ({ value: k, label: SURF[k].label }))} ariaLabel="Superficie" />
      <Seg value={absMode} onChange={setAbsMode} options={[{ value: "sin", label: "Frenada sin ABS" }, { value: "con", label: "Con ABS" }, { value: "manual", label: "Manual" }]} ariaLabel="Modo" />
      {absMode === "manual" && <Slider label="Patinamiento" value={slipMan} min={0} max={100} step={1} onChange={setSlipMan} unit="%" />}
    </>
  );

  return (
    <AnimFrame
      title={view === "bloque" ? "Rozamiento estático y dinámico" : "Adherencia de la cubierta: por qué el ABS frena mejor"}
      clock={clock}
      controls={view === "bloque" ? controlsBloque : controlsAbs}
      readouts={
        view === "bloque" ? (
          <>
            <Readout label="Fuerza normal N" value={fmt(N, 0)} unit="N" />
            <Readout label="Coef. estático / dinámico" value={`${fmt(M.ms, 2)} / ${fmt(M.mk, 2)}`} />
            <Readout label="Tirás con" value={fmt(Fnow, 0)} unit="N" tone="accent" />
            <Readout label="Para arrancar" value={fmt(Fs, 0)} unit="N" />
            <Readout label="Para seguir" value={fmt(Fk, 0)} unit="N" />
            <Readout label="Estado" value={sliding ? "Desliza" : tau < 3 ? "Quieto" : "Frenado"} tone={sliding ? "warn" : "ok"} />
          </>
        ) : (
          <>
            <Readout label="Patinamiento" value={fmt(slip * 100, 0)} unit="%" />
            <Readout label="Adherencia para frenar" value={fmt(muX, 2)} tone="accent" />
            <Readout label="Adherencia para doblar" value={fmt(muY(slip), 2)} tone={muY(slip) < 0.15 * muPeak ? "bad" : "ok"} />
            <Readout label="Frenada desde 100 km/h" value={fmt(dist, 0)} unit="m" />
            <Readout label="¿Dobla?" value={muY(slip) < 0.15 * muPeak ? "No" : "Sí"} tone={muY(slip) < 0.15 * muPeak ? "bad" : "ok"} />
          </>
        )
      }
      legend={
        view === "bloque"
          ? [
              { color: "var(--accent)", label: "Fuerza con la que tirás" },
              { color: "var(--bad)", label: "Rozamiento" },
              { color: "var(--teal)", label: "Normal (N)" },
            ]
          : [
              { color: "var(--primary)", label: "Adherencia para frenar" },
              { color: "var(--teal)", label: "Adherencia para doblar" },
              { color: "var(--ok)", label: "Zona donde trabaja el ABS" },
            ]
      }
      caption={
        view === "bloque" ? (
          <>
            <p>
              Mientras el bloque está quieto, el rozamiento <b>copia tu fuerza</b>: si tirás con 10 N, frena con 10 N; si tirás con 30 N, con 30
              N. Pero tiene un tope: <b>μs · N = {fmt(Fs, 0)} N</b>. Cuando lo pasás, las rugosidades se "despegan", el bloque arranca y la fuerza
              necesaria <b>baja</b> a μk · N = {fmt(Fk, 0)} N. Ese pico es el "tirón" que sentís al empujar un mueble.
            </p>
            <p>
              Cambiá la masa: todo escala con la fuerza normal. Probá "Acero lubricado": el aceite separa las superficies y el rozamiento cae a
              la mitad. Con "Goma/hielo" casi no hay agarre: por eso en Alta Montaña con hielo cualquier frenada brusca termina en patinada.
            </p>
          </>
        ) : (
          <>
            <p>
              El <b>patinamiento</b> compara la velocidad de la rueda con la del auto: 0 % es rueda libre y 100 % es rueda bloqueada que se
              arrastra. La adherencia para frenar (azul) <b>sube hasta un pico entre 10 y 20 %</b> y después baja: una rueda bloqueada frena
              menos que una que todavía gira un poco. Y lo peor: la adherencia para doblar (verde agua) se cae casi a cero, así que{" "}
              <b>con las ruedas bloqueadas el auto no dobla</b>.
            </p>
            <p>
              El ABS mide la velocidad de cada rueda y, cuando una empieza a bloquearse, le afloja y le vuelve a dar presión varias veces por
              segundo para mantenerla en la franja verde. Probá "Ripio suelto": ahí la rueda bloqueada arma una cuña de piedras y frena un
              poco más, por eso en ripio el ABS puede alargar la frenada (pero te deja doblar).
            </p>
          </>
        )
      }
    >
      {view === "bloque" ? (
        <BloqueScene tau={tau} M={M} N={N} Fs={Fs} Fk={Fk} Fnow={Fnow} moved={moved} sliding={sliding} fric={fric} />
      ) : (
        <AbsScene t={clock.t} roll={roll} slip={slip} mu={S.mu} muY={muY} muX={muX} surf={surf} absMode={absMode} />
      )}
    </AnimFrame>
  );
}

function BloqueScene(p: {
  tau: number; M: (typeof MATS)[number]; N: number; Fs: number; Fk: number; Fnow: number; moved: number; sliding: boolean;
  fric: (x: number) => number;
}) {
  const SY = 172; // superficie
  const BW = 120, BH = 66;
  const bx = 60 + p.moved * 55;
  const fade = smoothstep(0, 0.25, p.tau) * (1 - smoothstep(6.6, 7, p.tau));
  const fScale = 120 / Math.max(p.Fs, 1); // px por N para flechas (el pico = 120 px)
  const springLen = 56 + p.Fnow * fScale * 0.45;
  const ropeX0 = bx + BW, ropeX1 = ropeX0 + 26;
  const handX = ropeX1 + springLen;
  // gráfico
  const GX0 = 70, GX1 = 700, GY0 = 254, GY1 = 376;
  const Fmax = p.Fs * 1.25;
  const mx = (x: number) => GX0 + (x / 7) * (GX1 - GX0);
  const my = (f: number) => GY1 - (f / Fmax) * (GY1 - GY0);
  const trace = plotPath(p.fric, 0, Math.max(0.01, p.tau), Math.max(2, Math.round(p.tau * 30)), mx, my);
  // rugosidades del contacto
  const teeth = Array.from({ length: 30 }, (_, i) => i);
  return (
    <svg viewBox="0 0 720 400" role="img" aria-label="Bloque arrastrado sobre una superficie">
      {/* superficie */}
      <rect x={20} y={SY} width={680} height={22} fill={p.M.bot} opacity={0.55} />
      <path d={teeth.map((i) => `M${20 + i * 22.6},${SY} l6,-3 l6,3 l5,-2 l5,2`).join(" ")} fill="none" stroke="var(--c-metal-dark)" strokeWidth={1} opacity={0.6} />
      <g opacity={fade}>
        {/* bloque */}
        <rect x={bx} y={SY - BH} width={BW} height={BH} rx={6} fill={p.M.top} stroke="var(--c-metal-dark)" strokeWidth={1.5} />
        <text x={bx + BW / 2} y={SY - BH - 10} textAnchor="middle" className="svg-label">{fmt(p.N / G, 0)} kg</text>
        {/* soga, dinamómetro y mano */}
        <line x1={ropeX0} y1={SY - BH / 2} x2={ropeX1} y2={SY - BH / 2} stroke="var(--c-belt)" strokeWidth={2} />
        <path d={(() => {
          const n = 12, st = springLen / (n + 2);
          let d = `M${ropeX1},${SY - BH / 2} l${st},0`;
          for (let i = 0; i < n; i++) d += ` L${ropeX1 + st * (i + 1.5)},${SY - BH / 2 + (i % 2 ? -7 : 7)}`;
          return d + ` L${handX - st},${SY - BH / 2} L${handX},${SY - BH / 2}`;
        })()} fill="none" stroke="var(--c-metal-2)" strokeWidth={2} />
        <rect x={handX} y={SY - BH / 2 - 12} width={26} height={24} rx={8} fill="var(--accent)" opacity={0.85} />
        <text x={handX + 13} y={SY - BH / 2 - 18} textAnchor="middle" className="svg-small">tirás</text>
        {p.Fnow > 0.5 && (
          <>
            <Arrow x1={handX + 30} y1={SY - BH / 2} x2={handX + 30 + p.Fnow * fScale * 0.6 + 10} y2={SY - BH / 2} color="var(--accent)" width={4} head={12} />
            <text x={handX + 34} y={SY - BH / 2 + 22} className="svg-label" style={{ ...HALO, fill: "var(--accent)" }}>F = {fmt(p.Fnow, 0)} N</text>
            {/* rozamiento en la base del bloque, hacia atrás */}
            <Arrow x1={bx + BW / 2} y1={SY + 8} x2={bx + BW / 2 - p.Fnow * fScale * 0.6 - 10} y2={SY + 8} color="var(--bad)" width={4} head={12} />
            <text x={bx + BW / 2 - 8} y={SY + 38} textAnchor="middle" className="svg-label" style={{ ...HALO, fill: "var(--bad)" }}>rozamiento {fmt(p.Fnow, 0)} N</text>
          </>
        )}
        {/* peso y normal */}
        <Arrow x1={bx + 22} y1={SY - BH - 46} x2={bx + 22} y2={SY - BH - 4} color="var(--muted)" width={3} head={10} />
        <text x={bx + 30} y={SY - BH - 34} className="svg-small">peso</text>
        <Arrow x1={bx + BW - 22} y1={SY - BH - 4} x2={bx + BW - 22} y2={SY - BH - 46} color="var(--teal)" width={3} head={10} />
        <text x={bx + BW - 16} y={SY - BH - 34} className="svg-small" style={{ fill: "var(--teal)" }}>N</text>
      </g>
      <text x={24} y={30} className="svg-title" style={{ fill: p.sliding ? "var(--warn)" : "var(--ok)" }}>
        {p.tau < 3 ? "Quieto: el rozamiento estático aguanta" : p.sliding ? "¡Arrancó! Ahora alcanza con menos fuerza" : "Dejás de tirar: se frena"}
      </text>

      {/* gráfico fuerza vs tiempo */}
      <line x1={GX0} y1={GY1} x2={GX1} y2={GY1} stroke="var(--border-strong)" />
      <line x1={GX0} y1={GY0} x2={GX0} y2={GY1} stroke="var(--border-strong)" />
      <text x={GX0} y={GY0 - 10} className="svg-label">Rozamiento a lo largo del tiempo</text>
      <line x1={GX0} y1={my(p.Fs)} x2={GX1} y2={my(p.Fs)} stroke="var(--bad)" strokeDasharray="4 4" opacity={0.5} />
      <text x={GX1} y={my(p.Fs) - 5} textAnchor="end" className="svg-small" style={{ fill: "var(--bad)" }}>máximo estático μs·N = {fmt(p.Fs, 0)} N</text>
      <line x1={GX0} y1={my(p.Fk)} x2={GX1} y2={my(p.Fk)} stroke="var(--warn)" strokeDasharray="4 4" opacity={0.5} />
      <text x={GX1} y={my(p.Fk) + 14} textAnchor="end" className="svg-small" style={{ fill: "var(--warn)" }}>dinámico μk·N = {fmt(p.Fk, 0)} N</text>
      <path d={trace} fill="none" stroke="var(--bad)" strokeWidth={2.5} />
      <circle cx={mx(p.tau)} cy={my(p.Fnow)} r={5} fill="var(--accent)" />
      <text x={mx(1.5)} y={GY1 + 16} textAnchor="middle" className="svg-small">quieto (estático)</text>
      <text x={mx(4.5)} y={GY1 + 16} textAnchor="middle" className="svg-small">deslizando (dinámico)</text>
      <line x1={mx(3)} y1={GY0} x2={mx(3)} y2={GY1} stroke="var(--muted)" strokeDasharray="2 4" />
      <line x1={mx(6)} y1={GY0} x2={mx(6)} y2={GY1} stroke="var(--muted)" strokeDasharray="2 4" />
    </svg>
  );
}

function AbsScene(p: {
  t: number; roll: number; slip: number; mu: (s: number) => number; muY: (s: number) => number; muX: number; surf: Surf; absMode: "sin" | "con" | "manual";
}) {
  // rueda
  const WC = { x: 175, y: 150 }, R = 92;
  const roadY = WC.y + R;
  const vPx = 160; // px/s del piso
  const wheelAng = (p.roll * vPx) / R;
  const roadOff = (p.t * vPx) % 40;
  const locked = p.slip > 0.95;
  // gráfico
  const GX0 = 392, GX1 = 700, GY0 = 40, GY1 = 290;
  const mx = (s: number) => GX0 + s * (GX1 - GX0);
  const my = (m: number) => GY1 - (m / 1.2) * (GY1 - GY0);
  const curveX = plotPath((s) => Math.max(0, p.mu(s)), 0, 1, 120, mx, my);
  const curveY = plotPath((s) => p.muY(s), 0, 1, 80, mx, my);
  const surfColor = p.surf === "hielo" ? "var(--c-mix)" : p.surf === "ripio" ? "var(--c-exhaust)" : p.surf === "mojado" ? "var(--c-air)" : "var(--c-metal-dark)";
  return (
    <svg viewBox="0 0 720 340" role="img" aria-label="Rueda frenando y curva de adherencia">
      {/* piso que se mueve */}
      <rect x={10} y={roadY} width={350} height={26} fill={surfColor} opacity={0.35} />
      {Array.from({ length: 10 }, (_, i) => {
        const x = 10 + ((i * 40 - roadOff + 400) % 400);
        return x < 350 ? <rect key={i} x={x} y={roadY + 10} width={18} height={4} fill="var(--text)" opacity={0.35} /> : null;
      })}
      {locked && <rect x={14} y={roadY - 3} width={WC.x - 14} height={5} fill="var(--c-rubber)" opacity={0.7} />}
      {/* rueda */}
      <circle cx={WC.x} cy={WC.y} r={R} fill="var(--c-rubber)" stroke="var(--c-metal-dark)" strokeWidth={2} />
      <circle cx={WC.x} cy={WC.y} r={R * 0.66} fill="var(--c-metal-light)" stroke="var(--c-metal-2)" />
      {Array.from({ length: 5 }, (_, i) => {
        const a = wheelAng + (i * TAU) / 5;
        return (
          <line key={i} x1={WC.x + 14 * Math.cos(a)} y1={WC.y + 14 * Math.sin(a)} x2={WC.x + R * 0.62 * Math.cos(a)} y2={WC.y + R * 0.62 * Math.sin(a)}
            stroke="var(--c-metal-2)" strokeWidth={9} strokeLinecap="round" />
        );
      })}
      <circle cx={WC.x} cy={WC.y} r={14} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
      <circle cx={WC.x + (R - 8) * Math.cos(wheelAng)} cy={WC.y + (R - 8) * Math.sin(wheelAng)} r={5} fill="var(--accent)" />
      <Arrow x1={WC.x - 20} y1={WC.y - R - 22} x2={WC.x + 60} y2={WC.y - R - 22} color="var(--text)" width={2.5} head={10} />
      <text x={WC.x + 66} y={WC.y - R - 18} className="svg-small">sentido de marcha</text>
      <text x={20} y={30} className="svg-title" style={{ fill: locked ? "var(--bad)" : p.absMode === "con" ? "var(--ok)" : "var(--text)" }}>
        {locked ? "Rueda bloqueada: se arrastra" : p.absMode === "con" ? "ABS: la rueda sigue girando" : "Rueda frenando"}
      </text>
      <text x={20} y={roadY + 46} className="svg-small">la rueda gira al {fmt((1 - p.slip) * 100, 0)} % de la velocidad del piso</text>

      {/* gráfico μ vs patinamiento */}
      <rect x={mx(0.08)} y={GY0} width={mx(0.22) - mx(0.08)} height={GY1 - GY0} fill="var(--ok)" opacity={0.12} />
      <line x1={GX0} y1={GY1} x2={GX1} y2={GY1} stroke="var(--border-strong)" />
      <line x1={GX0} y1={GY0} x2={GX0} y2={GY1} stroke="var(--border-strong)" />
      {[0, 0.4, 0.8, 1.2].map((m) => (
        <text key={m} x={GX0 - 6} y={my(m) + 4} textAnchor="end" className="svg-small">{fmt(m, 1)}</text>
      ))}
      {[0, 0.2, 0.4, 0.6, 0.8, 1].map((s) => (
        <text key={s} x={mx(s)} y={GY1 + 15} textAnchor="middle" className="svg-small">{s * 100}</text>
      ))}
      <text x={GX1} y={GY1 + 30} textAnchor="end" className="svg-small">patinamiento [%] → 100 = bloqueada</text>
      <text x={GX0} y={GY0 - 12} className="svg-label">Coeficiente de adherencia μ</text>
      <path d={curveY} fill="none" stroke="var(--teal)" strokeWidth={2.2} strokeDasharray="6 4" />
      <path d={curveX} fill="none" stroke="var(--primary)" strokeWidth={2.8} />
      <text x={mx(0.15)} y={GY0 + 14} textAnchor="middle" className="svg-small" style={{ fill: "var(--ok)" }}>ABS</text>
      <line x1={mx(p.slip)} y1={GY0} x2={mx(p.slip)} y2={GY1} stroke="var(--text)" opacity={0.3} />
      <circle cx={mx(p.slip)} cy={my(p.muY(p.slip))} r={5} fill="var(--teal)" stroke="var(--surface)" strokeWidth={1.5} />
      <circle cx={mx(p.slip)} cy={my(p.muX)} r={6.5} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}
