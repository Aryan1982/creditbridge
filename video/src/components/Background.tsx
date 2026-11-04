import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';

/** Dark fintech backdrop: drifting glows + faint grid. Spans the whole video. */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const t = frame / durationInFrames;
  const x1 = interpolate(t, [0, 1], [18, 32]);
  const x2 = interpolate(t, [0, 1], [85, 70]);
  const gridShift = (frame * 0.4) % 80;
  return (
    <AbsoluteFill style={{backgroundColor: theme.bg}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 600px at ${x1}% 20%, rgba(51,80,214,0.22), transparent 60%),
            radial-gradient(1000px 700px at ${x2}% 85%, rgba(45,212,191,0.10), transparent 60%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          backgroundPosition: `${gridShift}px ${gridShift}px`,
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        }}
      />
    </AbsoluteFill>
  );
};
