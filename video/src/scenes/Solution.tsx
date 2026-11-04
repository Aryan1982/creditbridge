import {interpolate, useCurrentFrame} from 'remotion';
import {Appear, BridgeMark, Pill, Scene} from '../components/ui';
import {theme} from '../theme';

export const Solution: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const glow = interpolate(frame, [0, 60, 120], [0, 1, 0.6], {extrapolateRight: 'clamp'});
  return (
    <Scene duration={duration} style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
      <BridgeMark size={360} delay={5} />
      <Appear delay={25}>
        <div
          style={{
            fontSize: 150,
            fontWeight: 900,
            letterSpacing: -5,
            marginTop: 10,
            textShadow: `0 0 ${60 * glow}px rgba(45,212,191,0.35)`,
          }}
        >
          Credit<span style={{color: theme.accent}}>Bridge</span>
        </div>
      </Appear>
      <Appear delay={50}>
        <div style={{fontSize: 52, color: theme.muted, marginTop: 10}}>
          Explainable <span style={{color: theme.text}}>alternative-data</span> credit scoring
        </div>
      </Appear>
      <Appear delay={75}>
        <div style={{fontSize: 34, color: theme.muted, marginTop: 24, maxWidth: 1300, lineHeight: 1.4}}>
          Scores applicants on who they are today — job stability, savings, housing, purpose — not just on a credit history they never had.
        </div>
      </Appear>
      <Appear delay={110}>
        <div style={{display: 'flex', gap: 24, marginTop: 56, justifyContent: 'center'}}>
          <Pill>Track HI-04 · Alternative Credit Scoring</Pill>
          <Pill color={theme.accent2}>Neural Storm 2026</Pill>
        </div>
      </Appear>
    </Scene>
  );
};
