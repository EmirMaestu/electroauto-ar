import { Link } from "react-router";
import { PARTS, READY_LESSONS, isReady, lessonKey, partLessons } from "../content/registry";
import { Store, useProgress } from "../lib/progress";

const RANKS = [
  { xp: 0, name: "Aprendiz", icon: "🔩" },
  { xp: 100, name: "Ayudante de taller", icon: "🔧" },
  { xp: 300, name: "Mecánico", icon: "🛠️" },
  { xp: 700, name: "Electromecánico", icon: "⚡" },
  { xp: 1300, name: "Diagnosticador", icon: "🧠" },
  { xp: 2200, name: "Jefe de taller", icon: "🏆" },
];

export default function Progreso() {
  const p = useProgress();
  const rank = [...RANKS].reverse().find((r) => p.xp >= r.xp)!;
  const next = RANKS.find((r) => r.xp > p.xp);
  const done = READY_LESSONS.filter((l) => p.lessons[lessonKey(l)]).length;
  const weak = Store.weakTopics();
  return (
    <div className="page narrow" style={{ maxWidth: 940 }}>
      <div className="eyebrow">Mi progreso</div>
      <h1>{rank.icon} {rank.name}</h1>
      <p className="muted">{p.xp} ★ de experiencia{next ? ` · te faltan ${next.xp - p.xp} para “${next.name}”` : " · llegaste al máximo"}</p>
      {next && <div className="progress" style={{ maxWidth: 420 }}><span style={{ width: `${((p.xp - rank.xp) / (next.xp - rank.xp)) * 100}%` }} /></div>}
      <div className="grid cols-4 mt-3">
        <div className="card"><div className="stat"><div className="n">{done}</div><div className="l">lecciones de {READY_LESSONS.length}</div></div></div>
        <div className="card"><div className="stat"><div className="n">{Object.keys(p.quizzes).length}</div><div className="l">quizzes hechos</div></div></div>
        <div className="card"><div className="stat"><div className="n">{Object.keys(p.cases).length}</div><div className="l">casos resueltos</div></div></div>
        <div className="card"><div className="stat"><div className="n">{Object.keys(p.sim).length + Object.keys(p.bench ?? {}).length}</div><div className="l">diagnósticos en el banco</div></div></div>
      </div>
      <h2 className="mt-4">Por parte</h2>
      <div className="stack" style={{ gap: ".6rem" }}>
        {PARTS.filter((x) => partLessons(x).some(isReady)).map((x) => {
          const r = partLessons(x).filter(isReady);
          const d = r.filter((l) => p.lessons[lessonKey(l)]).length;
          return (
            <Link key={x.id} to={`/aprender/${x.id}`} className="lesson-row">
              <span style={{ fontSize: "1.3rem" }}>{x.icon}</span>
              <span style={{ flex: 1 }}><div className="t">{x.title}</div><div className="progress mt-1"><span style={{ width: `${(d / r.length) * 100}%` }} /></div></span>
              <span className="mono faint">{d}/{r.length}</span>
            </Link>
          );
        })}
      </div>
      {weak.length > 0 && (
        <>
          <h2 className="mt-4">Temas para repasar</h2>
          <div className="chip-row">{weak.map((w) => <span key={w.topic} className="chip">{w.topic} · {Math.round(w.ratio * 100)}%</span>)}</div>
          <Link to="/practica" className="btn ghost">Practicar mis temas flojos</Link>
        </>
      )}
      <div className="mt-4">
        <button className="btn ghost sm" onClick={() => { if (confirm("¿Seguro? Se borra todo tu progreso.")) Store.reset(); }}>Reiniciar todo mi progreso</button>
      </div>
    </div>
  );
}
