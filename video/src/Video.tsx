import {AbsoluteFill, Series} from 'remotion';
import {Background} from './components/Background';
import type {Metrics, MetricsSource} from './metrics';
import {Hook} from './scenes/Hook';
import {Problem} from './scenes/Problem';
import {Solution} from './scenes/Solution';
import {HowItWorks} from './scenes/HowItWorks';
import {Results} from './scenes/Results';
import {Demo} from './scenes/Demo';
import {ResponsibleAI} from './scenes/ResponsibleAI';
import {Outro} from './scenes/Outro';

export type VideoProps = {
  liveUrl: string;
  repoUrl: string;
  metrics: Metrics;
  metricsSource: MetricsSource;
  hasScreenshot: boolean;
};

/** Scene lengths in frames @30fps — total 2250 frames = 75s. */
export const SCENES = {
  hook: 240,
  problem: 270,
  solution: 240,
  how: 360,
  results: 330,
  demo: 390,
  responsible: 300,
  outro: 120,
} as const;

export const TOTAL_FRAMES = Object.values(SCENES).reduce((a, b) => a + b, 0);

export const CreditBridgeVideo: React.FC<VideoProps> = ({liveUrl, repoUrl, metrics, metricsSource, hasScreenshot}) => (
  <AbsoluteFill>
    <Background />
    <Series>
      <Series.Sequence durationInFrames={SCENES.hook}>
        <Hook duration={SCENES.hook} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.problem}>
        <Problem duration={SCENES.problem} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.solution}>
        <Solution duration={SCENES.solution} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.how}>
        <HowItWorks duration={SCENES.how} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.results}>
        <Results duration={SCENES.results} metrics={metrics} metricsSource={metricsSource} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.demo}>
        <Demo duration={SCENES.demo} hasScreenshot={hasScreenshot} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.responsible}>
        <ResponsibleAI duration={SCENES.responsible} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.outro}>
        <Outro duration={SCENES.outro} liveUrl={liveUrl} repoUrl={repoUrl} />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
