import {Composition} from 'remotion';
import {CreditBridgeVideo, TOTAL_FRAMES, type VideoProps} from './Video';
import {FALLBACK_METRICS, hasDemoScreenshot, loadMetrics} from './metrics';
import {FPS} from './theme';

const defaultProps: VideoProps = {
  liveUrl: 'https://creditbridge-bay.vercel.app',
  repoUrl: 'https://github.com/Aryan1982/creditbridge',
  metrics: FALLBACK_METRICS,
  metricsSource: 'placeholder',
  hasScreenshot: false,
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="CreditBridge"
    component={CreditBridgeVideo}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={defaultProps}
    calculateMetadata={async ({props}) => {
      const [{metrics, metricsSource}, hasScreenshot] = await Promise.all([loadMetrics(), hasDemoScreenshot()]);
      return {props: {...props, metrics, metricsSource, hasScreenshot}};
    }}
  />
);
