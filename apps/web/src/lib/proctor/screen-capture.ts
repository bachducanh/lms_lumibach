// Chụp màn hình phục vụ giám sát rời bài khi làm quiz.
//
// Trình duyệt KHÔNG cho trang web tự chụp màn hình. Cách duy nhất là học sinh
// cho phép chia sẻ màn hình (Screen Capture API — giống lúc chia sẻ màn hình
// trong Google Meet); sau đó mỗi lần rời bài ta lấy một khung hình từ luồng đó.

type ImageCaptureLike = { grabFrame(): Promise<ImageBitmap> };
type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike;

export function screenCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function'
  );
}

export type ScreenShareResult =
  | { ok: true; stream: MediaStream; surface: string | null }
  | { ok: false; reason: 'unsupported' | 'denied' | 'not-monitor' | 'error'; message: string };

/**
 * Xin chia sẻ TOÀN BỘ màn hình. Chỉ chia sẻ một tab hay một cửa sổ thì khi học
 * sinh chuyển sang tab khác, ảnh chụp vẫn chỉ là trang bài làm — vô dụng làm
 * minh chứng, nên từ chối và yêu cầu chọn lại.
 *
 * Phải gọi trong trình xử lý một cú bấm của người dùng (trình duyệt yêu cầu).
 */
export async function requestEntireScreen(): Promise<ScreenShareResult> {
  if (!screenCaptureSupported()) {
    return {
      ok: false,
      reason: 'unsupported',
      message:
        'Trình duyệt hoặc thiết bị này không hỗ trợ chia sẻ màn hình. Hãy làm bài trên máy tính bằng Chrome, Edge hoặc Firefox.',
    };
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'monitor', frameRate: { ideal: 5, max: 10 } },
      audio: false,
      // Gợi ý riêng của Chromium: mở sẵn mục "Toàn bộ màn hình", không cho đổi
      // nguồn chia sẻ giữa chừng. Trình duyệt khác bỏ qua các khoá lạ.
      monitorTypeSurfaces: 'include',
      surfaceSwitching: 'exclude',
      selfBrowserSurface: 'exclude',
      preferCurrentTab: false,
    } as DisplayMediaStreamOptions);
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'NotAllowedError' || name === 'AbortError') {
      return {
        ok: false,
        reason: 'denied',
        message: 'Bạn chưa cho phép chia sẻ màn hình nên chưa thể vào bài.',
      };
    }
    return { ok: false, reason: 'error', message: 'Không mở được chia sẻ màn hình. Thử lại.' };
  }

  const track = stream.getVideoTracks()[0];
  const surface =
    (track?.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface ??
    null;
  // Safari cũ không báo displaySurface — không biết thì cho qua.
  if (surface && surface !== 'monitor') {
    stream.getTracks().forEach((t) => t.stop());
    return {
      ok: false,
      reason: 'not-monitor',
      message: 'Bạn phải chọn "Toàn bộ màn hình" (Entire screen), không chọn một tab hay cửa sổ.',
    };
  }
  return { ok: true, stream, surface };
}

/**
 * Lấy một khung hình từ luồng chia sẻ, trả về JPEG đã thu nhỏ.
 *
 * Ưu tiên ImageCapture.grabFrame (Chrome/Edge): đọc thẳng từ track nên vẫn chạy
 * khi tab bài làm đang bị ẩn — đúng lúc cần chụp. Firefox không có API này nên
 * lùi về vẽ thẻ <video> lên canvas.
 */
export async function grabFrame(
  stream: MediaStream,
  video: HTMLVideoElement | null,
  maxEdge = 1600
): Promise<Blob | null> {
  const track = stream.getVideoTracks()[0];
  if (!track || track.readyState !== 'live') return null;

  let source: ImageBitmap | HTMLVideoElement | null = null;
  let width = 0;
  let height = 0;

  // lib.dom của TypeScript có khai báo ImageCapture nhưng thiếu grabFrame().
  const Capture = (globalThis as unknown as { ImageCapture?: ImageCaptureCtor }).ImageCapture;
  if (Capture) {
    try {
      const bitmap = await new Capture(track).grabFrame();
      source = bitmap;
      width = bitmap.width;
      height = bitmap.height;
    } catch {
      /* lùi về <video> bên dưới */
    }
  }
  if (!source && video && video.videoWidth > 0) {
    source = video;
    width = video.videoWidth;
    height = video.videoHeight;
  }
  if (!source || width === 0 || height === 0) return null;

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (source instanceof ImageBitmap) source.close();

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.75));
}
