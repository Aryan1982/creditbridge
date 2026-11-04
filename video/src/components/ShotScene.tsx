import type {ReactNode} from 'react';
import {Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {Kicker, Scene, Title} from './ui';

/** Rectangle in screenshot CSS pixels: [x, y, width, height]. */
export type Box = readonly [number, number, number, number];

export type Shot = {
  /** File in public/shots/ (captured at 1440 CSS px wide, devicePixelRatio 2). */
  file: string;
  /** Page height in CSS pixels. */
  height: number;
};

/** Camera target: centre point in screenshot CSS pixels and zoom relative to fit-to-width. */
export type CameraKey = {at: number; x: number; y: number; zoom: number};

export type Callout = {
  from: number;
  to: number;
  box: Box;
  label: string;
  tone?: 'accent' | 'good' | 'bad' | 'warn';
  place?: 'top' | 'bottom' | 'left' | 'right';
  /** Dim everything outside the box. */
  spot?: boolean;
};

export type CursorKey = {at: number; x: number; y: number; click?: boolean};

export type ShotSceneSpec = {
  kicker: string;
  /** Page path shown in the address bar, e.g. "/check". */
  path: string;
  title: string;
  shot: Shot;
  camera: CameraKey[];
  callouts: Callout[];
  cursor?: CursorKey[];
};

const SHOT_WIDTH = 1440;
/** Browser frame geometry in composition pixels. */
const FRAME = {left: 120, top: 250, width: 1680, height: 770, toolbar: 46};
const VIEW_W = FRAME.width;
const VIEW_H = FRAME.height - FRAME.toolbar;
const BASE_SCALE = VIEW_W / SHOT_WIDTH;
/** Vertical space a one-line callout label needs above or below its box. */
const LABEL_ROOM = 76;

const TONES = {accent: theme.accent, good: theme.good, bad: theme.bad, warn: theme.warn} as const;

const ease = Easing.inOut(Easing.cubic);

/** Surrounding keyframes and eased progress between them; holds the first/last key outside the range. */
const segment = <K extends {at: number}>(keys: K[], frame: number) => {
  const i = keys.findIndex((k) => k.at > frame);
  const a = i === -1 ? keys[keys.length - 1] : keys[Math.max(0, i - 1)];
  const b = i === -1 ? a : keys[i];
  return {a, b, t: a === b ? 0 : ease(Math.min(1, Math.max(0, (frame - a.at) / (b.at - a.at))))};
};

const cameraAt = (keys: CameraKey[], frame: number, pageHeight: number) => {
  const {a, b, t} = segment(keys, frame);
  const zoom = a.zoom + (b.zoom - a.zoom) * t;
  const s = BASE_SCALE * zoom;
  const halfW = VIEW_W / (2 * s);
  const halfH = VIEW_H / (2 * s);
  const x = a.x + (b.x - a.x) * t;
  const y = a.y + (b.y - a.y) * t;
  return {
    s,
    x: SHOT_WIDTH * s <= VIEW_W ? SHOT_WIDTH / 2 : Math.min(SHOT_WIDTH - halfW, Math.max(halfW, x)),
    y: pageHeight * s <= VIEW_H ? pageHeight / 2 : Math.min(pageHeight - halfH, Math.max(halfH, y)),
  };
};

const CalloutView: React.FC<{c: Callout; cam: {s: number; x: number; y: number}}> = ({c, cam}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const fade = Math.min(10, (c.to - c.from) / 3);
  const opacity = interpolate(frame, [c.from, c.from + fade, c.to - fade, c.to], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  if (opacity <= 0) return null;
  const pop = spring({frame: frame - c.from, fps, config: {damping: 16, stiffness: 160}});
  const color = TONES[c.tone ?? 'accent'];
  const pad = 8;
  const left = VIEW_W / 2 + (c.box[0] - cam.x) * cam.s - pad;
  const top = VIEW_H / 2 + (c.box[1] - cam.y) * cam.s - pad;
  const width = c.box[2] * cam.s + pad * 2;
  const height = c.box[3] * cam.s + pad * 2;
  // Flip a top/bottom label to the other side when the box leaves no room for it in the viewport.
  const requested = c.place ?? 'top';
  const place =
    requested === 'top' && top < LABEL_ROOM && top + height < VIEW_H - LABEL_ROOM
      ? 'bottom'
      : requested === 'bottom' && top + height > VIEW_H - LABEL_ROOM && top >= LABEL_ROOM
        ? 'top'
        : requested;
  const labelPos: React.CSSProperties =
    place === 'top'
      ? {left: Math.max(12, left), bottom: Math.min(VIEW_H - 64, VIEW_H - top + 14)}
      : place === 'bottom'
        ? {left: Math.max(12, left), top: Math.min(VIEW_H - 64, top + height + 14)}
        : place === 'left'
          ? {right: Math.min(VIEW_W - 12, VIEW_W - left + 18), top: Math.max(12, top)}
          : {left: Math.min(VIEW_W - 420, left + width + 18), top: Math.max(12, top)};
  return (
    <div style={{position: 'absolute', inset: 0, opacity, pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left,
          top,
          width,
          height,
          borderRadius: 14,
          border: `4px solid ${color}`,
          boxShadow: c.spot ? `0 0 0 4000px rgba(7,9,18,${0.5 * pop}), 0 0 40px ${color}88` : `0 0 40px ${color}88`,
          transform: `scale(${1.04 - 0.04 * pop})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          ...labelPos,
          maxWidth: 760,
          padding: '12px 22px',
          borderRadius: 14,
          background: 'rgba(10,13,26,0.94)',
          border: `2px solid ${color}`,
          color: theme.text,
          fontFamily: theme.font,
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1.25,
          boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
          transform: `translateY(${(1 - pop) * 12}px)`,
        }}
      >
        {c.label}
      </div>
    </div>
  );
};

const Cursor: React.FC<{keys: CursorKey[]; cam: {s: number; x: number; y: number}}> = ({keys, cam}) => {
  const frame = useCurrentFrame();
  if (keys.length === 0 || frame < keys[0].at - 10) return null;
  const {a, b, t} = segment(keys, frame);
  const px = a.x + (b.x - a.x) * t;
  const py = a.y + (b.y - a.y) * t;
  const sx = VIEW_W / 2 + (px - cam.x) * cam.s;
  const sy = VIEW_H / 2 + (py - cam.y) * cam.s;
  const appear = interpolate(frame, [keys[0].at - 10, keys[0].at], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const click = keys.find((k) => k.click && frame >= k.at && frame < k.at + 18);
  const ripple = click ? (frame - click.at) / 18 : 0;
  return (
    <div style={{position: 'absolute', left: sx, top: sy, opacity: appear, pointerEvents: 'none'}}>
      {click ? (
        <div
          style={{
            position: 'absolute',
            left: -30 * ripple - 6,
            top: -30 * ripple - 6,
            width: 60 * ripple + 12,
            height: 60 * ripple + 12,
            borderRadius: '50%',
            border: `3px solid ${theme.brand}`,
            opacity: 1 - ripple,
          }}
        />
      ) : null}
      <svg width={34} height={40} viewBox="0 0 17 20" style={{transform: `scale(${click && ripple < 0.3 ? 0.88 : 1})`, transformOrigin: '0 0'}}>
        <path d="M1 1l14 10.5-6.2.9 3.6 6.4-2.6 1.3-3.5-6.5L1 18z" fill="#0b0c0e" stroke="#fff" strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

/** A captured page inside a browser frame with an animated camera, callouts and an optional cursor. */
export const ShotScene: React.FC<{duration: number; spec: ShotSceneSpec; host: string; children?: ReactNode}> = ({duration, spec, host, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 200}});
  const cam = cameraAt(spec.camera, frame, spec.shot.height);
  return (
    <Scene duration={duration} style={{padding: 0}}>
      <div style={{position: 'absolute', left: FRAME.left, top: 64, right: FRAME.left}}>
        <Kicker>{spec.kicker}</Kicker>
        <Title size={60} style={{marginTop: -6}}>
          {spec.title}
        </Title>
      </div>
      <div
        style={{
          position: 'absolute',
          left: FRAME.left,
          top: FRAME.top,
          width: FRAME.width,
          height: FRAME.height,
          borderRadius: 20,
          overflow: 'hidden',
          border: `1px solid ${theme.border}`,
          background: '#fff',
          boxShadow: '0 40px 120px rgba(0,0,0,0.55)',
          opacity: enter,
          transform: `perspective(2000px) translateY(${(1 - enter) * 60}px) rotateX(${(1 - enter) * 8}deg)`,
        }}
      >
        <div style={{height: FRAME.toolbar, display: 'flex', alignItems: 'center', gap: 9, padding: '0 20px', background: theme.panelHi}}>
          {['#F87171', '#FBBF24', '#34D399'].map((c) => (
            <div key={c} style={{width: 13, height: 13, borderRadius: 7, background: c}} />
          ))}
          <div
            style={{
              marginLeft: 18,
              flex: 1,
              height: 28,
              borderRadius: 8,
              background: theme.bg,
              fontFamily: theme.mono,
              fontSize: 17,
              color: theme.muted,
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
            }}
          >
            {host}
            {spec.path}
          </div>
        </div>
        <div style={{position: 'relative', width: VIEW_W, height: VIEW_H, overflow: 'hidden'}}>
          <Img
            src={staticFile(`shots/${spec.shot.file}`)}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: SHOT_WIDTH,
              height: spec.shot.height,
              transformOrigin: '0 0',
              transform: `translate(${VIEW_W / 2 - cam.x * cam.s}px, ${VIEW_H / 2 - cam.y * cam.s}px) scale(${cam.s})`,
            }}
          />
          {spec.callouts.map((c) => (
            <CalloutView key={`${c.from}-${c.label}`} c={c} cam={cam} />
          ))}
          {spec.cursor ? <Cursor keys={spec.cursor} cam={cam} /> : null}
          {children}
        </div>
      </div>
    </Scene>
  );
};
