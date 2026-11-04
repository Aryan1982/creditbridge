import {Appear, BridgeMark, Scene} from '../components/ui';
import {theme} from '../theme';

const stripProtocol = (url: string) => url.replace(/^https?:\/\//, '');

export const Outro: React.FC<{duration: number; liveUrl: string; repoUrl: string}> = ({duration, liveUrl, repoUrl}) => (
  <Scene duration={duration} style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
    <BridgeMark size={220} />
    <Appear delay={8}>
      <div style={{fontSize: 110, fontWeight: 900, letterSpacing: -4}}>
        Credit<span style={{color: theme.accent}}>Bridge</span>
      </div>
    </Appear>
    <Appear delay={18}>
      <div style={{fontSize: 36, color: theme.muted, marginTop: 6}}>Credit for the credit-invisible.</div>
    </Appear>
    <Appear delay={28}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 18, marginTop: 50, fontFamily: theme.mono, fontSize: 36}}>
        <div>
          <span style={{color: theme.muted}}>live&nbsp;&nbsp;</span>
          <span style={{color: theme.accent}}>{stripProtocol(liveUrl)}</span>
        </div>
        <div>
          <span style={{color: theme.muted}}>code&nbsp;&nbsp;</span>
          <span style={{color: theme.accent2}}>{stripProtocol(repoUrl)}</span>
        </div>
      </div>
    </Appear>
    <Appear delay={40}>
      <div style={{fontSize: 26, color: theme.muted, marginTop: 50, letterSpacing: 4, textTransform: 'uppercase'}}>
        Neural Storm 2026 · Track HI-04
      </div>
    </Appear>
  </Scene>
);
