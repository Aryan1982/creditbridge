import {Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ShotScene} from '../components/ShotScene';
import {theme} from '../theme';
import {DECISION, SUMMARY_INSETS, SUMMARY_INSETS_WINDOW} from '../walkthrough';

/** Report decision hero, with the Hindi and Telugu summaries sliding in beside the English one. */
export const Decision: React.FC<{duration: number; host: string}> = ({duration, host}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {from, to} = SUMMARY_INSETS_WINDOW;
  const out = interpolate(frame, [to - 10, to], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <ShotScene duration={duration} spec={DECISION} host={host}>
      <div style={{position: 'absolute', right: 28, top: 24, display: 'flex', flexDirection: 'column', gap: 20}}>
        {SUMMARY_INSETS.map((inset, i) => {
          const p = spring({frame: frame - from - i * 8, fps, config: {damping: 18}});
          return (
            <div
              key={inset.file}
              style={{
                width: 380,
                opacity: Math.min(p, out),
                transform: `translateX(${(1 - p) * 120}px)`,
                borderRadius: 16,
                overflow: 'hidden',
                background: '#fff',
                border: `3px solid ${theme.accent}`,
                boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
                position: 'relative',
              }}
            >
              <Img src={staticFile(`shots/${inset.file}`)} style={{width: 380, display: 'block'}} />
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  padding: '4px 14px',
                  borderRadius: 999,
                  background: theme.brand,
                  color: '#fff',
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                {inset.label}
              </div>
            </div>
          );
        })}
      </div>
    </ShotScene>
  );
};
