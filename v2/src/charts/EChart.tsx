import * as echarts from 'echarts';
import { useEffect, useRef } from 'react';

type Handler = (params: never) => void;

interface Props {
  option: echarts.EChartsCoreOption;
  height: number | string;
  /** ECharts event name -> handler, e.g. { click, brushEnd }. */
  on?: Record<string, Handler>;
  /** Runs once after init, e.g. to arm the brush cursor. */
  onReady?: (chart: echarts.ECharts) => void;
  dimmed?: boolean;
  className?: string;
}

export function EChart({ option, height, on, onReady, dimmed, className = '' }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const handlers = useRef(on);
  handlers.current = on;

  useEffect(() => {
    const c = echarts.init(el.current!, undefined, { renderer: 'canvas' });
    chart.current = c;
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current!);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const c = chart.current!;
    c.setOption(option, { notMerge: true });
    onReady?.(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option]);

  useEffect(() => {
    const c = chart.current!;
    const names = Object.keys(on ?? {});
    for (const n of names) c.on(n, (p: unknown) => handlers.current?.[n]?.(p as never));
    return () => names.forEach((n) => c.off(n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(on ?? {}).join()]);

  return <div ref={el} className={`transition-opacity ${dimmed ? 'opacity-50' : ''} ${className}`} style={{ height }} />;
}
