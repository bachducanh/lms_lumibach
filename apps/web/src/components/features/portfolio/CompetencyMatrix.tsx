'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  COMPETENCY_LEVELS,
  EVIDENCE_TYPE_LABEL,
  type CompetencyEvidenceRow,
  type CompetencyLevelValue,
  type CompetencyMatrixData,
} from '@lumibach/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronRight, ExternalLink } from 'lucide-react';

const LEVEL_BY_VALUE: Map<CompetencyLevelValue, (typeof COMPETENCY_LEVELS)[number]> = new Map(
  COMPETENCY_LEVELS.map((level) => [level.value, level] as const)
);

// Build full URL từ viewerPath do BE trả (đã chứa /assignments/X/...).
function fullViewerUrl(slug: string, viewerPath: string | null): string | null {
  if (!viewerPath) return null;
  return `/courses/${slug}${viewerPath}`;
}

type Props = {
  matrix: CompetencyMatrixData;
  evidence?: CompetencyEvidenceRow[];
  // Khi cả 2 prop dưới đây có, mỗi dòng minh chứng sẽ có nút "Xem bài làm".
  courseSlug?: string;
};

type DrillState = {
  indicatorId: string;
  indicatorLabel: string;
  moduleId: string;
  moduleName: string;
};

export function CompetencyMatrix({ matrix, evidence = [], courseSlug }: Props) {
  const { modules, categories, cells } = matrix;
  const totalIndicators = categories.reduce((sum, c) => sum + c.indicators.length, 0);
  const [drill, setDrill] = useState<DrillState | null>(null);

  // Index evidence by (indicatorId, moduleId) for fast lookup
  const evidenceByKey = useMemo(() => {
    const map = new Map<string, CompetencyEvidenceRow[]>();
    for (const ev of evidence) {
      if (!ev.moduleId) continue;
      const key = `${ev.indicatorId}::${ev.moduleId}`;
      const arr = map.get(key) ?? [];
      arr.push(ev);
      map.set(key, arr);
    }
    return map;
  }, [evidence]);

  if (totalIndicators === 0) {
    return (
      <div className="border-border bg-card rounded-lg border border-dashed px-5 py-8 text-center">
        <p className="text-muted-foreground text-sm">
          Khoá học chưa có chỉ báo năng lực để vẽ ma trận.
        </p>
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="border-border bg-card rounded-lg border border-dashed px-5 py-8 text-center">
        <p className="text-muted-foreground text-sm">
          Khoá học chưa có chương/module để hiển thị theo U1, U2...
        </p>
      </div>
    );
  }

  const cellMap = new Map(cells.map((cell) => [`${cell.indicatorId}::${cell.moduleId}`, cell]));
  const totalCols = modules.length + 2;

  const drillEvidence = drill
    ? (evidenceByKey.get(`${drill.indicatorId}::${drill.moduleId}`) ?? [])
    : [];

  return (
    <>
      <div className="border-border bg-card overflow-hidden rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#202765] text-white">
                <th
                  rowSpan={2}
                  className="w-[92px] border-r border-white/25 px-3 py-4 text-center font-bold uppercase"
                >
                  Năng lực
                </th>
                <th
                  rowSpan={2}
                  className="min-w-[360px] border-r border-white/25 px-3 py-4 text-left font-bold uppercase"
                >
                  Chỉ báo
                </th>
                <th
                  colSpan={modules.length}
                  className="border-b border-white/25 px-3 py-3 text-center text-xs font-semibold italic"
                >
                  Mức độ hoàn thành chỉ báo ghi nhận tại các sản phẩm học tập
                </th>
              </tr>
              <tr className="bg-[#252d70] text-white">
                {modules.map((m, index) => (
                  <th
                    key={m.id}
                    className="min-w-[150px] border-r border-white/20 px-3 py-3 text-center text-xs font-bold"
                    title={m.name}
                  >
                    <span>U{index + 1}</span>
                    <span className="mx-auto mt-1 block max-w-[140px] truncate text-[10px] font-medium opacity-75">
                      {m.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <CategoryBlock
                  key={cat.id}
                  category={cat}
                  modules={modules}
                  cellMap={cellMap}
                  evidenceByKey={evidenceByKey}
                  totalCols={totalCols}
                  onDrill={(state) => setDrill(state)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={drill !== null} onOpenChange={(o) => !o && setDrill(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Minh chứng tại {drill?.moduleName}</DialogTitle>
            <DialogDescription className="line-clamp-2">{drill?.indicatorLabel}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {drillEvidence.length === 0 ? (
              <p className="text-muted-foreground text-sm">Không có minh chứng cụ thể.</p>
            ) : (
              drillEvidence.map((ev) => {
                const meta = LEVEL_BY_VALUE.get(ev.level);
                const href = courseSlug ? fullViewerUrl(courseSlug, ev.viewerPath) : null;
                return (
                  <div
                    key={ev.assessmentId}
                    className="border-border bg-card/60 rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{ev.activityTitle}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {ev.evidenceType
                            ? (EVIDENCE_TYPE_LABEL[ev.evidenceType] ?? ev.evidenceType)
                            : 'Chưa chọn loại minh chứng'}
                          {' · '}
                          {new Intl.DateTimeFormat('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          }).format(new Date(ev.gradedAt))}
                        </p>
                      </div>
                      {meta && (
                        <span
                          className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: meta.color, color: meta.textColor }}
                        >
                          {meta.short}
                        </span>
                      )}
                    </div>
                    {ev.note && (
                      <p className="bg-muted/40 mt-2 rounded-md p-2 text-xs leading-relaxed whitespace-pre-line">
                        {ev.note}
                      </p>
                    )}
                    {href && (
                      <div className="mt-2 flex justify-end">
                        <Link
                          href={href}
                          target="_blank"
                          className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Xem bài làm của học sinh
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDrill(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CategoryBlock({
  category,
  modules,
  cellMap,
  evidenceByKey,
  totalCols,
  onDrill,
}: {
  category: CompetencyMatrixData['categories'][number];
  modules: CompetencyMatrixData['modules'];
  cellMap: Map<string, CompetencyMatrixData['cells'][number]>;
  evidenceByKey: Map<string, CompetencyEvidenceRow[]>;
  totalCols: number;
  onDrill: (state: DrillState) => void;
}) {
  return (
    <>
      <tr className="bg-sky-500/20">
        <td
          colSpan={totalCols}
          className="border-border/70 px-3 py-2 text-xs font-bold tracking-wide uppercase"
        >
          {category.name}
        </td>
      </tr>
      {category.indicators.length === 0 ? (
        <tr>
          <td colSpan={totalCols} className="text-muted-foreground px-3 py-3 text-xs italic">
            Chưa có chỉ báo trong danh mục này.
          </td>
        </tr>
      ) : (
        category.indicators.map((indicator, index) => (
          <tr key={indicator.id} className="border-border/60 hover:bg-muted/20 border-b">
            <td className="bg-card border-r px-3 py-3 text-center align-top font-mono text-xs font-bold">
              {indicator.code?.split('.')[0] ?? index + 1}
            </td>
            <td className="bg-card min-w-[360px] border-r px-3 py-3 align-top">
              <div className="flex gap-3">
                <span className="text-primary w-12 shrink-0 font-mono text-xs font-bold">
                  {indicator.code ?? `${index + 1}`}
                </span>
                <p className="text-xs leading-relaxed">{indicator.name}</p>
              </div>
            </td>
            {modules.map((module) => {
              const cell = cellMap.get(`${indicator.id}::${module.id}`);
              const evCount = evidenceByKey.get(`${indicator.id}::${module.id}`)?.length ?? 0;
              return (
                <td key={module.id} className="border-r px-3 py-2 align-middle">
                  {cell ? (
                    <CellPill
                      level={cell.level}
                      count={cell.count}
                      hasEvidence={evCount > 0}
                      onClick={
                        evCount > 0
                          ? () =>
                              onDrill({
                                indicatorId: indicator.id,
                                indicatorLabel: `${indicator.code ? indicator.code + ' · ' : ''}${indicator.name}`,
                                moduleId: module.id,
                                moduleName: module.name,
                              })
                          : undefined
                      }
                    />
                  ) : (
                    <EmptyDash />
                  )}
                </td>
              );
            })}
          </tr>
        ))
      )}
    </>
  );
}

function CellPill({
  level,
  count,
  hasEvidence,
  onClick,
}: {
  level: CompetencyLevelValue;
  count: number;
  hasEvidence: boolean;
  onClick?: () => void;
}) {
  const meta = LEVEL_BY_VALUE.get(level);
  if (!meta) return <EmptyDash />;

  const pill = (
    <span
      className="inline-flex h-6 w-full min-w-32 items-center justify-between rounded-full px-3 text-[11px] font-semibold shadow-sm"
      style={{ backgroundColor: meta.color, color: meta.textColor }}
      title={`${meta.label}${count > 1 ? ` · ${count} lượt đánh giá` : ''}`}
    >
      <span className="truncate">{meta.label}</span>
      {count > 1 && <span className="ml-2 opacity-80">{count}</span>}
    </span>
  );

  if (!hasEvidence || !onClick) {
    return <div className="flex flex-col gap-1">{pill}</div>;
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      {pill}
      <button
        type="button"
        onClick={onClick}
        className="text-primary hover:text-primary/80 inline-flex w-full items-center justify-center gap-0.5 text-[10px] font-medium underline-offset-2 hover:underline"
      >
        Xem minh chứng <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function EmptyDash() {
  return (
    <span className="border-border bg-muted/30 text-muted-foreground/60 inline-flex h-6 w-full min-w-32 items-center justify-center rounded-full border text-[11px]">
      Chưa ghi nhận
    </span>
  );
}
