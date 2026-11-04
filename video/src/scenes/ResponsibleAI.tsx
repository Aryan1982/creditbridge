import {Appear, Card, Kicker, Scene, Title} from '../components/ui';
import type {Metrics} from '../metrics';
import {theme} from '../theme';

export const ResponsibleAI: React.FC<{duration: number; metrics: Metrics}> = ({duration, metrics}) => {
  const {fairness, limitations} = metrics;
  const pillars = [
    {
      icon: '⚖',
      title: 'Gender is not an input',
      body: fairness
        ? `Simulated only to audit outcomes: approval ${Math.round(fairness.female * 100)}% for women vs ${Math.round(fairness.male * 100)}% for men.`
        : 'Simulated only to audit outcomes; approval rates are compared by gender and persona.',
      color: theme.accent,
    },
    {
      icon: '⛨',
      title: 'Authenticity checks',
      body: 'Balance continuity, PDF edit metadata and round-tripped funds are checked before any score is trusted.',
      color: theme.warn,
    },
    {
      icon: '∅',
      title: 'Data not stored',
      body: 'Statements are read in memory to produce the result. Account Aggregator access is consent-based and one-time.',
      color: theme.good,
    },
    {
      icon: '◎',
      title: 'Explainable by design',
      body: 'A sign-constrained scorecard: every decision comes with reason codes and concrete steps to improve.',
      color: theme.accent2,
    },
  ];
  return (
    <Scene duration={duration} style={{padding: '90px 140px'}}>
      <Kicker>Responsible AI</Kicker>
      <Title size={64}>Inclusion only works if it&apos;s trustworthy.</Title>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginTop: 50}}>
        {pillars.map((p, i) => (
          <Appear key={p.title} delay={18 + i * 16}>
            <Card style={{display: 'flex', gap: 28, alignItems: 'flex-start', padding: 34, height: '100%'}}>
              <div
                style={{
                  width: 76,
                  height: 76,
                  flexShrink: 0,
                  borderRadius: 20,
                  background: `${p.color}1f`,
                  border: `1px solid ${p.color}66`,
                  color: p.color,
                  fontSize: 40,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {p.icon}
              </div>
              <div>
                <div style={{fontSize: 38, fontWeight: 800}}>{p.title}</div>
                <div style={{fontSize: 27, color: theme.muted, marginTop: 8, lineHeight: 1.4}}>{p.body}</div>
              </div>
            </Card>
          </Appear>
        ))}
      </div>
      <Appear delay={95}>
        <div
          style={{
            marginTop: 28,
            padding: '24px 32px',
            borderRadius: 20,
            border: `1px solid ${theme.warn}66`,
            background: `${theme.warn}14`,
            display: 'flex',
            gap: 24,
            alignItems: 'center',
          }}
        >
          <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.warn, letterSpacing: 3, textTransform: 'uppercase', flexShrink: 0}}>Limitation</div>
          <div style={{fontSize: 28, lineHeight: 1.4}}>{limitations[0] ?? 'The risk model is trained on simulated statements.'}</div>
        </div>
      </Appear>
    </Scene>
  );
};
