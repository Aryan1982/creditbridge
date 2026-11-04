import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {Appear, Card, Kicker, Scene, Title} from '../components/ui';
import {theme} from '../theme';

/** Illustrative statement lines in Indian bank narration style. */
const ROWS = [
  {date: '05 Aug', narration: 'UPI/CR/PLATFORM PAYOUT', amount: '+7,140', tag: 'Gig income', color: theme.good},
  {date: '05 Aug', narration: 'NEFT/DR/RENT LANDLORD', amount: '−9,000', tag: 'Rent · on time', color: theme.accent},
  {date: '10 Aug', narration: 'ACH/DR/LIC PREMIUM', amount: '−1,250', tag: 'Insurance', color: theme.accent2},
  {date: '12 Aug', narration: 'UPI/DR/RD SAVINGS A/C', amount: '−2,000', tag: 'Saving', color: theme.good},
];

export const Problem: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reject = spring({frame: frame - 70, fps, config: {damping: 12, stiffness: 160}});
  const scoreFlicker = frame < 50 ? String(300 + ((frame * 37) % 600)) : 'N/A';
  return (
    <Scene duration={duration}>
      <Kicker color={theme.bad}>The thin-file trap</Kicker>
      <Title>No score, no loan. Yet the bank statement<br />already shows how they handle money.</Title>
      <div style={{display: 'flex', gap: 70, marginTop: 60, alignItems: 'stretch'}}>
        <Appear delay={10} style={{flex: 0.8}}>
          <Card style={{position: 'relative', height: '100%'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 42,
                  background: `linear-gradient(135deg, ${theme.brand}, ${theme.accent2})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 40,
                  fontWeight: 800,
                }}
              >
                R
              </div>
              <div>
                <div style={{fontSize: 40, fontWeight: 700}}>Ravi · 27</div>
                <div style={{fontSize: 26, color: theme.muted}}>Delivery partner · first loan</div>
              </div>
            </div>
            <div style={{marginTop: 44, fontFamily: theme.mono, fontSize: 32, color: theme.muted}}>
              Bureau score: <span style={{color: frame < 50 ? theme.text : theme.bad, fontWeight: 700}}>{scoreFlicker}</span>
            </div>
            <div style={{marginTop: 14, fontSize: 26, color: theme.muted}}>No credit card. No past loan.</div>
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
        <div style={{flex: 1.2, display: 'flex', flexDirection: 'column', gap: 16}}>
          <Appear delay={90}>
            <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.muted, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6}}>
              His bank statement
            </div>
          </Appear>
          {ROWS.map((r, i) => (
            <Appear key={r.narration} delay={100 + i * 12} distance={20}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 22,
                  padding: '18px 24px',
                  borderRadius: 14,
                  background: theme.panel,
                  border: `1px solid ${theme.border}`,
                  fontSize: 26,
                }}
              >
                <span style={{fontFamily: theme.mono, color: theme.muted, width: 100}}>{r.date}</span>
                <span style={{fontFamily: theme.mono, flex: 1}}>{r.narration}</span>
                <span style={{fontFamily: theme.mono, width: 120, textAlign: 'right', color: r.amount.startsWith('+') ? theme.good : theme.text}}>{r.amount}</span>
                <span
                  style={{
                    width: 210,
                    textAlign: 'center',
                    fontSize: 22,
                    fontWeight: 600,
                    color: r.color,
                    background: `${r.color}18`,
                    border: `1px solid ${r.color}55`,
                    borderRadius: 999,
                    padding: '6px 0',
                  }}
                >
                  {r.tag}
                </span>
              </div>
            </Appear>
          ))}
          <Appear delay={160}>
            <div style={{fontSize: 30, color: theme.muted, marginTop: 14, lineHeight: 1.4}}>
              Excluded not because they are risky, but because they are <span style={{color: theme.text}}>invisible</span> to bureaus.
            </div>
          </Appear>
        </div>
      </div>
    </Scene>
  );
};
