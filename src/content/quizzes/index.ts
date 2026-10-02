/* Banco de preguntas: las heredadas de ElectroAuto v1 + las nuevas (archivos *.quiz.ts). */
import legacy from "../legacy/quizzes.json";

export interface Question {
  q: string;
  opts: string[];
  /** índice de la opción correcta */
  correct: number;
  explain: string;
  topic?: string;
}

const mods = import.meta.glob<{ default: Record<string, Question[]> }>("./*.quiz.ts", { eager: true });

export const QUIZZES: Record<string, Question[]> = { ...(legacy as Record<string, Question[]>) };
for (const m of Object.values(mods)) Object.assign(QUIZZES, m.default);

export function allQuestions() {
  const out: (Question & { qid: string })[] = [];
  for (const qid in QUIZZES) QUIZZES[qid].forEach((q) => out.push({ ...q, qid }));
  return out;
}
