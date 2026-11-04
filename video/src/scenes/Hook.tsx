import {interpolate, spring, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import {Appear, Scene} from '../components/ui';
import {theme} from '../theme';

export const Hook: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const count = interpolate(frame, [10, 70], [0, 190], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const stamp = spring({frame: frame - 120, fps, config: {damping: 12, stiffness: 180}});
  const stampScale = interpolate(stamp, [0, 1], [2.2, 1]);
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
      <Appear delay={45}>
        <div style={{fontSize: 72, fontWeight: 700, marginTop: 20}}>Indian adults have no credit score.</div>
      </Appear>
      <div
        style={{
          marginTop: 70,
          opacity: stamp,
          transform: `scale(${stampScale}) rotate(-4deg)`,
          fontSize: 96,
          fontWeight: 900,
          color: theme.bad,
          border: `8px solid ${theme.bad}`,
          borderRadius: 20,
          padding: '10px 50px',
          letterSpacing: 4,
          textTransform: 'uppercase',
        }}
      >
        Banks say no.
      </div>
    </Scene>
  );
};
