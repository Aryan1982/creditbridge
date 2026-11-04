import {AbsoluteFill, Series} from 'remotion';
import {Background} from './components/Background';
import {ShotScene} from './components/ShotScene';
import type {Metrics as MetricsData, MetricsSource} from './metrics';
import {Hook} from './scenes/Hook';
import {Problem} from './scenes/Problem';
import {Solution} from './scenes/Solution';
import {Decision} from './scenes/Decision';
import {Pipeline} from './scenes/Pipeline';
import {Metrics} from './scenes/Metrics';
import {ResponsibleAI} from './scenes/ResponsibleAI';
import {Outro} from './scenes/Outro';
import {ANALYSIS, AUTHENTICITY, CASHFLOW, CONSENT, LANDING, LENDER, MODEL, SAMPLES} from './walkthrough';

export type VideoProps = {
  liveUrl: string;
  repoUrl: string;
  metrics: MetricsData;
  metricsSource: MetricsSource;
};

/** Scene lengths in frames @30fps — total 2700 frames = 90s. */
export const SCENES = {
  hook: 150,
  problem: 210,
  solution: 105,
  landing: 135,
  samples: 120,
  consent: 135,
  analysis: 105,
  decision: 225,
  cashflow: 135,
  authenticity: 255,
  lender: 165,
  model: 135,
  pipeline: 210,
  metrics: 270,
  responsible: 210,
  outro: 135,
} as const;

export const TOTAL_FRAMES = Object.values(SCENES).reduce((a, b) => a + b, 0);

export const CreditBridgeVideo: React.FC<VideoProps> = ({liveUrl, repoUrl, metrics, metricsSource}) => {
  const host = liveUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return (
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
        <Series.Sequence durationInFrames={SCENES.landing}>
          <ShotScene duration={SCENES.landing} spec={LANDING} host={host} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.samples}>
          <ShotScene duration={SCENES.samples} spec={SAMPLES} host={host} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.consent}>
          <ShotScene duration={SCENES.consent} spec={CONSENT} host={host} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.analysis}>
          <ShotScene duration={SCENES.analysis} spec={ANALYSIS} host={host} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.decision}>
          <Decision duration={SCENES.decision} host={host} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.cashflow}>
          <ShotScene duration={SCENES.cashflow} spec={CASHFLOW} host={host} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.authenticity}>
          <ShotScene duration={SCENES.authenticity} spec={AUTHENTICITY} host={host} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.lender}>
          <ShotScene duration={SCENES.lender} spec={LENDER} host={host} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.model}>
          <ShotScene duration={SCENES.model} spec={MODEL} host={host} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.pipeline}>
          <Pipeline duration={SCENES.pipeline} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.metrics}>
          <Metrics duration={SCENES.metrics} metrics={metrics} metricsSource={metricsSource} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.responsible}>
          <ResponsibleAI duration={SCENES.responsible} metrics={metrics} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.outro}>
          <Outro duration={SCENES.outro} liveUrl={liveUrl} repoUrl={repoUrl} />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
