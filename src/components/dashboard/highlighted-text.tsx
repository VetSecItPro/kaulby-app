"use client";

import { memo, useMemo } from "react";
import { splitTextForHighlighting } from "@/lib/highlight-keywords";
import { cn } from "@/lib/utils";

interface HighlightedTextProps {
  /** The text to display */
  text: string;
  /** Keywords to highlight */
  keywords: string[];
  /** Additional CSS classes for the container */
  className?: string;
  /** CSS classes for highlighted spans */
  highlightClassName?: string;
  /** Maximum number of characters to display (will truncate with ...) */
  maxLength?: number;
  /** Number of lines to clamp to (uses CSS line-clamp) */
  lineClamp?: number;
}

/**
 * Renders text with keyword highlights in yellow (***-style)
 */
export const HighlightedText = memo(function HighlightedText({
  text,
  keywords,
  className,
  highlightClassName,
  maxLength,
  lineClamp,
}: HighlightedTextProps) {
  // Memoize the highlighting calculation
  const parts = useMemo(() => {
    const displayText = maxLength && text.length > maxLength
      ? text.slice(0, maxLength) + "..."
      : text;
    return splitTextForHighlighting(displayText, keywords);
  }, [text, keywords, maxLength]);

  // If no parts or all non-highlighted, render simple text
  if (parts.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const hasHighlights = parts.some((p) => p.isHighlighted);
  if (!hasHighlights) {
    const displayText = maxLength && text.length > maxLength
      ? text.slice(0, maxLength) + "..."
      : text;
    return (
      <span
        className={cn(className, lineClamp && `line-clamp-${lineClamp}`)}
      >
        {displayText}
      </span>
    );
  }

  return (
    <span className={cn(className, lineClamp && `line-clamp-${lineClamp}`)}>
      {parts.map((part, index) =>
        part.isHighlighted ? (
          <mark
            key={index}
            className={cn(
              // ***-style yellow highlight
              "bg-yellow-200 dark:bg-yellow-800/60 px-0.5 rounded-sm",
              // Ensure good contrast in both modes
              "text-foreground",
              highlightClassName
            )}
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </span>
  );
});

interface HighlightedTitleProps {
  /** The title text */
  title: string;
  /** Keywords to highlight */
  keywords: string[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Specifically for result card titles - includes line clamping
 */
export const HighlightedTitle = memo(function HighlightedTitle({
  title,
  keywords,
  className,
}: HighlightedTitleProps) {
  return (
    <HighlightedText
      text={title}
      keywords={keywords}
      className={cn("text-base line-clamp-2", className)}
    />
  );
});

interface HighlightedContentProps {
  /** The content text */
  content: string;
  /** Keywords to highlight */
  keywords: string[];
  /** Number of lines to show (default: 3) */
  lines?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Specifically for result card content - includes line clamping
 */
export const HighlightedContent = memo(function HighlightedContent({
  content,
  keywords,
  lines = 3,
  className,
}: HighlightedContentProps) {
  return (
    <HighlightedText
      text={content}
      keywords={keywords}
      className={cn(`text-sm text-muted-foreground line-clamp-${lines}`, className)}
    />
  );
});
