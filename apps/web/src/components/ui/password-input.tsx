'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Ô nhập mật khẩu có nút con mắt để xem lại chuỗi vừa gõ.
 *
 * Vì sao cần: mật khẩu bị che hoàn toàn nên gõ sai một ký tự là phải xoá hết gõ
 * lại, và trên điện thoại kiểu gõ có dấu lại càng dễ sai. Cho người dùng tự bật
 * nhìn là cách sửa rẻ nhất — quyền quyết định thuộc về họ, ai ngồi chỗ đông
 * người thì cứ để nguyên trạng thái che.
 *
 * Nút nằm TRONG ô (không phải bên cạnh) để không phá lưới form, và `tabIndex={-1}`
 * để phím Tab vẫn đi thẳng từ ô mật khẩu xuống nút gửi như thói quen cũ.
 */
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={visible}
        title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-1.5 transition-colors outline-none focus-visible:ring-3"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

export { PasswordInput };
