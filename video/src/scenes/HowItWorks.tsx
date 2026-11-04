import {interpolate, useCurrentFrame} from 'remotion';
import {Appear, Card, Kicker, Scene, Title} from '../components/ui';
import {theme} from '../theme';

type Node = {tag: string; title: string; lines: string[]; color: string};

const NODES: Node[] = [
  {
    tag: 'python',
    title: 'ML pipeline',
    lines: ['German Credit (OpenML credit-g)', 'Thin-file = no prior credits', 'Held-out test evaluation'],
    color: theme.accent2,
  },
  {
    tag: 'models',
    title: 'Scorecard + benchmark',
    lines: ['Logistic-regression scorecard', 'Gradient boosting benchmark', 'AUC · KS · Brier · thin-file AUC'],
    color: theme.accent,
  },
  {
    tag: 'export',
    title: 'model.json',
    lines: ['Coefficients & encodings', 'Metrics & fairness stats', 'No server needed'],
    color: theme.warn,
  },
  {
    tag: 'browser',
    title: 'Web app',
    lines: ['Score + reason codes', 'Counterfactual: what gets you approved', 'Fairness audit'],
    color: theme.good,
  },
];

const STAGGER = 45;

export const HowItWorks: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  return (
    <Scene duration={duration}>
      <Kicker>How it works</Kicker>
      <Title size={68}>From raw applicant data to an explained decision.</Title>
      <div style={{display: 'flex', alignItems: 'stretch', marginTop: 90, gap: 0}}>
        {NODES.map((node, i) => {
          const lineProgress = interpolate(frame, [30 + i * STAGGER + 25, 30 + (i + 1) * STAGGER], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div key={node.tag} style={{display: 'flex', alignItems: 'center', flex: 1}}>
              <Appear delay={30 + i * STAGGER} style={{flex: 1, height: '100%'}}>
                <Card style={{height: '100%', borderTop: `4px solid ${node.color}`, padding: 30}}>
                  <div style={{fontFamily: theme.mono, fontSize: 22, color: node.color, letterSpacing: 3, textTransform: 'uppercase'}}>
                    {String(i + 1).padStart(2, '0')} · {node.tag}
                  </div>
                  <div style={{fontSize: 38, fontWeight: 800, marginTop: 14, marginBottom: 18}}>{node.title}</div>
                  {node.lines.map((l) => (
                    <div key={l} style={{fontSize: 24, color: theme.muted, lineHeight: 1.55}}>
                      {l}
                    </div>
                  ))}
                </Card>
              </Appear>
              {i < NODES.length - 1 ? (
                <div style={{width: 60, display: 'flex', alignItems: 'center'}}>
                  <div
                    style={{
                      height: 4,
                      width: `${lineProgress * 100}%`,
                      background: `linear-gradient(90deg, ${node.color}, ${NODES[i + 1].color})`,
                      borderRadius: 2,
                      boxShadow: `0 0 16px ${node.color}`,
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <Appear delay={240}>
        <div style={{marginTop: 60, fontSize: 34, color: theme.muted, textAlign: 'center'}}>
          Scoring runs <span style={{color: theme.accent, fontWeight: 700}}>100% client-side</span> — the applicant&apos;s data never leaves their browser.
        </div>
      </Appear>
    </Scene>
  );
};
