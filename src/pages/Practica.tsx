import { useMemo, useState } from "react";
import { allQuestions } from "../content/quizzes";
import { Quiz } from "../components/mdx/Quiz";
import dragsets from "../content/legacy/dragsets.json";
import { Store, useProgress } from "../lib/progress";

function shuffle<T>(a: T[]) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

function Match() {
  const sets = dragsets as { title: string; items: [string, string][] }[];
  const [si, setSi] = useState(() => Math.floor(Math.random() * sets.length));
  const set = sets[si];
  const rights = useMemo(() => shuffle(set.items.map((x) => x[1])), [si]);
  const [sel, setSel] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const reset = (n?: number) => { setSi(n ?? (si + 1) % sets.length); setPairs({}); setSel(null); setChecked(false); };
  const okCount = set.items.filter(([l, r]) => pairs[l] === r).length;
  return (
    <div className="card">
      <h3>🧩 {set.title}</h3>
      <p className="muted" style={{ fontSize: ".9rem" }}>Tocá un elemento de la izquierda y después su pareja de la derecha.</p>
      <div className="grid cols-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="stack" style={{ gap: ".5rem" }}>
          {set.items.map(([l]) => (
            <button key={l} className={`quiz-opt ${sel === l ? "correct" : ""} ${checked ? (pairs[l] === set.items.find((x) => x[0] === l)![1] ? "correct" : "wrong") : ""}`} style={{ margin: 0 }} onClick={() => !checked && setSel(l)}>
              <span><b>{l}</b>{pairs[l] && <span className="muted"> → {pairs[l]}</span>}</span>
            </button>
          ))}
        </div>
        <div className="stack" style={{ gap: ".5rem" }}>
          {rights.map((r) => (
            <button key={r} className="quiz-opt" style={{ margin: 0, opacity: Object.values(pairs).includes(r) ? 0.45 : 1 }} disabled={!sel || checked}
              onClick={() => { if (!sel) return; const p = { ...pairs }; for (const k in p) if (p[k] === r) delete p[k]; p[sel] = r; setPairs(p); setSel(null); }}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="row mt-2">
        {!checked ? (
          <button className="btn accent sm" disabled={Object.keys(pairs).length < set.items.length} onClick={() => { setChecked(true); if (okCount === set.items.length) Store.addXP(5); }}>Corregir</button>
        ) : (
          <span style={{ fontWeight: 700, color: okCount === set.items.length ? "var(--ok)" : "var(--warn)" }}>{okCount}/{set.items.length} correctas{okCount === set.items.length ? " · +5 ★" : ""}</span>
        )}
        <button className="btn ghost sm" onClick={() => reset()}>Otro ejercicio</button>
      </div>
    </div>
  );
}

export default function Practica() {
  const progress = useProgress();
  const [session, setSession] = useState(0);
  const [mode, setMode] = useState<"mix" | "debiles">("mix");
  const all = useMemo(() => allQuestions(), []);
  const weak = Store.weakTopics().map((w) => w.topic);
  const qs = useMemo(() => {
    const pool = mode === "debiles" && weak.length ? all.filter((q) => weak.includes(q.topic ?? q.qid)) : all;
    return shuffle(pool).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, mode]);
  return (
    <div className="page narrow">
      <div className="eyebrow">Práctica intensiva</div>
      <h1>Entrená la cabeza</h1>
      <p className="muted">{all.length} preguntas de todo el curso. Sesiones cortas de 8, mezcladas. Lo que errás queda anotado en tu progreso.</p>
      <div className="row">
        <button className="btn accent" onClick={() => { setMode("mix"); setSession((s) => s + 1); }}>⚡ Nueva sesión de 8</button>
        <button className="btn ghost" disabled={!weak.length} onClick={() => { setMode("debiles"); setSession((s) => s + 1); }} title={weak.length ? "" : "Todavía no hay temas flojos detectados"}>🎯 Sólo mis temas flojos</button>
      </div>
      <Quiz key={session + mode} questions={qs} title={mode === "debiles" ? "Temas flojos" : "Sesión mezclada"} onFinish={(p) => Store.recordExam("practica", p)} />
      <Match />
      {progress.errors.length > 0 && (
        <div className="card mt-3">
          <h3>📝 Últimas que se te complicaron</h3>
          <ul className="mb-0">{progress.errors.slice(0, 8).map((e, i) => <li key={i} style={{ fontSize: ".92rem" }}>{e.q} <span className="faint">({e.topic})</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}
