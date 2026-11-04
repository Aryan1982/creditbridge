import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Appear, Scene} from '../components/ui';
import {theme} from '../theme';

export const Hook: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const count = interpolate(frame, [8, 60], [0, 190], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const stamp = spring({frame: frame - 95, fps, config: {damping: 12, stiffness: 180}});
  return (
    <Scene duration={duration} style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
      <div
        style={{
          fontSize: 300,
          fontWeight: 900,
          letterSpacing: -10,
          lineHeight: 1,
          background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent2})`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {Math.round(count)}M
      </div>
      <Appear delay={36}>
        <div style={{fontSize: 72, fontWeight: 700, marginTop: 20}}>Indian adults are credit-invisible.</div>
      </Appear>
      <Appear delay={56}>
        <div style={{fontSize: 38, color: theme.muted, marginTop: 18}}>No loan history, so no bureau score.</div>
      </Appear>
      <div
        style={{
          marginTop: 60,
          opacity: stamp,
          transform: `scale(${interpolate(stamp, [0, 1], [2.2, 1])}) rotate(-4deg)`,
          fontSize: 88,
          fontWeight: 900,
          color: theme.bad,
          border: `8px solid ${theme.bad}`,
          borderRadius: 20,
          padding: '8px 46px',
          letterSpacing: 4,
          textTransform: 'uppercase',
        }}
      >
        Banks say no.
      </div>
    </Scene>
  );
};
