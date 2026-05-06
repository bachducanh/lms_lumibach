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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 select-none',
        isDragging && 'opacity-50 shadow-lg border-primary/50 z-50',
      )}
    >
      <span className="text-xs text-muted-foreground w-5 shrink-0 text-right tabular-nums">{index + 1}</span>
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0 touch-none"
        aria-label="Kéo để sắp xếp"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <pre className="flex-1 font-mono text-sm overflow-x-auto whitespace-pre leading-relaxed">{content}</pre>
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
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      onChange(next.map((i) => i.id));
      return next;
    });
  }

  if (readOnly) {
    return (
      <div className="space-y-1.5">
        {items.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <span className="text-xs text-muted-foreground w-5 shrink-0 text-right tabular-nums">{idx + 1}</span>
            <pre className="flex-1 font-mono text-sm overflow-x-auto whitespace-pre leading-relaxed">{item.content}</pre>
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
