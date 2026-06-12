import type { CSSProperties } from "react";

const PARTICLES = [
  { left: "6%", top: "14%", size: "220px", delay: "0s", duration: "24s" },
  { left: "18%", top: "72%", size: "180px", delay: "3s", duration: "28s" },
  { left: "38%", top: "18%", size: "260px", delay: "5s", duration: "34s" },
  { left: "56%", top: "64%", size: "200px", delay: "2s", duration: "30s" },
  { left: "72%", top: "24%", size: "240px", delay: "7s", duration: "26s" },
  { left: "88%", top: "76%", size: "170px", delay: "1s", duration: "32s" },
];

export default function BackgroundParticles() {
  return (
    <div className="bf-particles" aria-hidden="true">
      {PARTICLES.map((particle) => (
        <span
          key={`${particle.left}-${particle.top}`}
          className="bf-particle"
          style={
            {
              "--particle-left": particle.left,
              "--particle-top": particle.top,
              "--particle-size": particle.size,
              "--particle-delay": particle.delay,
              "--particle-duration": particle.duration,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
