import { Link } from "react-router";
import { ALL_LESSONS, PARTS, READY_LESSONS, LEVELS, isReady, lessonKey, partLessons, type Level } from "../content/registry";
import { TOOLS } from "../content/tools";
import { ANIMATIONS } from "../components/mdx";
import { useProgress } from "../lib/progress";
import { useAnimClock, TAU } from "../components/ui/anim-kit";
import { SITE } from "../site";

/** Motor en corte, en loop, para la portada. */
function HeroEngine() {
  const clock = useAnimClock({ speed: 1 });
  const a = (clock.t * 1.6) % TAU; // ángulo de cigüeñal
  const CX = 200, CY = 300, R = 46, L = 132;
  const px = CX + R * Math.sin(a), py = CY - R * Math.cos(a);
  const pistonY = CY - R * Math.cos(a) - Math.sqrt(L * L - (R * Math.sin(a)) ** 2);
  const phase = Math.floor(((clock.t * 1.6) % (2 * TAU)) / Math.PI); // 0..3
  const gas = ["var(--c-air)", "var(--c-mix)", "var(--c-hot)", "var(--c-exhaust)"][phase];
  const names = ["Admisión", "Compresión", "Explosión", "Escape"];
  const top = 70, bore = 92;
  return (
    <div ref={clock.ref} style={{ position: "relative" }}>
      <svg viewBox="0 0 400 420" style={{ width: "100%", maxWidth: 380, display: "block", margin: "0 auto" }} aria-label="Motor animado">
        {/* tapa y cilindro */}
        <rect x={CX - bore / 2 - 18} y={top - 34} width={bore + 36} height={34} rx={6} fill="var(--c-metal-dark)" />
        <rect x={CX - bore / 2 - 14} y={top} width={14} height={190} fill="var(--c-block)" />
        <rect x={CX + bore / 2} y={top} width={14} height={190} fill="var(--c-block)" />
        {/* gas en la cámara */}
        <rect x={CX - bore / 2} y={top} width={bore} height={Math.max(0, pistonY - 30 - top)} fill={gas} opacity={phase === 2 ? 0.75 : 0.35} />
        {/* bujía */}
        <rect x={CX - 5} y={top - 50} width={10} height={20} rx={2} fill="var(--c-metal-light)" />
        {phase === 2 && (clock.t * 1.6) % Math.PI < 0.5 && <circle cx={CX} cy={top + 4} r={10} fill="var(--c-spark)" opacity={0.9} />}
        {/* pistón */}
        <rect x={CX - bore / 2 + 2} y={pistonY - 30} width={bore - 4} height={46} rx={5} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        <line x1={CX - bore / 2 + 2} y1={pistonY - 22} x2={CX + bore / 2 - 2} y2={pistonY - 22} stroke="var(--c-metal-dark)" strokeWidth={2} />
        <line x1={CX - bore / 2 + 2} y1={pistonY - 15} x2={CX + bore / 2 - 2} y2={pistonY - 15} stroke="var(--c-metal-dark)" strokeWidth={2} />
        {/* biela */}
        <line x1={CX} y1={pistonY} x2={px} y2={py} stroke="var(--c-metal-2)" strokeWidth={14} strokeLinecap="round" />
        <circle cx={CX} cy={pistonY} r={6} fill="var(--c-metal-dark)" />
        {/* cigüeñal */}
        <circle cx={CX} cy={CY} r={R + 22} fill="none" stroke="var(--border-strong)" strokeDasharray="4 6" />
        {(() => {
          const cr = R + 16, w = 1.15; // contrapeso: sector opuesto al muñón
          const p1x = CX - cr * Math.sin(a - w), p1y = CY + cr * Math.cos(a - w);
          const p2x = CX - cr * Math.sin(a + w), p2y = CY + cr * Math.cos(a + w);
          return <path d={`M${CX} ${CY} L${p1x} ${p1y} A${cr} ${cr} 0 0 1 ${p2x} ${p2y} Z`} fill="var(--c-metal-dark)" />;
        })()}
        <line x1={CX} y1={CY} x2={px} y2={py} stroke="var(--c-metal-dark)" strokeWidth={18} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={12} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" />
        <circle cx={px} cy={py} r={9} fill="var(--accent)" />
        <text x={CX + 70} y={top + 30} className="svg-title" style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, fill: "var(--accent)", textTransform: "uppercase" }}>{names[phase]}</text>
        <text x={CX + 70} y={top + 52} style={{ fontFamily: "var(--font-mono)", fontSize: 12, fill: "var(--muted)" }}>{Math.round(((clock.t * 1.6) % (2 * TAU)) * 180 / Math.PI)}° de cigüeñal</text>
      </svg>
    </div>
  );
}

const LEVEL_ORDER: Level[] = ["base", "taller", "tecnico", "experto"];
const LEVEL_TEXT: Record<Level, string> = {
  base: "No sabés nada y está perfecto. Qué es cada pieza, para qué sirve y cómo trabajar seguro.",
  taller: "Lo que se usa todos los días: qué revisar, qué medir, qué herramienta usar y cuánto tiene que dar.",
  tecnico: "El porqué: fórmulas, física y cálculos, con ejemplos resueltos y calculadoras.",
  experto: "Diagnóstico fino: señales en el osciloscopio, estrategias de la ECU, sistemas modernos y eléctricos.",
};

export function Home() {
  const progress = useProgress();
  const firstLesson = READY_LESSONS[0];
  const last = progress.lastLesson ? ALL_LESSONS.find((l) => l.path === progress.lastLesson) : undefined;
  const doneCount = READY_LESSONS.filter((l) => progress.lessons[lessonKey(l)]).length;
  const animCount = Object.keys(ANIMATIONS).length;

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-grid">
          <div>
            <div className="eyebrow">🏔️ Hecho en Mendoza · basado en el Bosch Automotive Handbook</div>
            <h1>Aprendé mecánica <em>de verdad</em></h1>
            <p className="lead">
              De no saber qué es un pistón a diagnosticar un auto eléctrico. Con animaciones que podés frenar y mover,
              un banco de pruebas para medir sin miedo a romper nada, y explicado como te lo contaría alguien en el taller.
            </p>
            <div className="hero-actions">
              {last ? (
                <Link to={last.path} className="btn accent">Seguir: {last.title} →</Link>
              ) : (
                <Link to={firstLesson.path} className="btn accent">Empezar desde cero →</Link>
              )}
              <Link to="/ruta" className="btn ghost">Ver el mapa completo</Link>
              <Link to="/banco" className="btn ghost">🧪 Banco de pruebas</Link>
            </div>
            <div className="stats">
              <div className="stat"><div className="n">{READY_LESSONS.length}</div><div className="l">lecciones listas</div></div>
              <div className="stat"><div className="n">{animCount}</div><div className="l">animaciones interactivas</div></div>
              <div className="stat"><div className="n">{TOOLS.length}</div><div className="l">herramientas explicadas</div></div>
              <div className="stat"><div className="n">{doneCount}</div><div className="l">completaste vos</div></div>
            </div>
          </div>
          <HeroEngine />
        </div>
      </section>

      <div className="section-title"><h2>Cómo está armado</h2><span className="line" /></div>
      <div className="grid cols-4">
        {LEVEL_ORDER.map((lv, i) => (
          <div key={lv} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className={`pill ${lv}`}>{LEVELS[lv].label}</span>
              <span className="mono faint">0{i + 1}</span>
            </div>
            <p className="mt-2 mb-0" style={{ fontSize: ".93rem", color: "var(--text-2)" }}>{LEVEL_TEXT[lv]}</p>
          </div>
        ))}
      </div>
      <p className="muted mt-2" style={{ fontSize: ".9rem" }}>
        Cada lección tiene: explicación humana, animaciones, fórmulas con ejemplos, <b>qué hacer en el taller</b>, <b>qué pasa electrónicamente</b>, qué medir y con qué herramienta, y un quiz para fijar.
      </p>

      <div className="section-title"><h2>La ruta</h2><span className="line" /><Link to="/ruta">Ver todo →</Link></div>
      <div className="route">
        {PARTS.slice(0, 11).map((p) => {
          const ls = partLessons(p);
          const ready = ls.filter(isReady);
          const done = ready.filter((l) => progress.lessons[lessonKey(l)]).length;
          const soon = !ready.length;
          const inner = (
            <>
              <div className="num">{p.icon}<small>{String(p.n).padStart(2, "0")}</small></div>
              <div><h3>{p.title}</h3><p>{p.desc}</p></div>
              <div className="right">
                {soon ? <span className="pill soon">Próximamente</span> : <span className="mono faint" style={{ fontSize: ".8rem" }}>{done}/{ready.length} lecciones</span>}
                {!soon && <div className="progress"><span style={{ width: `${(done / ready.length) * 100}%` }} /></div>}
              </div>
            </>
          );
          return soon ? <div key={p.id} className="route-item soon">{inner}</div> : <Link key={p.id} to={`/aprender/${p.id}`} className="route-item">{inner}</Link>;
        })}
        <Link to="/ruta" className="route-item" style={{ justifyContent: "center" }}>
          <div className="num">🔋</div>
          <div><h3>…y hasta los autos eléctricos</h3><p>Diesel, híbridos, eléctricos, chasis, ABS/ESP, redes y ADAS. {PARTS.length} partes en total.</p></div>
          <div className="right"><span className="mono faint">ver mapa →</span></div>
        </Link>
      </div>

      <div className="section-title"><h2>Para meter mano</h2><span className="line" /></div>
      <div className="grid cols-2">
        <Link to="/banco" className="card">
          <div style={{ fontSize: "1.8rem" }}>🧪</div>
          <h3>Banco de pruebas</h3>
          <p className="muted mb-0">Tester virtual sobre circuitos reales, osciloscopio con señales de sensores y un motor con scanner al que le podés meter fallas para ver qué pasa.</p>
        </Link>
        <Link to="/herramientas" className="card">
          <div style={{ fontSize: "1.8rem" }}>🧰</div>
          <h3>Herramientas</h3>
          <p className="muted mb-0">Qué comprar primero, cómo se usa cada una y qué valores tiene que darte. Del tester al compresómetro.</p>
        </Link>
        <Link to="/casos" className="card">
          <div style={{ fontSize: "1.8rem" }}>🚗</div>
          <h3>Casos de falla</h3>
          <p className="muted mb-0">Síntoma, causas posibles, procedimiento y mediciones. Razonás vos y después ves la solución.</p>
        </Link>
        <Link to="/aprender/arranque/mendoza" className="card">
          <div style={{ fontSize: "1.8rem" }}>🏔️</div>
          <h3>Mecánica en Mendoza</h3>
          <p className="muted mb-0">Altura, calor, zonda, ripio y Alta Montaña: qué le pasa al auto acá y qué revisar antes de subir a la cordillera.</p>
        </Link>
      </div>
      <p className="faint center mt-4" style={{ fontSize: ".82rem" }}>{SITE.name} — {SITE.tagline}</p>
    </div>
  );
}
