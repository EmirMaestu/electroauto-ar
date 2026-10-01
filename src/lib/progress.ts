/* Progreso del alumno: XP, lecciones, quizzes, casos, simulador.
   Guarda en localStorage con la MISMA clave que ElectroAuto v1, así nadie pierde lo que ya hizo. */
import { useSyncExternalStore } from "react";

const KEY = "electroauto_ar_v1";

export interface ProgressData {
  xp: number;
  lessons: Record<string, boolean>;
  quizzes: Record<string, { best: number; attempts: number }>;
  topics: Record<string, { ok: number; total: number }>;
  cases: Record<string, boolean>;
  sim: Record<string, boolean>;
  exams: Record<string, number>;
  errors: { q: string; topic: string; date: number }[];
  theme: "light" | "dark";
  lastLesson?: string; // ruta de la última lección abierta
  bench?: Record<string, boolean>; // diagnósticos resueltos en bancos nuevos
}

const def = (): ProgressData => ({
  xp: 0, lessons: {}, quizzes: {}, topics: {}, cases: {}, sim: {}, exams: {}, errors: [],
  theme: typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  bench: {},
});

function load(): ProgressData {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...def(), ...JSON.parse(raw) } : def();
  } catch {
    return def();
  }
}

let data: ProgressData = load();
const listeners = new Set<() => void>();

function commit(next: ProgressData) {
  data = next;
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* modo privado */ }
  listeners.forEach((l) => l());
}
function mutate(fn: (d: ProgressData) => void) {
  const next: ProgressData = JSON.parse(JSON.stringify(data));
  fn(next);
  commit(next);
}

export const Store = {
  data: () => data,
  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
  addXP(n: number) { mutate((d) => { d.xp += n; }); },
  isLessonDone: (id: string) => !!data.lessons[id],
  markLesson(id: string) { if (!data.lessons[id]) mutate((d) => { d.lessons[id] = true; d.xp += 10; }); },
  unmarkLesson(id: string) { if (data.lessons[id]) mutate((d) => { delete d.lessons[id]; d.xp = Math.max(0, d.xp - 10); }); },
  setLastLesson(path: string) { if (data.lastLesson !== path) mutate((d) => { d.lastLesson = path; }); },
  recordQuiz(quizId: string, percent: number) {
    mutate((d) => {
      const q = d.quizzes[quizId] || { best: 0, attempts: 0 };
      q.attempts++; q.best = Math.max(q.best, percent);
      d.quizzes[quizId] = q;
      d.xp += Math.round(percent / 10);
    });
  },
  recordAnswer(topic: string, ok: boolean, qtext?: string) {
    mutate((d) => {
      const t = d.topics[topic || "general"] || { ok: 0, total: 0 };
      t.total++; if (ok) t.ok++;
      d.topics[topic || "general"] = t;
      if (!ok && qtext) { d.errors.unshift({ q: qtext, topic: topic || "general", date: Date.now() }); d.errors = d.errors.slice(0, 50); }
    });
  },
  markCase(id: string) { if (!data.cases[id]) mutate((d) => { d.cases[id] = true; d.xp += 8; }); },
  isCaseDone: (id: string) => !!data.cases[id],
  markSim(key: string) { if (!data.sim[key]) mutate((d) => { d.sim[key] = true; d.xp += 12; }); },
  isSimDone: (key: string) => !!data.sim[key],
  markBench(key: string) { if (!data.bench?.[key]) mutate((d) => { d.bench = d.bench || {}; d.bench[key] = true; d.xp += 15; }); },
  isBenchDone: (key: string) => !!data.bench?.[key],
  recordExam(id: string, percent: number) { mutate((d) => { d.exams[id] = Math.max(d.exams[id] || 0, percent); d.xp += Math.round(percent / 5); }); },
  getTheme: () => data.theme,
  setTheme(t: "light" | "dark") { document.documentElement.dataset.theme = t; mutate((d) => { d.theme = t; }); },
  weakTopics() {
    return Object.entries(data.topics)
      .map(([topic, v]) => ({ topic, ratio: v.total ? v.ok / v.total : 1, total: v.total }))
      .filter((x) => x.total >= 2 && x.ratio < 0.7)
      .sort((a, b) => a.ratio - b.ratio);
  },
  reset() { commit({ ...def(), theme: data.theme }); },
};

export function useProgress(): ProgressData {
  return useSyncExternalStore(Store.subscribe, Store.data, Store.data);
}
