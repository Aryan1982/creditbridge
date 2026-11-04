import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {Appear, Card, Kicker, Pill, Scene, Title} from '../components/ui';
import {theme} from '../theme';

const STAGES = [
  {title: 'Parse', lines: ['PDF · CSV', 'AA JSON'], color: theme.muted},
  {title: 'Verify', lines: ['Balance continuity', 'PDF metadata', 'Round-tripping'], color: theme.warn},
  {title: 'Categorise', lines: ['ML on narrations', 'TF-IDF n-grams', '+ logistic'], color: theme.accent2},
  {title: 'Cash flow', lines: ['Income regularity', 'Bills · bounces', 'Buffers · EMIs'], color: theme.accent},
  {title: 'Score', lines: ['Scorecard', '300–900 + reasons'], color: theme.accent},
  {title: 'Afford', lines: ['FOIR cap', '→ safe EMI'], color: theme.good},
  {title: 'Explain', lines: ['Steps to improve', 'EN · हिंदी · తెలుగు'], color: theme.good},
];

const START = 20;
const STEP = 16;

export const Pipeline: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const travel = interpolate(frame, [START + 10, START + STEP * STAGES.length + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  return (
    <Scene duration={duration}>
      <Kicker>How it works</Kicker>
      <Title size={68}>From raw statement to an explained decision.</Title>
      <div style={{position: 'relative', marginTop: 80}}>
        <div style={{position: 'absolute', left: 40, right: 40, top: 37, height: 4, borderRadius: 2, background: 'rgba(148,163,184,0.15)'}} />
        <div
          style={{
            position: 'absolute',
            left: 40,
            top: 37,
            height: 4,
            width: `calc(${travel} * (100% - 80px))`,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${theme.warn}, ${theme.accent2}, ${theme.accent}, ${theme.good})`,
            boxShadow: `0 0 18px ${theme.accent}`,
          }}
        />
        <div style={{display: 'flex', gap: 16, position: 'relative'}}>
          {STAGES.map((s, i) => {
            const lit = travel * (STAGES.length - 1) >= i - 0.05;
            return (
              <Appear key={s.title} delay={START + i * STEP} style={{flex: 1}}>
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                  <div
                    style={{
                      width: 78,
                      height: 78,
                      borderRadius: 39,
                      background: lit ? s.color : theme.panelHi,
                      border: `2px solid ${s.color}`,
                      color: lit ? theme.bg : s.color,
                      fontFamily: theme.mono,
                      fontSize: 30,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: lit ? `0 0 30px ${s.color}88` : 'none',
                    }}
                  >
                    {i + 1}
                  </div>
                  <Card style={{marginTop: 28, padding: '24px 14px', width: '100%', minHeight: 200, borderTop: `4px solid ${s.color}`}}>
                    <div style={{fontSize: 34, fontWeight: 800, marginBottom: 14}}>{s.title}</div>
                    {s.lines.map((l) => (
                      <div key={l} style={{fontSize: 21, color: theme.muted, lineHeight: 1.5, whiteSpace: 'nowrap'}}>
                        {l}
                      </div>
                    ))}
                  </Card>
                </div>
              </Appear>
            );
          })}
        </div>
      </div>
      <Appear delay={START + STEP * STAGES.length + 25}>
        <div style={{display: 'flex', gap: 20, justifyContent: 'center', marginTop: 60}}>
          <Pill color={theme.text}>Python engine · FastAPI</Pill>
          <Pill>Every number traceable to transactions</Pill>
          <Pill color={theme.good}>Read in memory · nothing stored</Pill>
        </div>
      </Appear>
    </Scene>
  );
};
