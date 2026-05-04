import { useEffect, useRef } from "react";

export function NeuralNet({ isThinking = false }: { isThinking?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const nodes = [
      // Layer 1
      { x: 20, y: 20, layer: 0 }, { x: 20, y: 50, layer: 0 }, { x: 20, y: 80, layer: 0 },
      // Layer 2
      { x: 60, y: 10, layer: 1 }, { x: 60, y: 40, layer: 1 }, { x: 60, y: 70, layer: 1 }, { x: 60, y: 100, layer: 1 },
      // Layer 3
      { x: 100, y: 30, layer: 2 }, { x: 100, y: 60, layer: 2 }, { x: 100, y: 90, layer: 2 },
      // Layer 4
      { x: 140, y: 50, layer: 3 }, { x: 140, y: 80, layer: 3 }
    ];

    const connections: { from: number; to: number; activeOffset: number }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        if (nodes[j].layer === nodes[i].layer + 1) {
          connections.push({ from: i, to: j, activeOffset: Math.random() * 100 });
        }
      }
    }

    const draw = () => {
      time += 0.05;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections
      connections.forEach(conn => {
        const from = nodes[conn.from];
        const to = nodes[conn.to];
        
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        
        let isActive = false;
        if (isThinking) {
          isActive = Math.sin(time + conn.activeOffset) > 0.8;
        }
        
        ctx.strokeStyle = isActive ? "rgba(0, 212, 255, 0.6)" : "rgba(255, 255, 255, 0.1)";
        ctx.lineWidth = isActive ? 1.5 : 1;
        ctx.stroke();
      });

      // Draw nodes
      nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
        
        let glow = 0;
        if (isThinking) {
          glow = (Math.sin(time * 2 + node.x + node.y) + 1) / 2;
        }
        
        ctx.fillStyle = isThinking ? `rgba(0, 212, 255, ${0.5 + glow * 0.5})` : "rgba(0, 212, 255, 0.5)";
        
        if (isThinking && glow > 0.8) {
          ctx.shadowColor = "rgba(0, 212, 255, 0.8)";
          ctx.shadowBlur = 10;
        } else {
          ctx.shadowBlur = 0;
        }
        
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationFrameId);
  }, [isThinking]);

  return (
    <canvas 
      ref={canvasRef} 
      width={160} 
      height={120} 
      className="opacity-50 pointer-events-none"
    />
  );
}
