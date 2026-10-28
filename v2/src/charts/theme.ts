// Chart tokens for both modes: the validated reference palette (dataviz skill).
import { useSyncExternalStore } from 'react';
import { extendPalette } from './palette';

const LIGHT = {
  dark: false,
  surface: '#fcfcfb',
  ink: '#0b0b0b',
  ink2: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  other: '#b9b7b0',
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  seq: ['#f0efec', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
  brush: 'rgba(42,120,214,0.10)',
};

const DARK: typeof LIGHT = {
  dark: true,
  surface: '#1a1a19',
  ink: '#f0efec',
  ink2: '#c3c2b7',
  muted: '#898781',
  grid: '#2c2c2a',
  axis: '#383835',
  other: '#5c5b57',
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  seq: ['#242422', '#104281', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb'],
  brush: 'rgba(57,135,229,0.16)',
};

export type ChartTheme = typeof LIGHT & { people: string[] };

const LIGHT_T: ChartTheme = { ...LIGHT, people: extendPalette(LIGHT.series, false) };
const DARK_T: ChartTheme = { ...DARK, people: extendPalette(DARK.series, true) };

/** Person colours tuned for a dark surface, whatever the app theme (Wrapped is always dark). */
export const DARK_PEOPLE = DARK_T.people;

const query = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const subscribe = (cb: () => void) => {
  query?.addEventListener('change', cb);
  return () => query?.removeEventListener('change', cb);
};

export function useChartTheme(): ChartTheme {
  const dark = useSyncExternalStore(subscribe, () => query?.matches ?? false);
  return dark ? DARK_T : LIGHT_T;
}

/** Chart labels and tooltips carry user data (names, text): always escape. */
export function esc(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Shared axis / grid / tooltip styling. */
export function baseOption(t: ChartTheme) {
  const axisCommon = {
    axisLine: { lineStyle: { color: t.axis } },
    axisTick: { show: false },
    axisLabel: { color: t.muted, fontSize: 11 },
    splitLine: { lineStyle: { color: t.grid } },
  };
  return {
    animationDuration: 250,
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      backgroundColor: t.surface,
      borderColor: t.grid,
      borderWidth: 1,
      padding: [6, 10],
      textStyle: { color: t.ink, fontSize: 12 },
      extraCssText: 'box-shadow: 0 4px 14px rgba(0,0,0,0.12); border-radius: 6px;',
    },
    axisCommon,
  };
}

/** One tooltip row: line key in the series colour, value first, then label. */
export function tipRow(color: string, value: string, label: string): string {
  return `<div style="display:flex;align-items:center;gap:8px;line-height:18px">` +
    `<span style="width:10px;height:2px;background:${color};border-radius:1px"></span>` +
    `<b style="font-variant-numeric:tabular-nums">${esc(value)}</b><span style="opacity:.7">${esc(label)}</span></div>`;
}

/** Single-row legend that pages instead of wrapping over the plot. */
export function legend(t: ChartTheme, names: string[], mark: 'rect' | 'line' = 'rect') {
  return {
    type: 'scroll',
    top: 0,
    left: 0,
    right: 0,
    icon: mark === 'rect' ? 'rect' : 'roundRect',
    itemWidth: mark === 'rect' ? 10 : 12,
    itemHeight: mark === 'rect' ? 10 : 2,
    textStyle: { color: t.ink2, fontSize: 11 },
    pageIconColor: t.ink2,
    pageIconInactiveColor: t.axis,
    pageTextStyle: { color: t.muted, fontSize: 10 },
    data: names,
  };
}
