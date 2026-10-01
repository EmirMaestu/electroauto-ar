import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { PARTS, isReady, lessonKey, partLessons } from "../../content/registry";
import { Store, useProgress } from "../../lib/progress";
import { search, type SearchItem } from "../../lib/search";
import { SITE } from "../../site";

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="14" fill="var(--text)" />
      <circle cx="32" cy="41" r="11" fill="none" stroke="var(--accent)" strokeWidth="5" />
      <rect x="23" y="9" width="18" height="15" rx="3" fill="var(--bg)" />
      <line x1="25" y1="14" x2="39" y2="14" stroke="var(--text)" strokeWidth="1.6" />
      <line x1="32" y1="24" x2="40" y2="41" stroke="var(--bg)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="40" cy="41" r="3.5" fill="var(--accent)" />
    </svg>
  );
}

function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => search(q), [q]);
  useEffect(() => { if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 10); } }, [open]);
  useEffect(() => setSel(0), [q]);
  if (!open) return null;
  const go = (it: SearchItem) => { onClose(); nav(it.to); };
  const suggestions = ["compresión", "sonda lambda", "correa de distribución", "termostato", "relé", "turbo", "bujía", "Mendoza"];
  return (
    <div className="palette-back" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Buscar">
        <input
          ref={inputRef} type="search" placeholder="Buscá un tema, pieza, herramienta, falla…" value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === "Enter" && results[sel]) go(results[sel]);
          }}
        />
        <div className="palette-list">
          {!q && (
            <div style={{ padding: ".8rem" }}>
              <div className="eyebrow" style={{ marginBottom: ".5rem" }}>Probá con</div>
              <div className="chip-row">{suggestions.map((s) => <span key={s} className="chip" onClick={() => setQ(s)}>{s}</span>)}</div>
            </div>
          )}
          {q && !results.length && <div className="palette-empty">No encontré nada con “{q}”. Probá con otra palabra.</div>}
          {results.map((it, i) => (
            <a key={it.kind + it.to + it.title} className={`palette-item ${i === sel ? "sel" : ""}`} onMouseEnter={() => setSel(i)} onClick={(e) => { e.preventDefault(); go(it); }} href={it.to}>
              <span className="ic">{it.icon}</span>
              <span><div className="t">{it.title}</div><div className="s">{it.sub}</div></span>
              <span className="k">{it.kind}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Sidebar({ open, onNav }: { open: boolean; onNav: () => void }) {
  const progress = useProgress();
  const loc = useLocation();
  const currentPart = loc.pathname.startsWith("/aprender/") ? loc.pathname.split("/")[2] : undefined;
  return (
    <nav className={`sidebar ${open ? "open" : ""}`} aria-label="Navegación">
      <div className="side-section">
        <NavLink to="/" end className="side-link" onClick={onNav}><span className="ic">🏠</span>Inicio</NavLink>
        <NavLink to="/ruta" className="side-link" onClick={onNav}><span className="ic">🗺️</span>Mapa del curso</NavLink>
        <NavLink to="/banco" className="side-link" onClick={onNav}><span className="ic">🧪</span>Banco de pruebas</NavLink>
        <NavLink to="/herramientas" className="side-link" onClick={onNav}><span className="ic">🧰</span>Herramientas</NavLink>
        <NavLink to="/casos" className="side-link" onClick={onNav}><span className="ic">🚗</span>Casos de falla</NavLink>
        <NavLink to="/practica" className="side-link" onClick={onNav}><span className="ic">🎯</span>Práctica</NavLink>
        <NavLink to="/biblioteca" className="side-link" onClick={onNav}><span className="ic">📕</span>Biblioteca</NavLink>
        <NavLink to="/glosario" className="side-link" onClick={onNav}><span className="ic">📖</span>Glosario</NavLink>
        <NavLink to="/progreso" className="side-link" onClick={onNav}><span className="ic">📈</span>Mi progreso</NavLink>
      </div>
      <div className="side-section">
        <div className="side-title">El curso</div>
        {PARTS.map((p) => {
          const lessons = partLessons(p);
          const ready = lessons.filter(isReady);
          const done = ready.filter((l) => progress.lessons[lessonKey(l)]).length;
          const soon = ready.length === 0;
          return (
            <details key={p.id} className="side-part" open={p.id === currentPart}>
              <summary className={`side-link ${soon ? "soon" : ""} ${p.id === currentPart ? "active" : ""}`}>
                <span className="ic">{p.icon}</span>
                <span>{p.title}</span>
                <span className="count">{soon ? "pronto" : `${done}/${ready.length}`}</span>
                <span className="chev">▶</span>
              </summary>
              <div className="side-lessons">
                <NavLink to={`/aprender/${p.id}`} end className="side-link" onClick={onNav}>Ver la parte completa</NavLink>
                {p.chapters.map((ch, ci) => (
                  <div key={ci}>
                    {ch.title && p.chapters.length > 1 && <div className="side-chapter">{ch.title}</div>}
                    {ch.lessons.map((l) => {
                      const flat = lessons.find((x) => x.id === l.id)!;
                      const ok = isReady(l);
                      return ok ? (
                        <NavLink key={l.id} to={flat.path} className="side-link" onClick={onNav}>
                          <span>{l.title}</span>
                          {progress.lessons[lessonKey(flat)] && <span className="done-dot" title="Completada" />}
                        </NavLink>
                      ) : (
                        <span key={l.id} className="side-link soon" title="Próximamente">{l.title}</span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </nav>
  );
}

export function Shell() {
  const progress = useProgress();
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();

  // Compatibilidad con los links viejos (#/aprender, #/simulador, …)
  useEffect(() => {
    if (loc.hash.startsWith("#/")) {
      const old = loc.hash.slice(2).split("/")[0];
      const map: Record<string, string> = { inicio: "/", aprender: "/aprender/electricidad", simulador: "/banco/tester", herramientas: "/herramientas", casos: "/casos", practica: "/practica", biblioteca: "/biblioteca", gnc: "/gnc", progreso: "/progreso" };
      nav(map[old] ?? "/", { replace: true });
    }
  }, [loc.hash, nav]);

  useEffect(() => {
    if (loc.hash && !loc.hash.startsWith("#/")) {
      const id = decodeURIComponent(loc.hash.slice(1));
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } else window.scrollTo(0, 0);
    setNavOpen(false);
  }, [loc.pathname, loc.hash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen((o) => !o); }
      if (e.key === "/" && !(e.target as HTMLElement)?.closest("input,textarea,select")) { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const dark = progress.theme === "dark";
  return (
    <>
      <header className="topbar">
        <button className="icon-btn menu-btn" onClick={() => setNavOpen((o) => !o)} aria-label="Menú">☰</button>
        <Link to="/" className="brand">
          <BrandMark />
          <span><span className="brand-name">{SITE.name}</span><span className="brand-tag">{SITE.tagline}</span></span>
        </Link>
        <div className="topbar-spacer" />
        <button className="search-trigger" onClick={() => setSearchOpen(true)} aria-label="Buscar">
          🔎<span>Buscar…</span><kbd>Ctrl K</kbd>
        </button>
        <Link to="/progreso" className="xp-chip" title="Tu experiencia">★ {progress.xp}</Link>
        <button className="icon-btn" onClick={() => Store.setTheme(dark ? "light" : "dark")} aria-label="Cambiar tema" title={dark ? "Modo claro" : "Modo oscuro"}>
          {dark ? "☀️" : "🌙"}
        </button>
      </header>
      <div className="shell">
        <Sidebar open={navOpen} onNav={() => setNavOpen(false)} />
        <div className={`backdrop ${navOpen ? "show" : ""}`} onClick={() => setNavOpen(false)} />
        <main className="main" id="main">
          <Suspense fallback={<div className="page"><p className="muted">Cargando…</p></div>}>
            <Outlet />
          </Suspense>
          <footer className="footer">
            <b>{SITE.name}</b> · {SITE.tagline} · Hecho en {SITE.city}<br />
            Contenido original basado en el temario del <i>Bosch Automotive Handbook</i> (11ª ed.). Valores típicos de referencia: siempre confirmá con el manual del fabricante.
          </footer>
        </main>
      </div>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
