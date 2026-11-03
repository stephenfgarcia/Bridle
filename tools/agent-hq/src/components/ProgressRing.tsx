interface Props {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  showLabel?: boolean;
  className?: string;
}

export function ProgressRing({
  value,
  size = 36,
  stroke = 3,
  color,
  showLabel = true,
  className,
}: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  const half = size / 2;
  return (
    <svg
      className={className ? `ring ${className}` : "ring"}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${Math.round(clamped)}% complete`}
    >
      <title>{Math.round(clamped)}% complete</title>
      <circle className="ring-track" cx={half} cy={half} r={r} strokeWidth={stroke} />
      <circle
        className="ring-fill"
        cx={half}
        cy={half}
        r={r}
        strokeWidth={stroke}
        transform={`rotate(-90 ${half} ${half})`}
        style={{ strokeDasharray: c, strokeDashoffset: offset, stroke: color }}
      />
      {showLabel && (
        <text
          className="ring-label"
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.27}
        >
          {Math.round(clamped)}%
        </text>
      )}
    </svg>
  );
}
