'use client';

import { useEffect, useRef } from 'react';

export const Starfield = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const isVisibleRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars: { x: number; y: number; z: number }[] = [];
    const numStars = 500;

    const setup = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = [];
      for (let i = 0; i < numStars; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          z: Math.random() * canvas.width,
        });
      }
    };

    const draw = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();

      for (let i = 0; i < numStars; i++) {
        const star = stars[i];
        
        star.z -= 0.7; // Speed of stars

        if (star.z <= 0) {
          star.z = canvas.width;
          star.x = Math.random() * canvas.width;
          star.y = Math.random() * canvas.height;
        }

        const x = (star.x - canvas.width / 2) * (canvas.width / star.z) + canvas.width / 2;
        const y = (star.y - canvas.height / 2) * (canvas.width / star.z) + canvas.height / 2;
        const r = Math.max(0.1, 2.5 * (1 - star.z / canvas.width));

        ctx.moveTo(x, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    };

    const animate = () => {
      if (!isVisibleRef.current) return;
      draw();
      animationFrameIdRef.current = window.requestAnimationFrame(animate);
    };

    const handleResize = () => {
      if (animationFrameIdRef.current) {
        window.cancelAnimationFrame(animationFrameIdRef.current);
      }
      setup();
      if (isVisibleRef.current) {
        animate();
      }
    };

    // Intersection Observer setup
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            isVisibleRef.current = true;
            // Restart animation if not already running
            // We cancel first to be safe and avoid double-loops
            if (animationFrameIdRef.current) {
              window.cancelAnimationFrame(animationFrameIdRef.current);
            }
            animate();
          } else {
            isVisibleRef.current = false;
            if (animationFrameIdRef.current) {
              window.cancelAnimationFrame(animationFrameIdRef.current);
            }
          }
        });
      },
      { threshold: 0 }
    );

    observer.observe(canvas);

    setup();
    // Don't auto-start animate here, rely on observer to trigger it when visible
    // (It will likely be visible immediately)
    
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        window.cancelAnimationFrame(animationFrameIdRef.current);
      }
      observer.disconnect();
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0">
      <canvas
        ref={canvasRef}
        className="w-full h-full opacity-30 mix-blend-screen"
      />
    </div>
  );
};