'use client';

import { useState } from 'react';

// ── Sparkline / Line chart ──────────────────────────────────

function formatShortDate(iso: string): string {
  // "2026-05-17" → "17/5"
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${parseInt(m[3]!, 10)}/${parseInt(m[2]!, 10)}`;
}

function niceMax(raw: number): number {
  if (raw <= 1) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  let n: number;
  if (f <= 1) n = 1;
  else if (f <= 2) n = 2;
  else if (f <= 5) n = 5;
  else n = 10;
  return n * exp;
}

export function LineChart({
  data,
  height = 80,
  color = 'oklch(0.68 0.195 35)',
  showAxis = false,
  fill = true,
  yLabel,
}: {
  data: { date: string; value: number }[];
  height?: number;
  color?: string;
  showAxis?: boolean;
  fill?: boolean;
  yLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return null;

  const w = 600;
  const padLeft = showAxis ? 36 : 6;
  const padRight = 8;
  const padTop = showAxis ? 14 : 6;
  const padBottom = showAxis ? 22 : 6;
  const chartW = w - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const rawMax = Math.max(...data.map((d) => d.value), 1);
  const max = niceMax(rawMax);
  const stepX = data.length > 1 ? chartW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padLeft + i * stepX;
    const y = padTop + chartH - (d.value / max) * chartH;
    return { x, y, ...d };
  });

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    points.length > 0
      ? `${path} L ${points[points.length - 1]!.x.toFixed(1)} ${(padTop + chartH).toFixed(1)} L ${points[0]!.x.toFixed(1)} ${(padTop + chartH).toFixed(1)} Z`
      : '';

  // Y-axis ticks: 0, 25%, 50%, 75%, 100% of max
  const yTicks = showAxis ? [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(max * r)) : [];
  // Remove duplicate ticks (when max is small e.g. 1)
  const uniqueYTicks = [...new Set(yTicks)];

  // X-axis ticks: first, ~middle, last (skip if too few points)
  const xTickIndices: number[] =
    data.length <= 1
      ? [0]
      : data.length <= 4
        ? data.map((_, i) => i)
        : [
            0,
            Math.floor(data.length / 4),
            Math.floor(data.length / 2),
            Math.floor((3 * data.length) / 4),
            data.length - 1,
          ];

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full">
      {showAxis && (
        <>
          {/* Horizontal grid + Y labels */}
          {uniqueYTicks.map((t) => {
            const y = padTop + chartH - (t / max) * chartH;
            return (
              <g key={`yt-${t}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + chartW}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  strokeDasharray={t === 0 ? '' : '2 3'}
                  className="text-border"
                  opacity={t === 0 ? 0.9 : 0.45}
                />
                <text
                  x={padLeft - 4}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[9px] tabular-nums"
                >
                  {t}
                </text>
              </g>
            );
          })}
          {/* Y-axis line */}
          <line
            x1={padLeft}
            y1={padTop}
            x2={padLeft}
            y2={padTop + chartH}
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-border"
          />
          {/* X-axis tick labels */}
          {xTickIndices.map((i) => {
            const p = points[i];
            if (!p) return null;
            return (
              <text
                key={`xt-${i}`}
                x={p.x}
                y={padTop + chartH + 14}
                textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
                className="fill-muted-foreground text-[9px] tabular-nums"
              >
                {formatShortDate(p.date)}
              </text>
            );
          })}
          {/* Y label / unit */}
          {yLabel && (
            <text
              x={padLeft}
              y={padTop - 4}
              textAnchor="start"
              className="fill-muted-foreground text-[9px]"
            >
              {yLabel}
            </text>
          )}
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
          {/* Always-visible small dot so users see actual data points */}
          <circle cx={p.x} cy={p.y} r={1.5} fill={color} opacity={0.75} />
          <circle
            cx={p.x}
            cy={p.y}
            r={hover === i ? 4 : 0}
            fill={color}
            className="transition-all"
          />
          <rect
            x={p.x - stepX / 2}
            y={padTop}
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
            y1={padTop}
            x2={points[hover]!.x}
            y2={padTop + chartH}
            stroke={color}
            strokeDasharray="2 2"
            strokeWidth="0.8"
            opacity={0.6}
          />
          <text
            x={Math.min(Math.max(points[hover]!.x, padLeft + 40), padLeft + chartW - 40)}
            y={Math.max(points[hover]!.y - 8, padTop + 8)}
            textAnchor="middle"
            className="fill-foreground text-[10px] font-semibold"
          >
            {points[hover]!.value} · {formatShortDate(points[hover]!.date)}
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
  yLabel,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  yLabel?: string;
}) {
  if (data.length === 0) return null;
  const w = 600;
  const padLeft = 36;
  const padRight = 8;
  const padTop = 18;
  const padBottom = 36;
  const chartW = w - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const rawMax = Math.max(...data.map((d) => d.value), 1);
  const max = niceMax(rawMax);
  const barW = chartW / data.length;
  const yTicks = [...new Set([0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(max * r)))];

  // If labels are long, rotate them
  const needRotate = data.some((d) => d.label.length > 6) || data.length > 6;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full">
      {/* Y grid + labels */}
      {yTicks.map((t) => {
        const y = padTop + chartH - (t / max) * chartH;
        return (
          <g key={`yt-${t}`}>
            <line
              x1={padLeft}
              y1={y}
              x2={padLeft + chartW}
              y2={y}
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray={t === 0 ? '' : '2 3'}
              className="text-border"
              opacity={t === 0 ? 0.9 : 0.4}
            />
            <text
              x={padLeft - 4}
              y={y + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[9px] tabular-nums"
            >
              {t}
            </text>
          </g>
        );
      })}
      {/* Y label */}
      {yLabel && (
        <text
          x={padLeft}
          y={padTop - 6}
          textAnchor="start"
          className="fill-muted-foreground text-[9px]"
        >
          {yLabel}
        </text>
      )}
      {data.map((d, i) => {
        const h = (d.value / max) * chartH;
        const x = padLeft + i * barW + barW * 0.15;
        const y = padTop + chartH - h;
        const cx = padLeft + i * barW + barW / 2;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW * 0.7} height={Math.max(h, 0)} fill={color} rx={2}>
              <title>{`${d.label}: ${d.value}`}</title>
            </rect>
            {needRotate ? (
              <text
                x={cx}
                y={padTop + chartH + 14}
                textAnchor="end"
                transform={`rotate(-30 ${cx} ${padTop + chartH + 14})`}
                className="fill-muted-foreground text-[9px]"
              >
                {d.label}
              </text>
            ) : (
              <text
                x={cx}
                y={padTop + chartH + 14}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px]"
              >
                {d.label}
              </text>
            )}
            {d.value > 0 && (
              <text
                x={cx}
                y={y - 3}
                textAnchor="middle"
                className="fill-foreground text-[9px] font-semibold tabular-nums"
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
