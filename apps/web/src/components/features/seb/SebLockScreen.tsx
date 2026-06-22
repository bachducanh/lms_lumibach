import { Download, ShieldAlert } from 'lucide-react';

type Props = {
  title: string;
  launchUrl: string | null;
  downloadUrl: string | null | undefined;
};

/**
 * Màn hình chặn khi hoạt động yêu cầu Safe Exam Browser nhưng học sinh đang mở
 * bằng trình duyệt thường. Cung cấp nút mở bằng SEB (giao thức seb://) và nút tải
 * file cấu hình về để mở thủ công.
 */
export function SebLockScreen({ title, launchUrl, downloadUrl }: Props) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="border-border bg-card space-y-5 rounded-2xl border p-8 text-center shadow-lg">
        <div className="bg-primary/10 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
          <ShieldAlert className="text-primary h-8 w-8" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-muted-foreground text-sm">
            Hoạt động này yêu cầu <strong>Safe Exam Browser</strong>. Hãy mở bài bằng SEB theo file
            cấu hình của giáo viên — trình duyệt thường không được phép làm bài.
          </p>
        </div>

        {launchUrl ? (
          <div className="space-y-3">
            <a
              href={launchUrl}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors"
            >
              <ShieldAlert className="h-4 w-4" />
              Mở bằng Safe Exam Browser
            </a>
            {downloadUrl && (
              <a
                href={downloadUrl}
                className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Tải file cấu hình (.seb) để mở thủ công
              </a>
            )}
            <p className="text-muted-foreground text-xs">
              Chưa cài SEB? Tải tại{' '}
              <a
                href="https://safeexambrowser.org/download_en.html"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                safeexambrowser.org
              </a>
              .
            </p>
          </div>
        ) : (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Giáo viên chưa tải lên file cấu hình SEB. Vui lòng liên hệ giáo viên.
          </p>
        )}
      </div>
    </div>
  );
}
