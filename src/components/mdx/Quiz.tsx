import { useMemo, useState } from "react";
import { QUIZZES, type Question } from "../../content/quizzes";
import { Store } from "../../lib/progress";

const LETTERS = "ABCDEFG";

export function Quiz({ id, questions, title = "Ponete a prueba", shuffle = false, onFinish }: {
  id?: string; questions?: Question[]; title?: string; shuffle?: boolean; onFinish?: (pct: number) => void;
}) {
  const base = useMemo(() => {
    const qs = questions ?? (id ? QUIZZES[id] ?? [] : []);
    return shuffle ? [...qs].sort(() => Math.random() - 0.5) : qs;
  }, [id, questions, shuffle]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  if (!base.length) return null;
  const q = base[idx];

  const answer = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = i === q.correct;
    if (ok) setScore((s) => s + 1);
    Store.recordAnswer(q.topic ?? id ?? "general", ok, q.q);
  };
  const next = () => {
    if (idx + 1 < base.length) { setIdx(idx + 1); setPicked(null); return; }
    const pct = Math.round((score / base.length) * 100);
    if (id) Store.recordQuiz(id, pct);
    onFinish?.(pct);
    setDone(true);
  };
  const restart = () => { setIdx(0); setPicked(null); setScore(0); setDone(false); };

  if (done) {
    const pct = Math.round((score / base.length) * 100);
    const msg = pct >= 90 ? "¡Impecable! Esto ya lo tenés." : pct >= 70 ? "Bien ahí. Repasá lo que fallaste y seguí." : pct >= 40 ? "Vas encaminado. Volvé a leer las partes flojas." : "Tranqui: releé la lección con calma y probá de nuevo.";
    return (
      <section className="quiz">
        <div className="quiz-head"><span>🎯</span><span className="title">{title}</span></div>
        <div className="quiz-body quiz-result">
          <div className="score" style={{ color: pct >= 70 ? "var(--ok)" : pct >= 40 ? "var(--warn)" : "var(--bad)" }}>{pct}%</div>
          <p className="muted">{score} de {base.length} bien · {msg}</p>
          <button className="btn ghost" onClick={restart}>Intentar de nuevo</button>
        </div>
      </section>
    );
  }

  return (
    <section className="quiz">
      <div className="quiz-head"><span>🎯</span><span className="title">{title}</span><span className="count">{idx + 1} / {base.length}</span></div>
      <div className="quiz-body">
        <div className="quiz-q">{q.q}</div>
        {q.opts.map((o, i) => {
          const cls = picked === null ? "" : i === q.correct ? "correct" : i === picked ? "wrong" : "";
          return (
            <button key={i} className={`quiz-opt ${cls}`} disabled={picked !== null} onClick={() => answer(i)}>
              <span className="letter">{LETTERS[i]}</span><span>{o}</span>
            </button>
          );
        })}
        {picked !== null && (
          <>
            <div className="quiz-explain">{picked === q.correct ? "✅ ¡Correcto! " : "❌ No. "}{q.explain}</div>
            <div style={{ marginTop: ".8rem", textAlign: "right" }}>
              <button className="btn accent sm" onClick={next}>{idx + 1 < base.length ? "Siguiente →" : "Ver resultado"}</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
