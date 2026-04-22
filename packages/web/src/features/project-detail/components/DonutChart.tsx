interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}

export function DonutChart({ segments, size = 120, strokeWidth = 16 }: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke="var(--color-border)" strokeWidth={strokeWidth}
          opacity={0.3}
        />
      </svg>
    );
  }

  let offset = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((segment) => {
      const ratio = segment.value / total;
      const dashLength = ratio * circumference;
      const dashGap = circumference - dashLength;
      const dashOffset = -offset;
      offset += dashLength;

      return (
        <circle
          key={segment.label}
          data-segment={segment.label}
          cx={center} cy={center} r={radius}
          fill="none"
          stroke={segment.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${dashLength} ${dashGap}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="butt"
          transform={`rotate(-90 ${center} ${center})`}
          className="transition-all duration-500"
        />
      );
    });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {arcs}
      <text
        x={center} y={center}
        textAnchor="middle" dominantBaseline="central"
        className="text-xl font-bold fill-theme-primary"
      >
        {total}
      </text>
    </svg>
  );
}
