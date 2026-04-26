"use client";

import { useEffect, useRef } from "react";

interface VideoPlayerProps {
  mp4Src: string;
  webmSrc: string;
  poster: string;
  className?: string;
  /** Fallback content shown when video can't play */
  fallback?: React.ReactNode;
}

export function VideoPlayer({
  mp4Src,
  webmSrc,
  poster,
  className = "",
  fallback,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // IntersectionObserver: pause when off-screen, play when visible
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {
            // Autoplay blocked - that's fine, poster shows
          });
        } else {
          video.pause();
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        poster={poster}
        preload="metadata"
        className="w-full h-auto rounded-xl"
        style={{ aspectRatio: "16/9" }}
      >
        <source src={webmSrc} type="video/webm" />
        <source src={mp4Src} type="video/mp4" />
      </video>
      {/* No-JS / error fallback */}
      <noscript>
        {fallback}
      </noscript>
    </div>
  );
}
