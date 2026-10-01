/* Todo lo que una lección MDX puede usar sin importar nada. */
import type { ComponentType } from "react";
import * as blocks from "./blocks";
import { Quiz } from "./Quiz";

const animMods = import.meta.glob<Record<string, unknown>>("../anim/*.tsx", { eager: true });
const anims: Record<string, ComponentType<any>> = {};
for (const mod of Object.values(animMods))
  for (const [name, exp] of Object.entries(mod))
    if (/^[A-Z]/.test(name) && typeof exp === "function") anims[name] = exp as ComponentType<any>;

export const ANIMATIONS = anims;

export const mdxComponents: Record<string, ComponentType<any>> = {
  ...anims,
  ...(blocks as unknown as Record<string, ComponentType<any>>),
  Quiz,
  table: (p: any) => <div className="table-wrap"><table {...p} /></div>,
};
