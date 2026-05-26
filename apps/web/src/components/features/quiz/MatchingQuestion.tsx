'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { GripVertical, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MatchPair = { id: string; left: string; right: string };

// ── Stable shuffle so the right column doesn't reshuffle on every render ──
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    h ^= h << 13;
    h ^= h >> 17;
    h ^= h << 5;
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function RightChip({ id, text, idle }: { id: string; text: string; idle?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'border-border bg-background flex touch-none items-center gap-2 rounded-lg border px-3 py-2 text-sm select-none',
        idle && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-30'
      )}
    >
      <GripVertical className="text-muted-foreground/40 h-4 w-4 shrink-0" />
      <span className="flex-1">{text}</span>
    </div>
  );
}

function Slot({
  leftId,
  rightId,
  rightText,
  onClear,
}: {
  leftId: string;
  rightId: string | undefined;
  rightText: string | undefined;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${leftId}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[2.75rem] flex-1 items-center rounded-lg border border-dashed px-2 py-1 transition-colors',
        isOver
          ? 'border-primary bg-primary/10'
          : rightId
            ? 'border-border bg-muted/20 border-solid'
            : 'border-muted-foreground/30 bg-muted/10'
      )}
    >
      {rightId ? (
        <div className="flex w-full items-center gap-1">
          <div className="flex-1">
            <RightChip id={rightId} text={rightText ?? '?'} idle />
          </div>
          <button
            type="button"
            onClick={onClear}
            className="text-muted-foreground/50 hover:text-destructive shrink-0 p-1 transition-colors"
            aria-label="Bỏ ghép"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <span className="text-muted-foreground/50 px-1 text-xs">Kéo đáp án vào đây…</span>
      )}
    </div>
  );
}

type Props = {
  pairs: MatchPair[];
  /** map: leftId → rightId */
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  shuffleSeed?: string;
};

export function MatchingQuestion({ pairs, value, onChange, shuffleSeed = '' }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rightOrder] = useState<string[]>(() =>
    seededShuffle(
      pairs.map((p) => p.id),
      shuffleSeed || pairs.map((p) => p.id).join(',')
    )
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const rightText = (id: string) => pairs.find((p) => p.id === id)?.right ?? '?';
  const assignedRightIds = new Set(Object.values(value));
  const bankRightIds = rightOrder.filter((id) => !assignedRightIds.has(id));

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const rightId = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over) return;
    const next = { ...value };
    // A right can sit in only one slot — pull it out of any current slot first.
    for (const k of Object.keys(next)) if (next[k] === rightId) delete next[k];
    if (over.startsWith('slot-')) {
      const leftId = over.slice('slot-'.length);
      next[leftId] = rightId; // any right previously here becomes unassigned → back to bank
    }
    // over === 'bank' → leave unassigned
    onChange(next);
  }

  function clearSlot(leftId: string) {
    const next = { ...value };
    delete next[leftId];
    onChange(next);
  }

  const { setNodeRef: setBankRef, isOver: bankOver } = useDroppable({ id: 'bank' });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Left column — prompts + drop slots */}
        <div className="space-y-2">
          {pairs.map((p, i) => (
            <div key={p.id} className="flex items-stretch gap-2">
              <div className="border-border bg-muted/20 flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <span className="bg-muted text-muted-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 break-words">{p.left}</span>
              </div>
              <ArrowRight className="text-muted-foreground/40 mt-3 h-4 w-4 shrink-0" />
              <Slot
                leftId={p.id}
                rightId={value[p.id]}
                rightText={value[p.id] ? rightText(value[p.id]!) : undefined}
                onClear={() => clearSlot(p.id)}
              />
            </div>
          ))}
        </div>

        {/* Right column — the answer bank */}
        <div
          ref={setBankRef}
          className={cn(
            'space-y-2 rounded-xl border border-dashed p-3 transition-colors',
            bankOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/10'
          )}
        >
          <p className="text-muted-foreground mb-1 text-xs font-medium">
            Đáp án (kéo sang bên trái)
          </p>
          {bankRightIds.length === 0 ? (
            <p className="text-muted-foreground/50 py-2 text-center text-xs italic">
              Đã ghép hết — kéo về đây nếu muốn bỏ ghép.
            </p>
          ) : (
            bankRightIds.map((id) => <RightChip key={id} id={id} text={rightText(id)} idle />)
          )}
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          <div className="border-primary bg-card flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg">
            <GripVertical className="text-muted-foreground/40 h-4 w-4 shrink-0" />
            <span className="flex-1">{rightText(activeId)}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
