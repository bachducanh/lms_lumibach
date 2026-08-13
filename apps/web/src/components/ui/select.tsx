'use client';

import * as React from 'react';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Ô chọn dựng trên Base UI, thay cho `<select>` gốc của trình duyệt.
 *
 * Lý do thay: `<select>` mở ra danh sách do hệ điều hành vẽ — nền trắng, phông
 * hệ thống, bo góc vuông — nên ở giao diện tối của dự án nó lạc hẳn ra và không
 * theo được bảng màu. Bản này dùng chung token màu, bo góc và hiệu ứng với
 * dropdown-menu sẵn có.
 */
function Select<T>({ ...props }: SelectPrimitive.Root.Props<T>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: SelectPrimitive.Trigger.Props & { size?: 'sm' | 'default' }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        'border-input bg-background text-foreground hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-ring/50',
        'data-popup-open:border-ring/60 data-popup-open:bg-muted/50',
        'inline-flex w-fit items-center justify-between gap-2 rounded-lg border px-3 text-sm',
        'transition-colors outline-none focus-visible:ring-[3px]',
        'disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'h-8' : 'h-9',
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="text-muted-foreground shrink-0">
        <ChevronsUpDownIcon className="h-3.5 w-3.5" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn('truncate text-left', className)}
      {...props}
    />
  );
}

function SelectContent({
  className,
  children,
  sideOffset = 6,
  ...props
}: SelectPrimitive.Popup.Props & Pick<SelectPrimitive.Positioner.Props, 'sideOffset'>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        className="isolate z-50 outline-none"
        sideOffset={sideOffset}
        alignItemWithTrigger={false}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            'bg-popover/95 text-popover-foreground border-border/70 ring-foreground/10',
            'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
            'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            'max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin)',
            'overflow-y-auto rounded-lg border p-1.5 ring-1 backdrop-blur-xl duration-100 outline-none',
            'shadow-[0_18px_48px_oklch(0_0_0_/_0.22)]',
            className
          )}
          {...props}
        >
          {children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'data-highlighted:bg-muted data-highlighted:text-foreground',
        'relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-7 text-sm',
        'outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50',
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator className="text-primary absolute left-1.5 flex items-center">
        <CheckIcon className="h-3.5 w-3.5" />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="truncate">{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('bg-border -mx-1.5 my-1.5 h-px', className)} {...props} />;
}

export type SimpleSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /**
   * Tên nhóm, thay cho `<optgroup>` của thẻ select gốc. Các mục cùng tên nhóm
   * được gom lại và in một dòng tiêu đề phía trên. Bỏ trống thì mục đứng riêng
   * ở đầu danh sách.
   */
  group?: string;
};

/**
 * Bản rút gọn cho trường hợp phổ biến nhất: một danh sách phẳng {value, label}.
 *
 * Có chữ ký gần giống `<select>` gốc (`value` + `onValueChange`) để đổi từ thẻ
 * gốc sang mà không phải dựng lại cả cụm Trigger/Content/Item ở từng chỗ.
 */
function SimpleSelect({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder,
  disabled,
  size = 'default',
  className,
  id,
  name,
  'aria-label': ariaLabel,
}: {
  /** Bỏ trống khi dùng kiểu không kiểm soát — khi đó truyền `defaultValue`. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: readonly SimpleSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'default';
  className?: string;
  id?: string;
  /** Đặt tên để gửi kèm form gửi kiểu native — Base UI tự dựng input ẩn. */
  name?: string;
  'aria-label'?: string;
}) {
  return (
    <Select
      value={value}
      defaultValue={defaultValue}
      name={name}
      onValueChange={(v) => onValueChange?.((v as string) ?? '')}
      disabled={disabled}
      items={options.map((o) => ({ label: o.label, value: o.value }))}
    >
      <SelectTrigger id={id} size={size} aria-label={ariaLabel} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {gomTheoNhom(options).map(({ group, items }) => (
          <React.Fragment key={group ?? '__khong_nhom__'}>
            {group && (
              <div className="text-muted-foreground px-2 py-1.5 text-xs font-semibold">{group}</div>
            )}
            {items.map((o) => (
              <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </SelectItem>
            ))}
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Gom mục theo `group`, giữ nguyên thứ tự nhóm xuất hiện lần đầu. */
function gomTheoNhom(options: readonly SimpleSelectOption[]) {
  const thuTu: (string | undefined)[] = [];
  const theoNhom = new Map<string | undefined, SimpleSelectOption[]>();

  for (const o of options) {
    if (!theoNhom.has(o.group)) {
      theoNhom.set(o.group, []);
      thuTu.push(o.group);
    }
    theoNhom.get(o.group)!.push(o);
  }

  return thuTu.map((group) => ({ group, items: theoNhom.get(group) ?? [] }));
}

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SimpleSelect,
};
