import {interpolate, useCurrentFrame} from 'remotion';
import {Appear, LogoMark, Pill, Scene} from '../components/ui';
import {theme} from '../theme';

export const Solution: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const glow = interpolate(frame, [0, 40, 90], [0, 1, 0.6], {extrapolateRight: 'clamp'});
  return (
    <Scene duration={duration} style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
      <LogoMark size={150} delay={2} />
      <Appear delay={14}>
        <div
          style={{
            fontSize: 150,
            fontWeight: 900,
            letterSpacing: -5,
            marginTop: 30,
            textShadow: `0 0 ${60 * glow}px rgba(123,143,250,0.4)`,
          }}
        >
          Credit<span style={{color: theme.accent}}>Bridge</span>
        </div>
      </Appear>
      <Appear delay={28}>
        <div style={{fontSize: 52, color: theme.muted, marginTop: 6}}>
          <span style={{color: theme.text}}>Cash-flow underwriting</span> for people with no credit score
        </div>
      </Appear>
      <Appear delay={46}>
        <div style={{display: 'flex', gap: 22, marginTop: 56, justifyContent: 'center'}}>
          <Pill>Bank statement · PDF or CSV</Pill>
          <Pill color={theme.accent2}>RBI Account Aggregator</Pill>
          <Pill color={theme.good}>Explained decision in seconds</Pill>
        </div>
      </Appear>
    </Scene>
  );
};
