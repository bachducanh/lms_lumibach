'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import {
  vnRangeLabel,
  vnTimeLabel,
  type BookingHandoverSummary,
  type HandoverFieldDto,
  type HandoverPhotoInput,
  type RoomBookingDetail,
} from '@lumibach/types';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RichTextView } from '@/components/ui/editor/RichTextView';
import { HandoverFieldInput, type GiaTriTruong } from './HandoverFieldInput';

type Props = {
  booking: RoomBookingDetail;
  fields: HandoverFieldDto[];
  summary: BookingHandoverSummary;
  type: 'CHECKIN' | 'CHECKOUT';
  photoLimits: { min: number; max: number };
};

type HandoverPhotoDraft = HandoverPhotoInput & {
  name: string;
  previewUrl: string;
};

type UploadResponse = { photo: HandoverPhotoInput } | { error: string };

/**
 * Màn hình nhận phòng / trả phòng.
 *
 * Thiết kế mobile-first: giáo viên đứng ở cửa phòng, cầm điện thoại, cần bấm
 * nhanh và ít thao tác. Ô nhập cao 44px, nút chính rộng hết chiều ngang.
 *
 * Khi trả phòng, mỗi trường hiện kèm giá trị đã ghi lúc nhận để đối chiếu tại
 * chỗ — không phải nhớ hay mở lại màn hình khác.
 */
export function HandoverForm({ booking, fields, summary, type, photoLimits }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const laNhanPhong = type === 'CHECKIN';
  const previewUrlsRef = useRef<string[]>([]);

  const [daDocNoiQuy, setDaDocNoiQuy] = useState(false);
  const [conditionNote, setConditionNote] = useState('');
  const [values, setValues] = useState<Record<string, GiaTriTruong>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, null]))
  );
  const [photos, setPhotos] = useState<HandoverPhotoDraft[]>([]);
  const [loi, setLoi] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  const giaTriLucNhan = useMemo(
    () => (summary.checkin?.fieldValues ?? {}) as Record<string, GiaTriTruong>,
    [summary.checkin]
  );

  /** Cảnh báo ngay tại chỗ khi người dùng nhập số nhỏ hơn lúc nhận. */
  const thieuHut = useMemo(() => {
    if (laNhanPhong) return [];
    return fields
      .filter((f) => f.dataType === 'NUMBER')
      .map((f) => {
        const truoc = giaTriLucNhan[f.key];
        const sau = values[f.key];
        if (typeof truoc !== 'number' || typeof sau !== 'number') return null;
        return sau < truoc ? { label: f.label, thieu: truoc - sau } : null;
      })
      .filter((x): x is { label: string; thieu: number } => x !== null);
  }, [fields, values, giaTriLucNhan, laNhanPhong]);

  function guiDi() {
    setLoi(null);

    if (laNhanPhong && !daDocNoiQuy) {
      setLoi('Vui lòng xác nhận đã đọc nội quy phòng.');
      return;
    }
    if (conditionNote.trim().length < 5) {
      setLoi('Vui lòng mô tả tình trạng phòng (tối thiểu 5 ký tự).');
      return;
    }
    if (photos.length < photoLimits.min) {
      setLoi(`Vui lòng chụp/tải lên ít nhất ${photoLimits.min} ảnh bàn giao.`);
      return;
    }

    startTransition(async () => {
      try {
        await apiClient.post(
          `/room-bookings/${booking.id}/${laNhanPhong ? 'checkin' : 'checkout'}`,
          {
            ruleAccepted: daDocNoiQuy,
            conditionNote: conditionNote.trim(),
            fieldValues: values,
            photos: photos.map(toPhotoPayload),
          }
        );
        toast.success(laNhanPhong ? 'Đã nhận phòng' : 'Đã trả phòng');
        router.push('/rooms/bookings');
        router.refresh();
      } catch (err) {
        setLoi(err instanceof ApiError ? err.message : 'Không gửi được, vui lòng thử lại.');
      }
    });
  }

  async function themAnh(files: FileList | null) {
    if (!files || files.length === 0) return;
    setLoi(null);

    const remaining = photoLimits.max - photos.length;
    if (remaining <= 0) {
      setLoi(`Mỗi lượt bàn giao tối đa ${photoLimits.max} ảnh.`);
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const uploaded: HandoverPhotoDraft[] = [];
      for (const file of selected) {
        const form = new FormData();
        form.set('file', file);
        // Kích thước thật do máy chủ tính lại sau khi xoay và nén; chỉ gửi mã
        // đơn để máy chủ kiểm quyền và lấy dữ liệu đóng watermark.
        form.set('bookingId', booking.id);
        form.set('capturedAtClient', new Date(file.lastModified || Date.now()).toISOString());

        const res = await fetch('/api/upload/handover-photo', { method: 'POST', body: form });
        const body = (await res.json().catch(() => ({}))) as UploadResponse;
        if (!res.ok || !('photo' in body)) {
          throw new Error('error' in body ? body.error : 'Upload ảnh thất bại.');
        }

        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.push(previewUrl);
        uploaded.push({ ...body.photo, name: file.name, previewUrl });
      }
      setPhotos((current) => [...current, ...uploaded]);
    } catch (err) {
      setLoi(err instanceof Error ? err.message : 'Upload ảnh thất bại.');
    } finally {
      setUploading(false);
    }
  }

  function xoaAnh(index: number) {
    setPhotos((current) => {
      const target = current[index];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
        previewUrlsRef.current = previewUrlsRef.current.filter((url) => url !== target.previewUrl);
      }
      return current.filter((_, i) => i !== index);
    });
  }

  return (
    <div className="space-y-5">
      <div className="border-border rounded-xl border px-4 py-3 text-sm">
        <p className="font-semibold">{booking.roomName}</p>
        <p className="text-muted-foreground">
          {vnRangeLabel(new Date(booking.startAt), new Date(booking.endAt))}
        </p>
      </div>

      {/* Nội quy chỉ hiện ở lượt nhận phòng — đó là lúc phải đọc và cam kết. */}
      {laNhanPhong && booking.ruleContent && (
        <section className="border-border rounded-xl border p-4">
          <h2 className="mb-2 text-base font-semibold">
            Nội quy phòng
            {booking.ruleVersionAccepted !== null && (
              <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                (bản {booking.ruleVersionAccepted})
              </span>
            )}
          </h2>
          <div className="max-h-64 overflow-y-auto">
            <RichTextView html={booking.ruleContent} />
          </div>

          <label className="bg-muted/50 mt-3 flex cursor-pointer items-start gap-3 rounded-lg p-3">
            <input
              type="checkbox"
              className="accent-primary mt-0.5 h-5 w-5 shrink-0"
              checked={daDocNoiQuy}
              onChange={(e) => setDaDocNoiQuy(e.target.checked)}
            />
            <span className="text-sm font-medium">
              Tôi đã đọc và cam kết tuân thủ nội quy phòng
            </span>
          </label>
        </section>
      )}

      {fields.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Kiểm đếm thiết bị</h2>
          {fields.map((field) => {
            const truoc = giaTriLucNhan[field.key];
            return (
              <div key={field.key}>
                <HandoverFieldInput
                  field={field}
                  value={values[field.key] ?? null}
                  onChange={(v) => setValues((cu) => ({ ...cu, [field.key]: v }))}
                  disabled={pending}
                />
                {!laNhanPhong && truoc !== undefined && truoc !== null && (
                  <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
                    Lúc nhận: <strong className="text-foreground">{String(truoc)}</strong>
                    <ArrowRight className="h-3 w-3" />
                    trả lại
                  </p>
                )}
              </div>
            );
          })}
        </section>
      )}

      <section className="space-y-1.5">
        <label htmlFor="tinh-trang" className="block text-sm font-medium">
          Mô tả tình trạng phòng <span className="text-destructive">*</span>
        </label>
        <Textarea
          id="tinh-trang"
          rows={4}
          className="text-base"
          placeholder={
            laNhanPhong
              ? 'VD: Phòng sạch, 30 máy chạy bình thường, máy chiếu hoạt động'
              : 'VD: Đã dọn dẹp, tắt toàn bộ máy và điều hoà, 1 máy số 12 không khởi động được'
          }
          value={conditionNote}
          onChange={(e) => setConditionNote(e.target.value)}
          disabled={pending}
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Ảnh bàn giao</h2>
            <p className="text-muted-foreground text-xs">
              Tối thiểu {photoLimits.min}, tối đa {photoLimits.max} ảnh cho lượt này.
            </p>
          </div>
          <label className="border-input bg-background hover:bg-muted inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {uploading ? 'Đang tải ảnh' : 'Chụp / tải ảnh'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              disabled={uploading || pending || photos.length >= photoLimits.max}
              onChange={(e) => {
                void themAnh(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        </div>

        {photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((photo, index) => (
              <div
                key={`${photo.objectName}-${index}`}
                className="group relative overflow-hidden rounded-lg border"
              >
                {/* Dùng <img> chứ không phải next/image: đây là blob URL của
                    ảnh vừa chụp, chưa có trên máy chủ nên không tối ưu được. */}
                <img src={photo.previewUrl} alt="" className="aspect-[4/3] w-full object-cover" />
                <button
                  type="button"
                  onClick={() => xoaAnh(index)}
                  className="bg-background/90 text-destructive absolute top-1.5 right-1.5 rounded-md p-1 shadow-sm"
                  aria-label="Xóa ảnh"
                  disabled={pending}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="border-border text-muted-foreground flex items-center gap-3 rounded-lg border border-dashed px-4 py-5 text-sm">
            <ImagePlus className="h-5 w-5 shrink-0" />
            Chưa có ảnh bàn giao.
          </div>
        )}
      </section>

      {thieuHut.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Số liệu trả về ít hơn lúc nhận:{' '}
            {thieuHut.map((t) => `${t.label} thiếu ${t.thieu}`).join(', ')}. Đơn sẽ được đánh dấu để
            Quản trị viên kiểm tra.
          </span>
        </div>
      )}

      {loi && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive flex gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loi}</span>
        </div>
      )}

      <Button className="h-12 w-full text-base" onClick={guiDi} disabled={pending || uploading}>
        {pending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        {laNhanPhong ? 'Xác nhận nhận phòng' : 'Xác nhận trả phòng'}
      </Button>

      {!laNhanPhong && summary.checkin && (
        <p className="text-muted-foreground text-center text-xs">
          Đã nhận phòng lúc {vnTimeLabel(new Date(summary.checkin.performedAt))}
        </p>
      )}
    </div>
  );
}

function toPhotoPayload(photo: HandoverPhotoDraft): HandoverPhotoInput {
  return {
    bucket: photo.bucket,
    objectName: photo.objectName,
    mime: photo.mime,
    size: photo.size,
    sha256: photo.sha256,
    width: photo.width,
    height: photo.height,
    capturedAtClient: photo.capturedAtClient,
  };
}
