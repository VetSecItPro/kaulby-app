// Registry of all video targets. Each target = a Flow + a Recipe + an output stem.
// build.ts iterates this list (or filters to one stem) to produce deliverables.
//
// Adding a new video:
//   1. Create scripts/marketing-videos/flows/{name}.ts exporting a Flow + Recipe
//   2. Add { stem, flow, recipe } here
//   3. Run `pnpm marketing-videos {stem}` to render
import type { VideoTarget } from "../types";
import { hero, heroRecipe } from "./hero";

export const TARGETS: VideoTarget[] = [
  { stem: "hero", flow: hero, recipe: heroRecipe },
];
