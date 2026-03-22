import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

interface CursorKeyframe {
  frame: number;
  x: number;
  y: number;
  click?: boolean;
}

/**
 * Animated cursor that moves between keyframe positions with smooth spring physics.
 * Supports click animations (scale pulse).
 */
export const AnimatedCursor: React.FC<{
  keyframes: CursorKeyframe[];
  startFrame?: number;
}> = ({ keyframes, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relFrame = frame - startFrame;
  if (relFrame < 0 || keyframes.length === 0) return null;

  // Find current segment
  let currentX = keyframes[0].x;
  let currentY = keyframes[0].y;
  let isClicking = false;

  for (let i = 0; i < keyframes.length - 1; i++) {
    const from = keyframes[i];
    const to = keyframes[i + 1];

    if (relFrame >= from.frame && relFrame <= to.frame) {
      const segmentDuration = to.frame - from.frame;
      const segmentProgress = (relFrame - from.frame) / segmentDuration;

      // Smooth easing (ease-in-out cubic)
      const eased = segmentProgress < 0.5
        ? 4 * segmentProgress * segmentProgress * segmentProgress
        : 1 - Math.pow(-2 * segmentProgress + 2, 3) / 2;

      currentX = from.x + (to.x - from.x) * eased;
      currentY = from.y + (to.y - from.y) * eased;

      // Check if clicking at destination
      if (to.click && segmentProgress > 0.9) {
        isClicking = true;
      }
      break;
    } else if (relFrame > to.frame) {
      currentX = to.x;
      currentY = to.y;
    }
  }

  // Handle last keyframe
  const lastKf = keyframes[keyframes.length - 1];
  if (relFrame >= lastKf.frame) {
    currentX = lastKf.x;
    currentY = lastKf.y;
    if (lastKf.click && relFrame - lastKf.frame < 8) {
      isClicking = true;
    }
  }

  // Click pulse animation
  const clickScale = isClicking ? 0.85 : 1;

  // Fade in
  const opacity = interpolate(relFrame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        left: currentX - 4,
        top: currentY - 2,
        zIndex: 9999,
        pointerEvents: "none",
        opacity,
        transform: `scale(${clickScale})`,
        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
      }}
    >
      {/* macOS-style cursor */}
      <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
        <path
          d="M1 1L1 18.5L5.5 14L9.5 22L12.5 20.5L8.5 12.5L14 12.5L1 1Z"
          fill="white"
          stroke="black"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {/* Click ripple */}
      {isClicking && (
        <div
          style={{
            position: "absolute",
            top: -8,
            left: -8,
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "2px solid hsla(172, 66%, 50%, 0.5)",
            animation: "ping 0.3s ease-out",
          }}
        />
      )}
    </div>
  );
};
