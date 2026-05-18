'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ParsonsLine = { id: string; content: string };

function SortableLine({ id, content, index }: { id: string; content: string; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'border-border bg-background flex items-center gap-2 rounded-lg border px-3 py-2 select-none',
        isDragging && 'border-primary/50 z-50 opacity-50 shadow-lg'
      )}
    >
      <span className="text-muted-foreground w-5 shrink-0 text-right text-xs tabular-nums">
        {index + 1}
      </span>
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 cursor-grab touch-none active:cursor-grabbing"
        aria-label="Kéo để sắp xếp"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <pre className="flex-1 overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre">
        {content}
      </pre>
    </div>
  );
}

type Props = {
  initialLines: ParsonsLine[];
  onChange: (orderedIds: string[]) => void;
  readOnly?: boolean;
};

export function ParsonsQuestion({ initialLines, onChange, readOnly = false }: Props) {
  const [items, setItems] = useState<ParsonsLine[]>(initialLines);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    // Notify parent *outside* the setState updater to avoid the
    // "cannot update a component while rendering" warning.
    onChange(next.map((i) => i.id));
  }

  if (readOnly) {
    return (
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="border-border bg-background flex items-center gap-2 rounded-lg border px-3 py-2"
          >
            <span className="text-muted-foreground w-5 shrink-0 text-right text-xs tabular-nums">
              {idx + 1}
            </span>
            <pre className="flex-1 overflow-x-auto font-mono text-sm leading-relaxed whitespace-pre">
              {item.content}
            </pre>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {items.map((item, idx) => (
            <SortableLine key={item.id} id={item.id} content={item.content} index={idx} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
