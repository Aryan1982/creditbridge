import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {Appear, Card, Kicker, Pill, Scene, Title} from '../components/ui';
import type {Metrics as MetricsData, MetricsSource} from '../metrics';
import {theme} from '../theme';

const useCount = (delay: number) =>
  interpolate(useCurrentFrame(), [delay, delay + 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

const Stat: React.FC<{label: string; value: number; format: (v: number) => string; hint: string; color: string; delay: number}> = ({
  label,
  value,
  format,
  hint,
  color,
  delay,
}) => {
  const t = useCount(delay);
  return (
    <Appear delay={delay} style={{flex: 1}}>
      <Card style={{padding: '26px 30px'}}>
        <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.muted, letterSpacing: 3, textTransform: 'uppercase'}}>{label}</div>
        <div style={{fontSize: 84, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', marginTop: 4}}>{format(value * t)}</div>
        <div style={{fontSize: 22, color: theme.muted, marginTop: 4}}>{hint}</div>
      </Card>
    </Appear>
  );
};

/** Horizontal AUC bar on a 0 → 1 axis; the dashed tick marks 0.5 (random ranking). */
const AucBar: React.FC<{label: string; value: number; color: string; delay: number}> = ({label, value, color, delay}) => {
  const t = useCount(delay);
  return (
    <div style={{marginTop: 14}}>
      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 24}}>
        <span style={{color: theme.muted}}>{label}</span>
        <span style={{fontFamily: theme.mono, fontWeight: 700, color}}>{(value * t).toFixed(2)}</span>
      </div>
      <div style={{position: 'relative', height: 16, borderRadius: 8, background: 'rgba(148,163,184,0.14)', marginTop: 8, overflow: 'hidden'}}>
        <div style={{height: '100%', width: `${value * t * 100}%`, background: color, borderRadius: 8, boxShadow: `0 0 18px ${color}88`}} />
        <div style={{position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeft: `2px dashed ${theme.text}88`}} />
      </div>
    </div>
  );
};

const fixed3 = (v: number) => v.toFixed(3);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export const Metrics: React.FC<{duration: number; metrics: MetricsData; metricsSource: MetricsSource}> = ({duration, metrics, metricsSource}) => {
  const {risk, categorizer, data, external} = metrics;
  return (
    <Scene duration={duration} style={{padding: '90px 120px'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <div>
          <Kicker>Results · engine/models/model_card.json</Kicker>
          <Title size={64}>Measured, not claimed.</Title>
        </div>
        {metricsSource === 'placeholder' ? (
          <Pill color={theme.warn} style={{fontSize: 22}}>Placeholder values — run npm run sync-metrics</Pill>
        ) : (
          <Pill style={{fontSize: 22}}>Live from the model card</Pill>
        )}
      </div>
      <div style={{display: 'flex', gap: 36, marginTop: 50}}>
        <div style={{flex: 1.45, display: 'flex', flexDirection: 'column', gap: 22}}>
          <Appear delay={10}>
            <div style={{fontSize: 28, fontWeight: 700}}>
              Risk scorecard <span style={{color: theme.muted, fontWeight: 400}}>· 5-fold cross-validation</span>
            </div>
          </Appear>
          <div style={{display: 'flex', gap: 22}}>
            <Stat label="ROC-AUC" value={risk.auc} format={fixed3} hint="Ranks defaulters" color={theme.accent} delay={16} />
            <Stat label="KS" value={risk.ks} format={fixed3} hint="Good/bad separation" color={theme.accent} delay={26} />
            <Stat label="Gini" value={risk.gini} format={fixed3} hint="2 × AUC − 1" color={theme.accent} delay={36} />
          </div>
          <Appear delay={60}>
            <div style={{fontSize: 28, fontWeight: 700, marginTop: 8}}>
              Transaction categorizer <span style={{color: theme.muted, fontWeight: 400}}>· merchants never seen in training</span>
            </div>
          </Appear>
          <div style={{display: 'flex', gap: 22}}>
            <Stat label="Accuracy" value={categorizer.accuracy} format={pct} hint="Char n-gram TF-IDF + logistic" color={theme.accent2} delay={66} />
            <Stat label="Macro F1" value={categorizer.macroF1} format={fixed3} hint="Averaged over categories" color={theme.accent2} delay={76} />
          </div>
        </div>
        {external ? (
          <Appear delay={100} style={{flex: 1}}>
            <Card style={{height: '100%', padding: '30px 34px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 21, color: theme.good, letterSpacing: 3, textTransform: 'uppercase'}}>Real-data check</div>
              <div style={{fontSize: 27, fontWeight: 800, marginTop: 8, lineHeight: 1.25}}>{external.dataset}</div>
              <div style={{fontSize: 22, color: theme.muted, marginTop: 4}}>AUC with 5-fold CV · dashed line = random (0.5)</div>
              <AucBar label="Alternative data only" value={external.altAuc} color={theme.good} delay={115} />
              <AucBar label="Bureau history only" value={external.bureauAuc} color={theme.muted} delay={122} />
              {external.thinAltAuc !== null && external.thinBureauAuc !== null ? (
                <>
                  <div style={{fontSize: 26, fontWeight: 700, marginTop: 30}}>
                    Thin-file applicants{external.thinN !== null ? <span style={{color: theme.muted, fontWeight: 400}}> · n = {external.thinN}</span> : null}
                  </div>
                  <AucBar label="Alternative data only" value={external.thinAltAuc} color={theme.good} delay={140} />
                  <AucBar label="Bureau history only" value={external.thinBureauAuc} color={theme.bad} delay={147} />
                </>
              ) : null}
            </Card>
          </Appear>
        ) : null}
      </div>
      <Appear delay={175}>
        <div style={{marginTop: 34, fontSize: 28, color: theme.muted, textAlign: 'center'}}>
          Trained on <span style={{color: theme.text, fontWeight: 700}}>{data.applicants.toLocaleString('en-IN')}</span>
          {data.synthetic ? ' simulated' : ''} applicants ·{' '}
          <span style={{color: theme.text, fontWeight: 700}}>{(data.transactions / 1e6).toFixed(2)}M</span> transactions
          {risk.gbmAuc !== null ? (
            <>
              {' '}
              · gradient boosting benchmark AUC <span style={{color: theme.text, fontWeight: 700}}>{risk.gbmAuc.toFixed(3)}</span>
            </>
          ) : null}
        </div>
      </Appear>
    </Scene>
  );
};
