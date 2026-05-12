'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { saveNotificationPrefsAction, type NotificationPrefs } from '@/actions/notifications';
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
      const result = await saveNotificationPrefsAction(prefs);
      if (result.success) toast.success('Đã lưu cài đặt thông báo.');
      else toast.error(result.error ?? 'Lỗi khi lưu.');
    });
  };

  return (
    <div className="space-y-6">
      {/* In-app */}
      <div className="space-y-3">
        <h2 className="text-base font-medium">Thông báo trong ứng dụng</h2>
        <div className="border-border flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label htmlFor="inApp" className="font-medium">
              Hiển thị thông báo
            </Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
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
        <h2 className="text-base font-medium">Email thông báo</h2>
        <div className="border-border flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label htmlFor="emailGlobal" className="font-medium">
              Nhận email thông báo
            </Label>
            <p className="text-muted-foreground mt-0.5 text-xs">Bật/tắt tất cả email thông báo</p>
          </div>
          <Switch
            id="emailGlobal"
            checked={prefs.emailEnabled}
            onCheckedChange={() => toggle('emailEnabled')}
          />
        </div>

        {prefs.emailEnabled && (
          <div className="space-y-2 pl-1">
            {EMAIL_TOGGLES.map(({ key, label, desc }) => (
              <div
                key={key}
                className="border-border/60 bg-muted/20 flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div>
                  <Label htmlFor={key} className="text-sm font-medium">
                    {label}
                  </Label>
                  <p className="text-muted-foreground text-xs">{desc}</p>
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
