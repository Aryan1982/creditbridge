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

/** The app's logo (components/logo.tsx): indigo tile with a bridge arc that draws itself. */
export const LogoMark: React.FC<{size?: number; delay?: number}> = ({size = 120, delay = 0}) => {
  const frame = useCurrentFrame();
  const pop = useEnter(delay, 14);
  const arc = interpolate(frame - delay, [8, 36], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const deck = interpolate(frame - delay, [26, 44], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" style={{transform: `scale(${0.6 + 0.4 * pop})`, opacity: pop, overflow: 'visible'}}>
      <rect width="22" height="22" rx="6" fill={theme.brand} />
      <path
        d="M5 15.5C5 11.36 7.69 8 11 8s6 3.36 6 7.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - arc}
      />
      <path d="M4 15.5h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - deck} />
    </svg>
  );
};
