import React, { useEffect, useRef } from "react";

interface NeonRouletteLightsProps {
  active: boolean;
}

// Un canvas animado de luces brillantes tipo tómbola/ruleta de TV
const NeonRouletteLights: React.FC<NeonRouletteLightsProps> = ({ active }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let running = true;
    let t = 0;
    const W = 520;
    const H = 120;
    canvas.width = W;
    canvas.height = H;
    const lights = 18;
    const radius = 48;
    const cx = W / 2;
    const cy = H / 2 + 10;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      // Fondo radial
      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius * 2.2);
      grad.addColorStop(0, "rgba(255,255,255,0.08)");
      grad.addColorStop(1, "rgba(0,20,60,0.18)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      // Luces
      for (let i = 0; i < lights; i++) {
        const angle = (i / lights) * Math.PI * 2;
        const x = cx + Math.cos(angle) * radius * 1.25;
        const y = cy + Math.sin(angle) * radius * 1.25;
        // Animación de brillo
        const phase = (t / 12 + i / lights) % 1;
        const glow = 0.7 + 0.5 * Math.sin(phase * Math.PI * 2);
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 13 + 7 * glow, 0, Math.PI * 2);
        ctx.shadowColor = `rgba(255,255,180,${0.45 + 0.35 * glow})`;
        ctx.shadowBlur = 24 + 24 * glow;
        ctx.globalAlpha = 0.45 + 0.45 * glow;
        ctx.fillStyle = `hsl(${40 + 320 * (i / lights)},100%,${
          70 + 20 * glow
        }%)`;
        ctx.fill();
        ctx.restore();
        // Luz central
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, 6 + 2 * glow, 0, Math.PI * 2);
        ctx.globalAlpha = 0.7 + 0.3 * glow;
        ctx.fillStyle = "#fffbe7";
        ctx.shadowColor = "#fffbe7";
        ctx.shadowBlur = 12 + 8 * glow;
        ctx.fill();
        ctx.restore();
      }
    }
    function loop() {
      if (!running) return;
      t += 1;
      draw();
      animationRef.current = requestAnimationFrame(loop);
    }
    if (active) {
      running = true;
      loop();
    }
    return () => {
      running = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: 120,
        display: active ? "block" : "none",
        pointerEvents: "none",
        position: "absolute",
        left: 0,
        right: 0,
        top: -60,
        margin: "0 auto",
        zIndex: 8,
        filter: "drop-shadow(0 0 32px #fffbe7) blur(0.5px)",
        opacity: 0.92,
      }}
      width={520}
      height={120}
      aria-hidden="true"
    />
  );
};

export default NeonRouletteLights;
