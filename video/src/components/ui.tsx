import type {CSSProperties, ReactNode} from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';

/** Fades the whole scene in at start and out at end. */
export const Scene: React.FC<{duration: number; children: ReactNode; style?: CSSProperties}> = ({duration, children, style}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12, duration - 12, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill
      style={{
        opacity,
        fontFamily: theme.font,
        color: theme.text,
        padding: '110px 140px',
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Spring progress 0→1 starting at `delay` frames. */
export const useEnter = (delay = 0, damping = 200): number => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - delay, fps, config: {damping}});
};

/** Fade + slide-up entrance. */
export const Appear: React.FC<{delay?: number; children: ReactNode; style?: CSSProperties; distance?: number}> = ({
  delay = 0,
  children,
  style,
  distance = 30,
}) => {
  const p = useEnter(delay);
  return (
    <div style={{opacity: p, transform: `translateY(${(1 - p) * distance}px)`, ...style}}>{children}</div>
  );
};

export const Kicker: React.FC<{children: ReactNode; color?: string}> = ({children, color = theme.accent}) => (
  <div
    style={{
      fontFamily: theme.mono,
      fontSize: 26,
      letterSpacing: 6,
      textTransform: 'uppercase',
      color,
      marginBottom: 24,
    }}
  >
    {children}
  </div>
);

export const Title: React.FC<{children: ReactNode; size?: number; style?: CSSProperties}> = ({children, size = 76, style}) => (
  <div style={{fontSize: size, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5, ...style}}>{children}</div>
);

export const Card: React.FC<{children: ReactNode; style?: CSSProperties}> = ({children, style}) => (
  <div
    style={{
      background: `linear-gradient(180deg, ${theme.panelHi}, ${theme.panel})`,
      border: `1px solid ${theme.border}`,
      borderRadius: 24,
      padding: 36,
      boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
      ...style,
    }}
  >
    {children}
  </div>
);

export const Pill: React.FC<{children: ReactNode; color?: string; style?: CSSProperties}> = ({children, color = theme.accent, style}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 26px',
      borderRadius: 999,
      border: `1px solid ${color}55`,
      background: `${color}18`,
      color,
      fontSize: 28,
      fontWeight: 600,
      ...style,
    }}
  >
    {children}
  </div>
);

/** CreditBridge mark: a bridge arc that draws itself. */
export const BridgeMark: React.FC<{size?: number; delay?: number}> = ({size = 120, delay = 0}) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame - delay, [0, 35], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const arcLen = 260;
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 200 120">
      <defs>
        <linearGradient id="cbGrad" x1="0" x2="1">
          <stop offset="0%" stopColor={theme.accent} />
          <stop offset="100%" stopColor={theme.accent2} />
        </linearGradient>
      </defs>
      <path
        d="M10 100 Q100 -20 190 100"
        fill="none"
        stroke="url(#cbGrad)"
        strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray={arcLen}
        strokeDashoffset={arcLen * (1 - draw)}
      />
      <line x1={4} x2={196} y1={104} y2={104} stroke={theme.text} strokeOpacity={0.6 * draw} strokeWidth={6} strokeLinecap="round" />
      {[50, 80, 100, 120, 150].map((x, i) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1={104}
          y2={x === 100 ? 40 : x === 80 || x === 120 ? 46 : 62}
          stroke={theme.text}
          strokeOpacity={0.35 * interpolate(draw, [0.4 + i * 0.1, 0.6 + i * 0.1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
          strokeWidth={4}
        />
      ))}
    </svg>
  );
};
