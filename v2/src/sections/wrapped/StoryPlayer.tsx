// Full-screen story player: a portrait frame centred on desktop, progress
// segments, click left / right to step, hold to pause, keys ← → space esc.
import { Pause, Play, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

export interface Slide {
  id: string;
  /** Seconds before auto-advancing; 0 waits on this slide. */
  seconds: number;
  render: () => ReactNode;
}

const HOLD_MS = 220;

/** `accent` themes the story: the person's own colour, or the brand orange for a group. */
export function StoryPlayer({ slides, onClose, accent, start = 0 }: { slides: Slide[]; onClose: () => void; accent: string; start?: number }) {
  const [index, setIndex] = useState(start);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const pressedAt = useRef<number | null>(null);

  const go = useCallback((d: 1 | -1) => {
    setIndex((i) => Math.min(slides.length - 1, Math.max(0, i + d)));
    setProgress(0);
  }, [slides.length]);

  useEffect(() => {
    const seconds = slides[index]?.seconds ?? 0;
    if (paused || !seconds) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setProgress((p) => {
        const next = p + dt / (seconds * 1000);
        if (next >= 1) {
          if (index < slides.length - 1) {
            setIndex(index + 1);
            return 0;
          }
          return 1;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, paused, slides]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') (e.preventDefault(), setPaused((p) => !p));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  const down = () => {
    pressedAt.current = performance.now();
    setPaused(true);
  };
  const up = (d: 1 | -1) => {
    const held = pressedAt.current !== null && performance.now() - pressedAt.current > HOLD_MS;
    pressedAt.current = null;
    setPaused(false);
    if (!held) go(d);
  };

  const slide = slides[index];
  return (
    <div className="wr fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm" style={{ ['--wr-accent' as string]: accent }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--wr-accent)_16%,transparent),transparent_62%)]" />
      <div className="relative flex h-[min(92vh,980px)] aspect-[9/16] flex-col overflow-hidden rounded-2xl border border-[var(--wr-line)] bg-[var(--wr-bg)] shadow-2xl select-none">
        <div className="wr-grain" />
        <div className="absolute inset-x-0 top-0 z-20 flex gap-1 bg-gradient-to-b from-black/80 to-transparent px-3 pb-6 pt-3">
          {slides.map((s, i) => (
            <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/20">
              <div className="h-full bg-white" style={{ width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%' }} />
            </div>
          ))}
        </div>
        <div className="absolute right-3 top-6 z-30 flex gap-1">
          <button onClick={() => setPaused((p) => !p)} className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white" title="Pause (space)">
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button onClick={onClose} className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white" title="Close (esc)">
            <X size={15} />
          </button>
        </div>
        {/* Navigation zones; slide content sits above them but lets clicks through except on its buttons. */}
        <div className="absolute inset-0 z-10 flex">
          <div className="h-full w-[30%] cursor-w-resize" onPointerDown={down} onPointerUp={() => up(-1)} onPointerLeave={() => pressedAt.current !== null && (pressedAt.current = null, setPaused(false))} />
          <div className="h-full flex-1 cursor-e-resize" onPointerDown={down} onPointerUp={() => up(1)} onPointerLeave={() => pressedAt.current !== null && (pressedAt.current = null, setPaused(false))} />
        </div>
        <div key={slide.id} className="pointer-events-none relative z-20 flex h-full flex-col px-9 pb-10 pt-16 [&_button]:pointer-events-auto">
          {slide.render()}
        </div>
        {index === 0 && <div className="wr-label wr-fade wr-d5 absolute inset-x-0 bottom-5 z-0 text-center text-[10px] text-[var(--wr-muted)]">click or → to continue</div>}
      </div>
    </div>
  );
}
