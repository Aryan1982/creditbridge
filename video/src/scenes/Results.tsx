import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {Appear, Card, Kicker, Pill, Scene, Title} from '../components/ui';
import type {Metrics, MetricsSource} from '../metrics';
import {theme} from '../theme';

type CardSpec = {label: string; value: number; hint: string; better: 'higher' | 'lower'; color: string; bar: number};

const MetricCard: React.FC<{spec: CardSpec; delay: number}> = ({spec, delay}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [delay, delay + 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <Appear delay={delay} style={{flex: 1}}>
      <Card style={{padding: 40}}>
        <div style={{fontFamily: theme.mono, fontSize: 24, color: theme.muted, letterSpacing: 3, textTransform: 'uppercase'}}>
          {spec.label}
        </div>
        <div style={{fontSize: 110, fontWeight: 900, color: spec.color, fontVariantNumeric: 'tabular-nums', marginTop: 10}}>
          {(spec.value * t).toFixed(3)}
        </div>
        <div style={{height: 10, borderRadius: 5, background: 'rgba(148,163,184,0.15)', marginTop: 16, overflow: 'hidden'}}>
          <div style={{height: '100%', width: `${Math.max(0, Math.min(1, spec.bar)) * t * 100}%`, background: spec.color, borderRadius: 5}} />
        </div>
        <div style={{fontSize: 24, color: theme.muted, marginTop: 18}}>
          {spec.hint} · <span style={{color: theme.text}}>{spec.better} is better</span>
        </div>
      </Card>
    </Appear>
  );
};

export const Results: React.FC<{duration: number; metrics: Metrics; metricsSource: MetricsSource}> = ({
  duration,
  metrics,
  metricsSource,
}) => {
  const cards: CardSpec[] = [
    {label: 'ROC-AUC', value: metrics.rocAuc, hint: 'Ranking power, test set', better: 'higher', color: theme.accent, bar: metrics.rocAuc},
    {label: 'KS statistic', value: metrics.ks, hint: 'Good/bad separation', better: 'higher', color: theme.accent2, bar: metrics.ks},
    {label: 'Brier score', value: metrics.brier, hint: 'Probability calibration', better: 'lower', color: theme.warn, bar: 1 - metrics.brier},
    {label: 'Thin-file AUC', value: metrics.thinFileAuc, hint: 'No prior credits only', better: 'higher', color: theme.good, bar: metrics.thinFileAuc},
  ];
  return (
    <Scene duration={duration}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div>
          <Kicker>Results · logistic scorecard</Kicker>
          <Title size={68}>Accurate — and it works for thin files.</Title>
        </div>
        {metricsSource === 'placeholder' ? (
          <Pill color={theme.warn} style={{fontSize: 22}}>Placeholder values — run training to populate</Pill>
        ) : (
          <Pill style={{fontSize: 22}}>Live from model.json</Pill>
        )}
      </div>
      <div style={{display: 'flex', gap: 36, marginTop: 80}}>
        {cards.map((c, i) => (
          <MetricCard key={c.label} spec={c} delay={25 + i * 20} />
        ))}
      </div>
      {metrics.gbRocAuc !== null ? (
        <Appear delay={150}>
          <div style={{marginTop: 60, fontSize: 34, color: theme.muted, textAlign: 'center'}}>
            Gradient boosting benchmark ROC-AUC:{' '}
            <span style={{color: theme.text, fontWeight: 700}}>{metrics.gbRocAuc.toFixed(3)}</span>
            {metrics.gbRocAuc - metrics.rocAuc <= 0.02
              ? ' — the transparent scorecard keeps pace, with every point explainable.'
              : ` — the scorecard trades ${(metrics.gbRocAuc - metrics.rocAuc).toFixed(3)} AUC for full explainability.`}
          </div>
        </Appear>
      ) : null}
    </Scene>
  );
};
