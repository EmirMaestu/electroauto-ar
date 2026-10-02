/* Hooks chicos que usan los bancos. */
import { useEffect, useState, type RefObject } from "react";

/** Ancho en px (CSS) de un elemento, actualizado con ResizeObserver. */
export function useElementWidth<T extends Element>(ref: RefObject<T | null>, fallback = 720) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width || fallback);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, fallback]);
  return w;
}

/** true si la ventana es más angosta que `px`. */
export function useNarrow(px = 820) {
  const q = `(max-width: ${px}px)`;
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== "undefined" && matchMedia(q).matches);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const m = matchMedia(q);
    const on = () => setNarrow(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [q]);
  return narrow;
}

/** true si la pestaña está visible (para no simular en segundo plano). */
export function usePageVisible() {
  const [v, setV] = useState(() => typeof document === "undefined" || document.visibilityState !== "hidden");
  useEffect(() => {
    const on = () => setV(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return v;
}

/** Parsea números escritos "a la argentina" (1,5 / 1.600 / 1.600,5) o con punto decimal (1.5). */
export function parseNum(s: string): number {
  let t = s.trim().replace(/\s/g, "");
  if (!t) return NaN;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const v = Number(t);
  return Number.isFinite(v) ? v : NaN;
}
