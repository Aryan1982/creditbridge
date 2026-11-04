import {Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Appear, Card, Kicker, Scene} from '../components/ui';
import {theme} from '../theme';

const SCORE_MIN = 300;
const SCORE_MAX = 900;
const DEMO_SCORE = 712;

const REASONS = [
  {sign: '+', text: 'Stable employment (4+ years)', impact: '+38', color: theme.good},
  {sign: '+', text: 'Healthy savings balance', impact: '+21', color: theme.good},
  {sign: '−', text: 'Long loan duration (48 months)', impact: '−17', color: theme.bad},
];

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return {x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad)};
};

const arcPath = (cx: number, cy: number, r: number, fromDeg: number, toDeg: number) => {
  const a = polar(cx, cy, r, fromDeg);
  const b = polar(cx, cy, r, toDeg);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
};

const Gauge: React.FC<{delay: number}> = ({delay}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [delay, delay + 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const score = Math.round(SCORE_MIN + (DEMO_SCORE - SCORE_MIN) * t);
  const frac = (score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN);
  const start = 180;
  const end = 180 + 180 * Math.max(frac, 0.001);
  const color = frac > 0.6 ? theme.good : frac > 0.4 ? theme.warn : theme.bad;
  const needle = polar(200, 200, 150, end);
  return (
    <div style={{position: 'relative', width: 400, height: 240}}>
      <svg width={400} height={240} viewBox="0 0 400 240">
        <path d={arcPath(200, 200, 160, 180, 360)} stroke="rgba(148,163,184,0.15)" strokeWidth={26} fill="none" strokeLinecap="round" />
        <path d={arcPath(200, 200, 160, start, end)} stroke={color} strokeWidth={26} fill="none" strokeLinecap="round" />
        <line x1={200} y1={200} x2={needle.x} y2={needle.y} stroke={theme.text} strokeWidth={5} strokeLinecap="round" />
        <circle cx={200} cy={200} r={10} fill={theme.text} />
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, top: 96, textAlign: 'center'}}>
        <div style={{fontSize: 76, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color}}>{score}</div>
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', fontFamily: theme.mono, fontSize: 20, color: theme.muted, padding: '0 20px'}}>
        <span>{SCORE_MIN}</span>
        <span>{SCORE_MAX}</span>
      </div>
    </div>
  );
};

const BrowserFrame: React.FC<{hasScreenshot: boolean}> = ({hasScreenshot}) => {
  const frame = useCurrentFrame();
  const scroll = interpolate(frame, [60, 330], [0, -120], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 22,
        overflow: 'hidden',
        border: `1px solid ${theme.border}`,
        background: theme.panel,
        boxShadow: '0 40px 120px rgba(0,0,0,0.55)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{height: 54, display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px', background: theme.panelHi}}>
        {['#F87171', '#FBBF24', '#34D399'].map((c) => (
          <div key={c} style={{width: 14, height: 14, borderRadius: 7, background: c}} />
        ))}
        <div
          style={{
            marginLeft: 20,
            flex: 1,
            height: 32,
            borderRadius: 8,
            background: theme.bg,
            fontFamily: theme.mono,
            fontSize: 18,
            color: theme.muted,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
          }}
        >
          creditbridge · alternative credit scoring
        </div>
      </div>
      <div style={{flex: 1, position: 'relative', overflow: 'hidden'}}>
        {hasScreenshot ? (
          <Img
            src={staticFile('demo.png')}
            style={{width: '100%', position: 'absolute', top: 0, left: 0, transform: `translateY(${scroll}px)`}}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 30,
              border: `2px dashed ${theme.border}`,
              borderRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.muted,
              fontSize: 30,
              gap: 14,
            }}
          >
            <div style={{fontSize: 40, fontWeight: 700, color: theme.text}}>Live app screenshot</div>
            <div style={{fontFamily: theme.mono, fontSize: 24}}>video/public/demo.png</div>
          </div>
        )}
      </div>
    </div>
  );
};

export const Demo: React.FC<{duration: number; hasScreenshot: boolean}> = ({duration, hasScreenshot}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const frameIn = spring({frame: frame - 5, fps, config: {damping: 200}});
  const cf = spring({frame: frame - 230, fps, config: {damping: 14}});
  return (
    <Scene duration={duration} style={{padding: '90px 110px'}}>
      <Kicker>Live demo</Kicker>
      <div style={{display: 'flex', gap: 60, flex: 1, minHeight: 0}}>
        <div style={{flex: 1.35, opacity: frameIn, transform: `perspective(1600px) rotateY(${(1 - frameIn) * 12}deg) scale(${0.94 + 0.06 * frameIn})`}}>
          <BrowserFrame hasScreenshot={hasScreenshot} />
        </div>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 24}}>
          <Appear delay={20}>
            <Card style={{display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 30px 20px'}}>
              <div style={{fontFamily: theme.mono, fontSize: 22, color: theme.muted, letterSpacing: 3, textTransform: 'uppercase', alignSelf: 'flex-start'}}>
                Thin-file applicant
              </div>
              <Gauge delay={35} />
            </Card>
          </Appear>
          {REASONS.map((r, i) => (
            <Appear key={r.text} delay={110 + i * 25}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  padding: '18px 24px',
                  borderRadius: 16,
                  background: `${r.color}12`,
                  border: `1px solid ${r.color}44`,
                }}
              >
                <div style={{fontSize: 34, fontWeight: 900, color: r.color, width: 26}}>{r.sign}</div>
                <div style={{fontSize: 27, flex: 1}}>{r.text}</div>
                <div style={{fontFamily: theme.mono, fontSize: 24, color: r.color}}>{r.impact}</div>
              </div>
            </Appear>
          ))}
          <div
            style={{
              opacity: cf,
              transform: `scale(${0.9 + 0.1 * cf})`,
              padding: '20px 24px',
              borderRadius: 16,
              border: `1px solid ${theme.accent2}66`,
              background: `${theme.accent2}18`,
              fontSize: 26,
            }}
          >
            <span style={{fontFamily: theme.mono, color: theme.accent2, fontSize: 20, letterSpacing: 2}}>COUNTERFACTUAL&nbsp;&nbsp;</span>
            Shorten duration to 24 months → <span style={{color: theme.good, fontWeight: 800}}>Approved</span>
          </div>
        </div>
      </div>
    </Scene>
  );
};
