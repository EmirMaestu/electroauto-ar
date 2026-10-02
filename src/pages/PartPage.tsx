import { Link, useParams } from "react-router";
import { LEVELS, findPart, isReady, lessonKey, partLessons, PARTS } from "../content/registry";
import { useProgress } from "../lib/progress";
import { NotFound } from "./NotFound";

export function PartPage() {
  const { partId } = useParams();
  const part = findPart(partId);
  const progress = useProgress();
  if (!part) return <NotFound />;
  const flat = partLessons(part);
  const ready = flat.filter(isReady);
  const done = ready.filter((l) => progress.lessons[lessonKey(l)]).length;
  const firstTodo = ready.find((l) => !progress.lessons[lessonKey(l)]) ?? ready[0];
  const idx = PARTS.findIndex((p) => p.id === part.id);
  const nextPart = PARTS[idx + 1];
  let n = 0;
  return (
    <div className="page narrow" style={{ maxWidth: 900 }}>
      <div className="lesson-head">
        <div className="crumbs"><Link to="/ruta">Curso</Link> <span>›</span> <span>Parte {part.n}</span></div>
        <div style={{ fontSize: "2.4rem" }}>{part.icon}</div>
        <h1>{part.title}</h1>
        <p className="summary">{part.desc}</p>
        <div className="meta">
          <span>📘 Bosch Automotive Handbook, {part.book}</span>
          {ready.length > 0 && <span>· {done} de {ready.length} completadas</span>}
        </div>
        {ready.length > 0 && <div className="progress mt-2" style={{ maxWidth: 360 }}><span style={{ width: `${(done / ready.length) * 100}%` }} /></div>}
        {firstTodo && <Link to={firstTodo.path} className="btn accent mt-3">{done ? "Seguir" : "Empezar"}: {firstTodo.title} →</Link>}
      </div>
      {part.chapters.map((ch, ci) => (
        <section key={ci} className="mt-3">
          {ch.title && <h3 className="eyebrow" style={{ color: "var(--muted)" }}>{ch.title}</h3>}
          <div className="lesson-list">
            {ch.lessons.map((l) => {
              n++;
              const f = flat.find((x) => x.id === l.id)!;
              const ok = isReady(l);
              const isDone = progress.lessons[lessonKey(f)];
              const inner = (
                <>
                  <span className="n">{String(n).padStart(2, "0")}</span>
                  <span><div className="t">{l.title}</div><div className="s">{l.summary}</div></span>
                  <span className="r">
                    {ok ? <span className={`pill ${l.level}`}>{LEVELS[l.level].label}</span> : <span className="pill soon">Pronto</span>}
                    {l.minutes > 0 && <span className="mono faint" style={{ fontSize: ".78rem" }}>{l.minutes}′</span>}
                    {isDone && <span className="check">✓</span>}
                  </span>
                </>
              );
              return ok ? <Link key={l.id} to={f.path} className="lesson-row">{inner}</Link> : <div key={l.id} className="lesson-row soon">{inner}</div>;
            })}
          </div>
        </section>
      ))}
      {nextPart && (
        <div className="pager mt-4">
          <span />
          <Link to={`/aprender/${nextPart.id}`} className="next"><div className="dir">Siguiente parte →</div><div className="t">{nextPart.icon} {nextPart.title}</div></Link>
        </div>
      )}
    </div>
  );
}
