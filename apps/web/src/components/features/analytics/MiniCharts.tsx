'use client';

import { useState } from 'react';

// ── Sparkline / Line chart ──────────────────────────────────

export function LineChart({
  data,
  height = 80,
  color = 'oklch(0.68 0.195 35)',
  showAxis = false,
  fill = true,
}: {
  data: { date: string; value: number }[];
  height?: number;
  color?: string;
  showAxis?: boolean;
  fill?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return null;

  const w = 600;
  const padding = showAxis ? 28 : 6;
  const chartW = w - padding * 2;
  const chartH = height - (showAxis ? 24 : 6);
  const max = Math.max(...data.map((d) => d.value), 1);
  const stepX = data.length > 1 ? chartW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padding + i * stepX;
    const y = padding + chartH - (d.value / max) * chartH;
    return { x, y, ...d };
  });

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    points.length > 0
      ? `${path} L ${points[points.length - 1]!.x.toFixed(1)} ${(padding + chartH).toFixed(1)} L ${points[0]!.x.toFixed(1)} ${(padding + chartH).toFixed(1)} Z`
      : '';

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" preserveAspectRatio="none">
      {showAxis && (
        <>
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={padding + chartH}
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-border"
          />
          <line
            x1={padding}
            y1={padding + chartH}
            x2={padding + chartW}
            y2={padding + chartH}
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-border"
          />
          <text
            x={padding - 4}
            y={padding + 4}
            textAnchor="end"
            className="fill-muted-foreground text-[9px]"
          >
            {max}
          </text>
          <text
            x={padding - 4}
            y={padding + chartH + 2}
            textAnchor="end"
            className="fill-muted-foreground text-[9px]"
          >
            0
          </text>
        </>
      )}
      {fill && areaPath && <path d={areaPath} fill={color} opacity={0.14} />}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={hover === i ? 3.5 : 0}
            fill={color}
            className="transition-all"
          />
          <rect
            x={p.x - stepX / 2}
            y={padding}
            width={Math.max(stepX, 4)}
            height={chartH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        </g>
      ))}
      {hover !== null && points[hover] && (
        <g>
          <line
            x1={points[hover]!.x}
            y1={padding}
            x2={points[hover]!.x}
            y2={padding + chartH}
            stroke={color}
            strokeDasharray="2 2"
            strokeWidth="0.8"
            opacity={0.6}
          />
          <text
            x={points[hover]!.x}
            y={padding - 2}
            textAnchor="middle"
            className="fill-foreground text-[10px] font-semibold"
          >
            {points[hover]!.value} · {points[hover]!.date.slice(5)}
          </text>
        </g>
      )}
    </svg>
  );
}

// ── Bar chart ──────────────────────────────────────────────

export function BarChart({
  data,
  height = 140,
  color = 'oklch(0.68 0.195 35)',
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  if (data.length === 0) return null;
  const w = 600;
  const padding = 28;
  const chartW = w - padding * 2;
  const chartH = height - 32;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = chartW / data.length;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" preserveAspectRatio="none">
      <line
        x1={padding}
        y1={padding + chartH}
        x2={padding + chartW}
        y2={padding + chartH}
        stroke="currentColor"
        strokeWidth="0.5"
        className="text-border"
      />
      <text
        x={padding - 4}
        y={padding + 4}
        textAnchor="end"
        className="fill-muted-foreground text-[9px]"
      >
        {max}
      </text>
      {data.map((d, i) => {
        const h = (d.value / max) * chartH;
        const x = padding + i * barW + barW * 0.15;
        const y = padding + chartH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW * 0.7} height={h} fill={color} rx={2}>
              <title>
                {d.label}: {d.value}
              </title>
            </rect>
            <text
              x={padding + i * barW + barW / 2}
              y={padding + chartH + 12}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {d.label}
            </text>
            {d.value > 0 && (
              <text
                x={padding + i * barW + barW / 2}
                y={y - 3}
                textAnchor="middle"
                className="fill-foreground text-[9px] font-semibold"
              >
                {d.value}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Horizontal bar list (for top items) ────────────────────

export function HorizontalBars({
  items,
  color = 'oklch(0.68 0.195 35)',
  formatValue,
}: {
  items: { label: string; value: number; sublabel?: string; href?: string }[];
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const w = (item.value / max) * 100;
        const inner = (
          <>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{item.label}</span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatValue ? formatValue(item.value) : item.value}
              </span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${w}%`, backgroundColor: color }}
              />
            </div>
            {item.sublabel && (
              <p className="text-muted-foreground mt-1 text-[10px]">{item.sublabel}</p>
            )}
          </>
        );
        return <div key={i}>{inner}</div>;
      })}
    </div>
  );
}
