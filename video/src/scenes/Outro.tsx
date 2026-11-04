import {Appear, LogoMark, Scene} from '../components/ui';
import {theme} from '../theme';

const PAGES = ['/check', '/report', '/lender', '/model'];

export const Outro: React.FC<{duration: number; liveUrl: string; repoUrl: string}> = ({duration, liveUrl, repoUrl}) => (
  <Scene duration={duration} style={{justifyContent: 'center', alignItems: 'center', textAlign: 'center'}}>
    <LogoMark size={130} />
    <Appear delay={8}>
      <div style={{fontSize: 110, fontWeight: 900, letterSpacing: -4, marginTop: 24}}>
        Credit<span style={{color: theme.accent}}>Bridge</span>
      </div>
    </Appear>
    <Appear delay={18}>
      <div style={{fontSize: 38, color: theme.muted, marginTop: 4}}>Credit decisions from cash flow, for people with no credit score.</div>
    </Appear>
    <Appear delay={30}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 18, marginTop: 50, fontFamily: theme.mono, fontSize: 38}}>
        <div>
          <span style={{color: theme.muted}}>try&nbsp;&nbsp;</span>
          <span style={{color: theme.accent}}>{liveUrl.replace(/^https?:\/\//, '')}</span>
        </div>
        <div>
          <span style={{color: theme.muted}}>code&nbsp;</span>
          <span style={{color: theme.accent2}}>{repoUrl.replace(/^https?:\/\//, '')}</span>
        </div>
      </div>
    </Appear>
    <Appear delay={42}>
      <div style={{display: 'flex', gap: 16, justifyContent: 'center', marginTop: 30, fontFamily: theme.mono, fontSize: 26, color: theme.muted}}>
        {PAGES.map((p) => (
          <span key={p} style={{padding: '6px 18px', borderRadius: 10, border: `1px solid ${theme.border}`}}>
            {p}
          </span>
        ))}
      </div>
    </Appear>
    <Appear delay={54}>
      <div style={{fontSize: 26, color: theme.muted, marginTop: 50, letterSpacing: 4, textTransform: 'uppercase'}}>Neural Storm 2026 · Track HI-04</div>
    </Appear>
  </Scene>
);
