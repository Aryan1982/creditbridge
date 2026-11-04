import {Appear, Card, Kicker, Scene, Title} from '../components/ui';
import {theme} from '../theme';

const PILLARS = [
  {
    icon: '◎',
    title: 'Explainable',
    body: 'Every score ships with per-feature reason codes and a counterfactual path to approval.',
    color: theme.accent,
  },
  {
    icon: '⚖',
    title: 'Fairness audit',
    body: 'Approval-rate parity checked across age and sex groups, shown in-app.',
    color: theme.accent2,
  },
  {
    icon: '⛨',
    title: 'No PII stored',
    body: 'Scoring runs in the browser. No accounts, no uploads, nothing persisted.',
    color: theme.good,
  },
  {
    icon: '!',
    title: 'Honest disclaimer',
    body: 'Research prototype on public benchmark data — decision support, not a lending decision.',
    color: theme.warn,
  },
];

export const ResponsibleAI: React.FC<{duration: number}> = ({duration}) => (
  <Scene duration={duration}>
    <Kicker>Responsible AI</Kicker>
    <Title size={68}>Inclusion only works if it&apos;s trustworthy.</Title>
    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36, marginTop: 70}}>
      {PILLARS.map((p, i) => (
        <Appear key={p.title} delay={25 + i * 22}>
          <Card style={{display: 'flex', gap: 30, alignItems: 'flex-start', padding: 40}}>
            <div
              style={{
                width: 84,
                height: 84,
                flexShrink: 0,
                borderRadius: 22,
                background: `${p.color}1f`,
                border: `1px solid ${p.color}66`,
                color: p.color,
                fontSize: 44,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {p.icon}
            </div>
            <div>
              <div style={{fontSize: 42, fontWeight: 800}}>{p.title}</div>
              <div style={{fontSize: 28, color: theme.muted, marginTop: 10, lineHeight: 1.45}}>{p.body}</div>
            </div>
          </Card>
        </Appear>
      ))}
    </div>
  </Scene>
);
