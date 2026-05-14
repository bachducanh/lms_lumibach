'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

type Props = {
  quizQuestionId: string;
  initialPoints: number;
};

export function QuizQuestionPoints({ quizQuestionId, initialPoints }: Props) {
  const [editing, setEditing] = useState(false);
  const [display, setDisplay] = useState(initialPoints);
  const [inputVal, setInputVal] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function openEdit() {
    setInputVal(String(display));
    setEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }

  async function commit() {
    const num = parseFloat(inputVal.replace(',', '.'));
    setEditing(false);
    if (isNaN(num) || num <= 0 || num === display) return;
    setSaving(true);
    const prev = display;
    setDisplay(num);
    try {
      await apiClient.patch(`/quizzes/quiz-questions/${quizQuestionId}/points`, { points: num });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi khi lưu điểm.');
      setDisplay(prev);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0.1"
        step="0.5"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="bg-background border-primary ring-primary w-16 rounded-md border px-1 py-1 text-center text-sm font-bold ring-1 outline-none"
      />
    );
  }

  return (
    <button
      onClick={openEdit}
      disabled={saving}
      title="Click để sửa điểm"
      className="text-muted-foreground bg-muted hover:bg-primary/10 hover:text-primary hover:border-primary/30 shrink-0 rounded-md border border-transparent px-2 py-1 text-sm font-bold transition-colors"
    >
      {saving ? '…' : `${display}đ`}
    </button>
  );
}
