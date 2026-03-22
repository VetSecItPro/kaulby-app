import { spring, SpringConfig } from "remotion";

// Reusable spring configs
export const SMOOTH_SPRING: SpringConfig = {
  damping: 20,
  mass: 0.8,
  stiffness: 120,
};

export const BOUNCY_SPRING: SpringConfig = {
  damping: 12,
  mass: 0.6,
  stiffness: 200,
};

export const GENTLE_SPRING: SpringConfig = {
  damping: 26,
  mass: 1,
  stiffness: 80,
};

export const SNAPPY_SPRING: SpringConfig = {
  damping: 18,
  mass: 0.5,
  stiffness: 250,
};

// Helper to create a spring animation starting at a specific frame
export function springAt({
  frame,
  fps,
  startFrame,
  config = SMOOTH_SPRING,
}: {
  frame: number;
  fps: number;
  startFrame: number;
  config?: SpringConfig;
}) {
  if (frame < startFrame) return 0;
  return spring({
    frame: frame - startFrame,
    fps,
    config,
  });
}

// Helper for staggered animations
export function staggeredSpring({
  frame,
  fps,
  startFrame,
  index,
  staggerDelay = 4,
  config = SMOOTH_SPRING,
}: {
  frame: number;
  fps: number;
  startFrame: number;
  index: number;
  staggerDelay?: number;
  config?: SpringConfig;
}) {
  return springAt({
    frame,
    fps,
    startFrame: startFrame + index * staggerDelay,
    config,
  });
}
