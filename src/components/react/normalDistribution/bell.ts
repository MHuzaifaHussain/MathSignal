// The bell mode's numbers and its one sentence, moved out of NormalDistribution.tsx unchanged so the z mode can reuse
// `gaussian` and scripts/check-boards.mjs can pin them. Pure: no React or Mafs at runtime. Decision 0019.
import type { vec } from "mafs";
import { formatNumber } from "../plotColors.ts";

export const INITIAL_MU = 0;
export const INITIAL_SIGMA = 1;
export const MU_RANGE: vec.Vector2 = [-3, 3];
export const SIGMA_RANGE: vec.Vector2 = [0.4, 2.5];
export const MU_STEP = 0.1;
export const SIGMA_STEP = 0.05;
export const VIEW_X: vec.Vector2 = [-5, 5];
/** Tall enough for the narrowest bell: peak = 1 / (σ√2π) ≈ 1.0 at σ = 0.4. */
export const VIEW_Y: vec.Vector2 = [-0.12, 1.1];
export const BOARD_HEIGHT = 360;
export const LABEL_OFFSET = 0.07;

export function gaussian(x: number, mu: number, sigma: number): number {
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
}

export function describeState(mu: number, sigma: number): string {
  return `Mean ${formatNumber(mu)}, standard deviation ${formatNumber(sigma)}, peak height ${formatNumber(gaussian(mu, mu, sigma))}.`;
}
