'use client';

import { CopyX } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

type Props = {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  blockPaste: boolean;
  onBlockPasteChange: (value: boolean) => void;
  watermark: boolean;
  onWatermarkChange: (value: boolean) => void;
};

/**
 * Cấu hình chống sao chép cho quiz. Độc lập với "Giám sát rời bài" — bật cùng
 * lúc được, và chạy cả trên điện thoại (khác chụp màn hình minh chứng).
 */
export function AntiCopySettings({
  enabled,
  onEnabledChange,
  blockPaste,
  onBlockPasteChange,
  watermark,
  onWatermarkChange,
}: Props) {
  return (
    <div className="border-border bg-muted/20 space-y-4 rounded-xl border p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <Switch checked={enabled} onCheckedChange={onEnabledChange} className="mt-0.5" />
        <span className="space-y-0.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <CopyX className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            Chống sao chép đề
          </span>
          <span className="text-muted-foreground block text-xs">
            Học sinh không bôi đen, sao chép, nhấn giữ, chuột phải hay in được nội dung đề — trên cả
            điện thoại lẫn máy tính. Trong ô trả lời vẫn sửa bài bình thường. Bật cùng lúc với
            &quot;Giám sát rời bài&quot; được.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="border-border space-y-3 border-t border-dashed pt-3 pl-1">
          <label className="flex cursor-pointer items-start gap-3">
            <Switch checked={watermark} onCheckedChange={onWatermarkChange} className="mt-0.5" />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">In chìm tên học sinh lên đề</span>
              <span className="text-muted-foreground block text-xs">
                Họ tên, tên đăng nhập và giờ hiện mờ, lặp chéo khắp đề. Trang web{' '}
                <strong>không chặn được việc chụp màn hình</strong> — nhưng ảnh nào bị gửi ra ngoài
                cũng lộ ngay là của ai.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3">
            <Switch checked={blockPaste} onCheckedChange={onBlockPasteChange} className="mt-0.5" />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">
                Chặn dán nội dung từ ngoài vào ô trả lời
              </span>
              <span className="text-muted-foreground block text-xs">
                Không dán được câu trả lời chép từ trang khác hay ứng dụng khác. Dán lại đoạn vừa
                chép ngay trong bài làm (ví dụ sửa code) vẫn được.
              </span>
            </span>
          </label>

          <p className="text-muted-foreground text-xs">
            Lớp làm bằng điện thoại: nên bật thêm &quot;Giám sát rời bài&quot; (tắt chụp màn hình) —
            học sinh phải thoát khỏi trình duyệt mới gửi ảnh chụp đi hay tra cứu được, và lần thoát
            đó bị ghi lại.
          </p>
        </div>
      )}
    </div>
  );
}
