import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Appear, Card, Kicker, Scene, Title} from '../components/ui';
import {theme} from '../theme';

const FACTS = [
  {label: 'Pays rent on time', ok: true},
  {label: 'Steady gig income', ok: true},
  {label: 'Prior loans', ok: false},
  {label: 'Credit cards', ok: false},
];

const LOOP = ['No credit history', 'No bureau score', 'Loan rejected'];

export const Problem: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reject = spring({frame: frame - 150, fps, config: {damping: 12, stiffness: 160}});
  const scoreFlicker = frame < 110 ? String(300 + ((frame * 37) % 600)) : 'N/A';
  return (
    <Scene duration={duration}>
      <Kicker color={theme.bad}>The thin-file trap</Kicker>
      <Title>Bureau scores need credit history.<br />Millions have none.</Title>
      <div style={{display: 'flex', gap: 80, marginTop: 70, alignItems: 'stretch'}}>
        <Appear delay={20} style={{flex: 1}}>
          <Card style={{position: 'relative', height: '100%'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 42,
                  background: `linear-gradient(135deg, ${theme.accent2}, ${theme.accent})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 40,
                  fontWeight: 800,
                  color: theme.bg,
                }}
              >
                P
              </div>
              <div>
                <div style={{fontSize: 40, fontWeight: 700}}>Applicant · 27</div>
                <div style={{fontSize: 26, color: theme.muted}}>Delivery partner · first-time borrower</div>
              </div>
            </div>
            <div style={{marginTop: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18}}>
              {FACTS.map((f, i) => (
                <Appear key={f.label} delay={40 + i * 10} distance={14}>
                  <div style={{fontSize: 28, color: f.ok ? theme.text : theme.muted}}>
                    <span style={{color: f.ok ? theme.good : theme.bad, marginRight: 12}}>{f.ok ? '✓' : '✕'}</span>
                    {f.label}
                  </div>
                </Appear>
              ))}
            </div>
            <div style={{marginTop: 34, fontFamily: theme.mono, fontSize: 30, color: theme.muted}}>
              Bureau score: <span style={{color: frame < 110 ? theme.text : theme.bad, fontWeight: 700}}>{scoreFlicker}</span>
            </div>
            <div
              style={{
                position: 'absolute',
                right: 40,
                bottom: 40,
                opacity: reject,
                transform: `scale(${interpolate(reject, [0, 1], [1.8, 1])}) rotate(-8deg)`,
                fontSize: 54,
                fontWeight: 900,
                color: theme.bad,
                border: `6px solid ${theme.bad}`,
                borderRadius: 14,
                padding: '4px 26px',
                letterSpacing: 3,
              }}
            >
              REJECTED
            </div>
          </Card>
        </Appear>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28}}>
          {LOOP.map((step, i) => (
            <Appear key={step} delay={70 + i * 25}>
              <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
                <div
                  style={{
                    fontFamily: theme.mono,
                    fontSize: 28,
                    color: theme.bad,
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    border: `2px solid ${theme.bad}66`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {i + 1}
                </div>
                <div style={{fontSize: 44, fontWeight: 700}}>{step}</div>
              </div>
            </Appear>
          ))}
          <Appear delay={170}>
            <div style={{fontSize: 32, color: theme.muted, marginTop: 20, lineHeight: 1.4}}>
              Creditworthy people are excluded — not because they are risky, but because they are <span style={{color: theme.text}}>invisible</span>.
            </div>
          </Appear>
        </div>
      </div>
    </Scene>
  );
};
