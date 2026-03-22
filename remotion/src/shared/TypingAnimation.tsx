import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "./colors";

export const TypingAnimation: React.FC<{
  text: string;
  startFrame: number;
  charsPerFrame?: number;
  fontSize?: number;
  color?: string;
  showCursor?: boolean;
}> = ({
  text,
  startFrame,
  charsPerFrame = 0.8,
  fontSize = 14,
  color = colors.foreground,
  showCursor = true,
}) => {
  const frame = useCurrentFrame();

  const elapsed = Math.max(0, frame - startFrame);
  const charsToShow = Math.min(Math.floor(elapsed * charsPerFrame), text.length);
  const visibleText = text.slice(0, charsToShow);
  const isTyping = charsToShow < text.length && frame >= startFrame;

  // Blinking cursor
  const cursorVisible = isTyping || (frame - startFrame < 15 && Math.floor(frame / 8) % 2 === 0);

  return (
    <span style={{ fontSize, color, fontFamily: "system-ui, sans-serif" }}>
      {visibleText}
      {showCursor && cursorVisible && (
        <span
          style={{
            display: "inline-block",
            width: 2,
            height: fontSize * 1.1,
            backgroundColor: colors.primary,
            marginLeft: 1,
            verticalAlign: "text-bottom",
          }}
        />
      )}
    </span>
  );
};
