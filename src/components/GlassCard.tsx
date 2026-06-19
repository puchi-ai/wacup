import React, { useRef, useState } from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  id?: string;
  glowColor?: 'blue' | 'emerald' | 'crimson' | 'amber' | 'default';
  interactive?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  id,
  glowColor = 'default',
  interactive = false,
  className = '',
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const glowColorMap = {
    default: 'rgba(255, 255, 255, 0.08)',
    blue: 'rgba(6, 182, 212, 0.15)', // cyan-like glow for primary color
    emerald: 'rgba(16, 185, 129, 0.15)', // emerald/green glow
    crimson: 'rgba(239, 68, 68, 0.15)', // red/loss glow
    amber: 'rgba(245, 158, 11, 0.15)', // yellow/draw glow
  };

  const activeGlowColor = glowColorMap[glowColor];

  return (
    <div
      ref={cardRef}
      id={id}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative overflow-hidden
        bg-[#090d16]/60 backdrop-blur-2xl
        border border-white/10 rounded-2xl md:rounded-3xl
        shadow-xl shadow-black/40
        ${interactive ? 'hover:border-white/20 hover:bg-white/[0.04] hover:scale-[1.01] hover:shadow-cyan-950/20 hover:shadow-2xl cursor-pointer' : ''}
        transition-all duration-300 ease-out
        ${className}
      `}
      {...props}
    >
      {/* Spotlight highlight inside card on mouse hover */}
      {interactive && isHovered && (
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl md:rounded-3xl opacity-100 transition-opacity duration-300 z-0"
          style={{
            background: `radial-gradient(220px circle at ${coords.x}px ${coords.y}px, ${activeGlowColor}, transparent 80%)`,
          }}
        />
      )}

      {/* Subtle static ambient glow background */}
      <div 
        className="absolute inset-0 -z-10 pointer-events-none opacity-40"
        style={{
          background: `radial-gradient(320px circle at 50% 50%, ${activeGlowColor}, transparent 90%)`,
        }}
      />

      {/* Top light reflections (Liquid effect) */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none z-10" />
      
      {children}
    </div>
  );
};
