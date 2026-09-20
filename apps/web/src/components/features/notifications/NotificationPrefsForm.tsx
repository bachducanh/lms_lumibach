'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { NotificationPrefs } from '@lumibach/types';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

type Props = { initialPrefs: NotificationPrefs };

type PrefKey = keyof NotificationPrefs;

const EMAIL_TOGGLES: { key: PrefKey; label: string; desc: string }[] = [
  { key: 'emailQuizGraded', label: 'Quiz đã chấm', desc: 'Khi kết quả quiz của bạn được cập nhật' },
  {
    key: 'emailAssignmentGraded',
    label: 'Bài tập đã chấm',
    desc: 'Khi bài tập được giáo viên chấm và trả',
  },
  {
    key: 'emailCodeGraded',
    label: 'Bài code đã chấm',
    desc: 'Khi bài code exercise được chấm xong',
  },
  { key: 'emailEnrolled', label: 'Đăng ký khóa học', desc: 'Khi bạn được thêm vào một khóa học' },
  { key: 'emailDueSoon', label: 'Nhắc nhở sắp đến hạn', desc: 'Trước 24h khi bài tập sắp đến hạn' },
];

export function NotificationPrefsForm({ initialPrefs }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs);
  const [pending, startTransition] = useTransition();

  const toggle = (key: PrefKey) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  };

  const handleSave = () => {
    startTransition(async () => {
      try {
        await apiClient.put('/notifications/preferences', prefs);
        toast.success('Đã lưu cài đặt thông báo.');
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : 'Lỗi khi lưu.';
        toast.error(msg);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* In-app */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold sm:text-xl">Thông báo trong ứng dụng</h2>
        <div className="border-border bg-card flex items-center justify-between gap-4 rounded-xl border p-4 shadow-sm">
          <div className="min-w-0">
            <Label htmlFor="inApp" className="font-medium">
              Hiển thị thông báo
            </Label>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Chuông thông báo trên thanh điều hướng
            </p>
          </div>
          <Switch
            id="inApp"
            checked={prefs.inAppEnabled}
            onCheckedChange={() => toggle('inAppEnabled')}
          />
        </div>
      </div>

      <Separator />

      {/* Email global */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold sm:text-xl">Email thông báo</h2>
        <div className="border-border bg-card flex items-center justify-between gap-4 rounded-xl border p-4 shadow-sm">
          <div className="min-w-0">
            <Label htmlFor="emailGlobal" className="font-medium">
              Nhận email thông báo
            </Label>
            <p className="text-muted-foreground mt-0.5 text-sm">Bật/tắt tất cả email thông báo</p>
          </div>
          <Switch
            id="emailGlobal"
            checked={prefs.emailEnabled}
            onCheckedChange={() => toggle('emailEnabled')}
          />
        </div>

        {prefs.emailEnabled && (
          <div className="space-y-2 sm:pl-2">
            {EMAIL_TOGGLES.map(({ key, label, desc }) => (
              <div
                key={key}
                className="border-border bg-muted/40 flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
              >
                <div className="min-w-0">
                  <Label htmlFor={key} className="text-sm font-medium">
                    {label}
                  </Label>
                  <p className="text-muted-foreground text-sm">{desc}</p>
                </div>
                <Switch
                  id={key}
                  checked={prefs[key] as boolean}
                  onCheckedChange={() => toggle(key)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Lưu cài đặt
      </Button>
    </div>
  );
}
