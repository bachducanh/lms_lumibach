'use client';

import { Eye } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

type Props = {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  screenshot: boolean;
  onScreenshotChange: (value: boolean) => void;
  /** Chuỗi từ ô nhập; rỗng = không tự nộp. */
  maxLeaves: string;
  onMaxLeavesChange: (value: string) => void;
};

/**
 * Cấu hình giám sát rời bài cho quiz. Khác Safe Exam Browser: không khoá máy,
 * học sinh vẫn làm bằng trình duyệt thường, nhưng mỗi lần rời trang làm bài đều
 * bị ghi lại (và chụp màn hình nếu bật).
 */
export function ProctorSettings({
  enabled,
  onEnabledChange,
  screenshot,
  onScreenshotChange,
  maxLeaves,
  onMaxLeavesChange,
}: Props) {
  const n = maxLeaves.trim() === '' ? null : Number(maxLeaves);

  return (
    <div className="border-border bg-muted/20 space-y-4 rounded-xl border p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <Switch checked={enabled} onCheckedChange={onEnabledChange} className="mt-0.5" />
        <span className="space-y-0.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <Eye className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            Giám sát rời bài
          </span>
          <span className="text-muted-foreground block text-xs">
            Ghi lại mỗi lần học sinh rời khỏi trang làm bài: chuyển tab, chuyển cửa sổ, thu nhỏ
            trình duyệt, đóng/tải lại trang hoặc mở trang khác. Giáo viên xem số lần, thời gian rời
            ở trang Bài làm.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="border-border space-y-4 border-t border-dashed pt-3 pl-1">
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3">
              <Switch
                checked={screenshot}
                onCheckedChange={onScreenshotChange}
                className="mt-0.5"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">
                  Chụp màn hình minh chứng khi rời bài
                </span>
                <span className="text-muted-foreground block text-xs">
                  Học sinh phải chia sẻ <strong>toàn bộ màn hình</strong> trước khi vào bài; mỗi lần
                  rời bài hệ thống chụp vài ảnh màn hình. Chỉ làm được trên máy tính (Chrome, Edge,
                  Firefox) — điện thoại và máy tính bảng sẽ không vào được bài.
                </span>
              </span>
            </label>
            {!screenshot && (
              <p className="text-muted-foreground pl-12 text-xs">
                Tắt chụp màn hình: chỉ đếm số lần và thời gian rời bài, làm được trên mọi thiết bị.
              </p>
            )}
          </div>

          <div className="space-y-1.5 pl-12">
            <label htmlFor="proctor-max-leaves" className="block text-sm font-medium">
              Tự động nộp bài khi rời quá
            </label>
            <div className="flex items-center gap-2">
              <input
                id="proctor-max-leaves"
                type="number"
                min={0}
                max={100}
                step={1}
                value={maxLeaves}
                onChange={(e) => onMaxLeavesChange(e.target.value)}
                placeholder="Không tự nộp"
                className="border-input bg-background focus:ring-ring w-32 rounded-lg border px-3 py-1.5 text-sm focus:ring-1 focus:outline-none"
              />
              <span className="text-muted-foreground text-sm">lần</span>
            </div>
            <p className="text-muted-foreground text-xs">
              {n === null || Number.isNaN(n)
                ? 'Để trống: chỉ ghi nhận, không tự nộp.'
                : n <= 0
                  ? 'Đặt 0: rời bài lần đầu tiên là bài bị nộp ngay.'
                  : `Học sinh được rời tối đa ${n} lần; rời lần thứ ${n + 1} bài sẽ tự động nộp. Học sinh thấy số lần còn lại sau mỗi lần rời.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
