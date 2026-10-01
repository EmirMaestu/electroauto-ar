import { Link } from "react-router";
import { PARTS, READY_LESSONS, ALL_LESSONS, isReady, lessonKey, partLessons } from "../content/registry";
import { useProgress } from "../lib/progress";

export function Ruta() {
  const progress = useProgress();
  return (
    <div className="page narrow" style={{ maxWidth: 980 }}>
      <div className="eyebrow">Mapa del curso</div>
      <h1>De cero a autos eléctricos</h1>
      <p className="muted" style={{ maxWidth: "64ch" }}>
        {PARTS.length} partes, siguiendo el orden del <i>Bosch Automotive Handbook</i>. Hoy hay {READY_LESSONS.length} lecciones listas
        de {ALL_LESSONS.length} planificadas; las que dicen “próximamente” se van sumando.
      </p>
      <div className="route mt-3">
        {PARTS.map((p) => {
          const ls = partLessons(p);
          const ready = ls.filter(isReady);
          const done = ready.filter((l) => progress.lessons[lessonKey(l)]).length;
          const soon = !ready.length;
          return (
            <Link key={p.id} to={`/aprender/${p.id}`} className={`route-item ${soon ? "soon" : ""}`}>
              <div className="num">{p.icon}<small>{String(p.n).padStart(2, "0")}</small></div>
              <div>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
                <p className="faint" style={{ fontSize: ".78rem", marginTop: ".25rem" }}>📘 {p.book} · {ls.length} lecciones</p>
              </div>
              <div className="right">
                {soon ? <span className="pill soon">Próximamente</span> : <span className="mono faint" style={{ fontSize: ".8rem" }}>{done}/{ready.length}</span>}
                {!soon && <div className="progress"><span style={{ width: `${(done / ready.length) * 100}%` }} /></div>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
