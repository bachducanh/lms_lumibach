'use client';

import type { HandoverFieldDto } from '@lumibach/types';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type GiaTriTruong = string | number | boolean | null;

/**
 * Một ô nhập của trường bàn giao động, dựng theo `dataType` do admin cấu hình.
 *
 * Thiết kế cho điện thoại: ô số dùng `inputMode="numeric"` để bật bàn phím số,
 * ô có/không dùng hai nút to thay vì công tắc nhỏ khó bấm bằng ngón tay.
 */
export function HandoverFieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: HandoverFieldDto;
  value: GiaTriTruong;
  onChange: (value: GiaTriTruong) => void;
  disabled?: boolean;
}) {
  const id = `truong-${field.key}`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {field.label}
        {field.isRequired && <span className="text-destructive ml-1">*</span>}
      </label>

      {field.dataType === 'NUMBER' && (
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          className="h-11 text-base"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          disabled={disabled}
        />
      )}

      {field.dataType === 'TEXT' && (
        <Input
          id={id}
          className="h-11 text-base"
          maxLength={500}
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}

      {field.dataType === 'SELECT' && (
        <Select
          value={value === null || value === undefined ? '' : String(value)}
          onValueChange={(v) => onChange((v as string) || null)}
          disabled={disabled}
          items={[
            { label: '— Chọn —', value: '' },
            ...(field.options ?? []).map((o) => ({ label: o, value: o })),
          ]}
        >
          <SelectTrigger id={id} className="h-11 w-full text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">— Chọn —</SelectItem>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.dataType === 'BOOLEAN' && (
        <div className="flex gap-2" role="group" aria-labelledby={id}>
          {[
            { nhan: 'Có', val: true },
            { nhan: 'Không', val: false },
          ].map((o) => (
            <button
              key={o.nhan}
              type="button"
              disabled={disabled}
              onClick={() => onChange(o.val)}
              className={
                value === o.val
                  ? 'bg-primary text-primary-foreground h-11 flex-1 rounded-lg text-base font-medium'
                  : 'border-input hover:bg-muted h-11 flex-1 rounded-lg border text-base'
              }
            >
              {o.nhan}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
