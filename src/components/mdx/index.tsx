/* Todo lo que una lección MDX puede usar sin importar nada.
   Las animaciones se cargan a demanda (cada una en su propio chunk). */
import { lazy, Suspense, type ComponentType } from "react";
import { Link } from "react-router";
import * as blocks from "./blocks";
import { Quiz } from "./Quiz";

const animLoaders = import.meta.glob<Record<string, ComponentType<any>>>("../anim/*.tsx");

function AnimPlaceholder() {
  return (
    <div className="anim" style={{ minHeight: 420, display: "grid", placeItems: "center" }}>
      <span className="muted" style={{ fontSize: ".9rem" }}>Cargando animación…</span>
    </div>
  );
}

const anims: Record<string, ComponentType<any>> = {};
for (const [path, load] of Object.entries(animLoaders)) {
  const name = path.split("/").pop()!.replace(/\.tsx$/, "");
  if (!/^[A-Z]/.test(name)) continue;
  const Lazy = lazy(() => load().then((m) => ({ default: m[name] })));
  const Wrapped = (props: any) => (
    <Suspense fallback={<AnimPlaceholder />}>
      <Lazy {...props} />
    </Suspense>
  );
  Wrapped.displayName = name;
  anims[name] = Wrapped;
}

export const ANIMATIONS = anims;

export const mdxComponents: Record<string, ComponentType<any>> = {
  ...anims,
  ...(blocks as unknown as Record<string, ComponentType<any>>),
  Quiz,
  a: ({ href = "", ...p }: any) => (href.startsWith("/") ? <Link to={href} {...p} /> : <a href={href} target="_blank" rel="noreferrer" {...p} />),
  table: (p: any) => <div className="table-wrap"><table {...p} /></div>,
};
