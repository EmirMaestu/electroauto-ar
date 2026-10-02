import { lazy, Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import { Link, useParams } from "react-router";
import { MDXProvider } from "@mdx-js/react";
import { LEVELS, findLesson, lessonKey, neighbors, isReady, type FlatLesson } from "../content/registry";
import { mdxComponents } from "../components/mdx";
import { Quiz } from "../components/mdx/Quiz";
import { Store, useProgress } from "../lib/progress";
import { mountVisuals } from "../legacy/visuals";
import curriculum from "../content/legacy/curriculum.json";
import { NotFound } from "./NotFound";

const mdxLoaders = import.meta.glob<{ default: ComponentType }>("../content/lessons/*/*.mdx");
const lazyCache = new Map<string, ComponentType>();
function mdxFor(partId: string, lessonId: string): ComponentType | null {
  const key = `../content/lessons/${partId}/${lessonId}.mdx`;
  if (!mdxLoaders[key]) return null;
  if (!lazyCache.has(key)) lazyCache.set(key, lazy(mdxLoaders[key]));
  return lazyCache.get(key)!;
}

const legacyHtml: Record<string, string> = {};
for (const L of curriculum as any[]) for (const m of L.modules) for (const l of m.lessons) legacyHtml[l.id] = l.html;

const GncContent = lazy(() => import("./Gnc").then((m) => ({ default: m.GncContent })));

function LegacyBody({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) mountVisuals(ref.current); }, [id]);
  return <div ref={ref} className="legacy prose legacy-lesson" dangerouslySetInnerHTML={{ __html: legacyHtml[id] ?? "<p>Contenido no encontrado.</p>" }} />;
}

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function Toc({ root }: { root: React.RefObject<HTMLElement | null> }) {
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  const [active, setActive] = useState<string>("");
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const collect = () => {
      const hs = Array.from(el.querySelectorAll("h2"));
      hs.forEach((h) => { if (!h.id) h.id = slug(h.textContent || ""); });
      setItems(hs.map((h) => ({ id: h.id, text: h.textContent || "" })));
      return hs;
    };
    let hs = collect();
    const mo = new MutationObserver(() => { hs = collect(); observe(); });
    let io: IntersectionObserver | null = null;
    const observe = () => {
      io?.disconnect();
      io = new IntersectionObserver((entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      }, { rootMargin: "-80px 0px -70% 0px" });
      hs.forEach((h) => io!.observe(h));
    };
    observe();
    mo.observe(el, { childList: true, subtree: true });
    return () => { mo.disconnect(); io?.disconnect(); };
  }, [root]);
  if (items.length < 2) return <aside className="toc" />;
  return (
    <aside className="toc">
      <div className="toc-title">En esta lección</div>
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} className={active === i.id ? "active" : ""} onClick={(e) => { e.preventDefault(); document.getElementById(i.id)?.scrollIntoView({ behavior: "smooth" }); }}>
          {i.text}
        </a>
      ))}
    </aside>
  );
}

function LessonFooter({ lesson }: { lesson: FlatLesson }) {
  const progress = useProgress();
  const key = lessonKey(lesson);
  const done = !!progress.lessons[key];
  const { prev, next } = neighbors(lesson);
  return (
    <div className="lesson-footer">
      {lesson.quiz && <Quiz id={lesson.quiz} title="Ponete a prueba" />}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className={`btn ${done ? "ok" : "accent"}`} onClick={() => (done ? Store.unmarkLesson(key) : Store.markLesson(key))}>
          {done ? "✓ Lección completada" : "Marcar como completada (+10 ★)"}
        </button>
        {lesson.book && <span className="bookref">📘 Para profundizar: Bosch Automotive Handbook, {lesson.book}</span>}
      </div>
      <div className="pager">
        {prev ? <Link to={prev.path}><div className="dir">← Anterior</div><div className="t">{prev.title}</div></Link> : <span />}
        {next && <Link to={next.path} className="next"><div className="dir">Siguiente →</div><div className="t">{next.title}</div></Link>}
      </div>
    </div>
  );
}

export function LessonPage() {
  const { partId, lessonId } = useParams();
  const lesson = findLesson(partId, lessonId);
  const articleRef = useRef<HTMLElement>(null);
  useEffect(() => { if (lesson && isReady(lesson)) Store.setLastLesson(lesson.path); }, [lesson]);
  if (!lesson) return <NotFound />;

  let body: React.ReactNode;
  if (lesson.source.kind === "legacy") body = <LegacyBody id={lesson.source.id} />;
  else if (lesson.source.kind === "page") body = <div className="legacy"><GncContent /></div>;
  else if (lesson.source.kind === "mdx") {
    const Mdx = mdxFor(lesson.part.id, lesson.id);
    body = Mdx ? <div className="prose"><MDXProvider components={mdxComponents}><Mdx /></MDXProvider></div> : <SoonBody />;
  } else body = <SoonBody />;

  return (
    <div className="page" style={{ maxWidth: 1180 }}>
      <div className="lesson-layout">
        <article ref={articleRef} key={lesson.path}>
          <header className="lesson-head">
            <div className="crumbs">
              <Link to="/ruta">Curso</Link> <span>›</span>
              <Link to={`/aprender/${lesson.part.id}`}>{lesson.part.icon} {lesson.part.title}</Link>
              {lesson.chapter && <><span>›</span><span>{lesson.chapter}</span></>}
            </div>
            <h1>{lesson.title}</h1>
            <p className="summary">{lesson.summary}</p>
            <div className="meta">
              <span className={`pill ${lesson.level}`}>{LEVELS[lesson.level].label}</span>
              {lesson.minutes > 0 && <span>⏱ {lesson.minutes} min</span>}
              {lesson.book && <span>📘 {lesson.book}</span>}
            </div>
          </header>
          <Suspense fallback={<p className="muted">Cargando la lección…</p>}>{body}</Suspense>
          {isReady(lesson) && <LessonFooter lesson={lesson} />}
        </article>
        <Toc root={articleRef} />
      </div>
    </div>
  );
}

function SoonBody() {
  return (
    <div className="card center" style={{ padding: "2.5rem 1.5rem" }}>
      <div style={{ fontSize: "2.4rem" }}>🛠️</div>
      <h3>Esta lección está en el taller</h3>
      <p className="muted">Está en el mapa del curso y la vamos a ir escribiendo siguiendo el orden del libro.</p>
      <Link className="btn ghost" to="/ruta">Ver el mapa completo</Link>
    </div>
  );
}
