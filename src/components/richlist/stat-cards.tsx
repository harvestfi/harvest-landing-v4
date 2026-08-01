"use client";

// The three concentration figures on /xrp-rich-list.
//
// Built on the animated-card design: a rounded card with a coloured top rule,
// a resting shadow that deepens on hover, and a 3D tilt that follows the
// pointer with the content lifted off the surface on its own Z plane.
//
// Written without framer-motion. The reference drives rotateX/rotateY through
// useMotionValue and useSpring, which is a dependency this project does not
// carry for anything else; the same motion is two CSS custom properties and a
// transition, and the spring's overshoot is not something a static figure
// benefits from anyway.
//
// The tilt is pointer-only. It is switched off for coarse pointers, where
// there is no hover to drive it, and for anyone who asks for reduced motion.

import { useRef, useState } from "react";

export interface Stat {
  value: string;
  label: string;
}

export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="rl-stats">
      {stats.map((s) => (
        <StatCard key={s.label} {...s} />
      ))}
    </div>
  );
}

function StatCard({ value, label }: Stat) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<{ x: number; y: number } | null>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Pointer-driven tilt only makes sense where a pointer hovers. A touch
    // would fire this on tap and leave the card stuck at an angle.
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const dx = e.clientX - left - width / 2;
    const dy = e.clientY - top - height / 2;
    // Same mapping as the reference: half the card's span maps to 10 degrees,
    // and the Y axis is inverted so the card leans toward the cursor.
    setTilt({
      x: (-dy / (height / 2)) * 6,
      y: (dx / (width / 2)) * 6,
    });
  };

  return (
    <div
      ref={ref}
      className="rl-stat"
      onPointerMove={onMove}
      onPointerLeave={() => setTilt(null)}
      style={
        tilt
          ? ({
              "--rl-tilt-x": `${tilt.x}deg`,
              "--rl-tilt-y": `${tilt.y}deg`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className="rl-stat-inner">
        <span className="rl-stat-num">{value}</span>
        <span className="rl-stat-lab">{label}</span>
      </div>
    </div>
  );
}
