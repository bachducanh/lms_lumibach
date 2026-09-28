'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
} from '@dnd-kit/core';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Mảnh dùng chung cho hai kho của ngân hàng chung — kho câu hỏi và kho nội dung
 * — cùng dạng cây thư mục, cùng kéo thả, cùng tích chọn nhiều. Để chung một
 * chỗ cho hai màn hình không lệch nhau về cách bấm, cách kéo.
 */

// ── Chọn nhiều ────────────────────────────────────────────────

export type BoChon = {
  daChon: (id: string) => boolean;
  dao: (id: string) => void;
  datNhieu: (ids: string[], chon: boolean) => void;
  boHet: () => void;
  /** Id đang chọn, kể cả id của mục vừa biến mất — nơi dùng tự lọc theo dữ liệu hiện có. */
  ids: Set<string>;
};

export function useBoChon(): BoChon {
  const [ids, setIds] = useState<Set<string>>(new Set());
  return {
    ids,
    daChon: (id) => ids.has(id),
    dao: (id) =>
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    datNhieu: (list, bat) =>
      setIds((prev) => {
        const next = new Set(prev);
        for (const id of list) {
          if (bat) next.add(id);
          else next.delete(id);
        }
        return next;
      }),
    boHet: () => setIds(new Set()),
  };
}

export function HopChon({
  checked,
  indeterminate = false,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // `indeterminate` không có thuộc tính HTML tương ứng, chỉ đặt được qua DOM.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      // Dòng bấm vào là mở/đóng hay đi tới trình soạn — tick ô chọn không được kéo theo.
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      className="border-input accent-primary h-4 w-4 shrink-0 cursor-pointer rounded disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

/** Ô chọn cả nhóm: tick khi đã chọn hết, gạch ngang khi mới chọn một phần. */
export function HopChonNhom({ ids, chon, label }: { ids: string[]; chon: BoChon; label: string }) {
  const soDaChon = ids.filter(chon.daChon).length;
  return (
    <HopChon
      checked={ids.length > 0 && soDaChon === ids.length}
      indeterminate={soDaChon > 0 && soDaChon < ids.length}
      disabled={ids.length === 0}
      onChange={() => chon.datNhieu(ids, soDaChon < ids.length)}
      label={label}
    />
  );
}

// ── Ô nhập tên thư mục mới ────────────────────────────────────

export function NhapTenThuMuc({
  placeholder,
  pending,
  onLuu,
  onHuy,
}: {
  placeholder: string;
  pending: boolean;
  onLuu: (ten: string) => void;
  onHuy: () => void;
}) {
  const [ten, setTen] = useState('');
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={ten}
        onChange={(e) => setTen(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && ten.trim()) onLuu(ten.trim());
          if (e.key === 'Escape') onHuy();
        }}
        placeholder={placeholder}
        className="border-input bg-background h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm"
      />
      <button
        type="button"
        onClick={() => onLuu(ten.trim())}
        disabled={pending || !ten.trim()}
        className={buttonVariants({ size: 'sm' })}
      >
        Lưu
      </button>
      <button
        type="button"
        onClick={onHuy}
        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
      >
        Huỷ
      </button>
    </div>
  );
}

// ── Kéo thả ───────────────────────────────────────────────────

/** Chuột: rê 6px mới tính là kéo. Máy tính bảng: nhấn giữ để vuốt cuộn trang vẫn cuộn. */
export function useCamBienKeo() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );
}

// Chỉ nhận chỗ thả nằm ĐÚNG dưới con trỏ. Tính theo phần giao với khung kéo thì
// hay trúng nhầm thư mục bên cạnh (các tiêu đề xếp sát nhau). Và tuyệt đối không
// "lấy chỗ gần nhất" khi con trỏ không nằm trên chỗ nào nhận được: thả vào thư
// mục con của chính nó (bị khoá) mà lại được đưa sang một thư mục bên cạnh thì
// cây bị xáo mà người dùng không hề chủ ý. Không cần cho bàn phím: các màn này
// không kéo bằng phím, đã có nút "Chuyển tới…".
export const vaChamTheoConTro: CollisionDetection = (args) => pointerWithin(args);

/** Một chỗ thả không phải thư mục: "chưa xếp thư mục", "cấp ngoài cùng"… */
export function VungTha({
  id,
  data,
  children,
  className,
}: {
  id: string;
  data: Record<string, unknown>;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg transition-colors',
        isOver && 'bg-primary/10 ring-primary ring-2',
        className
      )}
    >
      {children}
    </div>
  );
}
