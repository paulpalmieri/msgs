export function Sparkline({ values, width = 96, height = 18, color = 'var(--color-accent)' }: { values: number[]; width?: number; height?: number; color?: string }) {
  const max = Math.max(1, ...values);
  const w = width / values.length;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="block" aria-hidden>
      {values.map((v, i) => {
        const h = v ? Math.max(1.5, (v / max) * height) : 0;
        return <rect key={i} x={i * w + 0.5} y={height - h} width={Math.max(1, w - 1)} height={h} rx={0.5} fill={color} />;
      })}
    </svg>
  );
}
