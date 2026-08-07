/**
 * Việc trong hàng đợi BullMQ tên `email`.
 *
 * Bên đẩy việc: `apps/api` (email xác thực, đặt lại mật khẩu) và
 * `apps/web/src/lib/notifications.ts` (nhắc hạn nộp bài).
 * Bên xử lý: `apps/web/src/workers/email.worker.ts`.
 *
 * Vì sao phải qua hàng đợi: máy chủ ứng dụng (192.168.53.103) KHÔNG có Internet
 * nên không với tới smtp.gmail.com. Gửi thẳng trong request sẽ treo tới lúc TCP
 * timeout rồi vẫn thất bại. Đẩy vào hàng đợi thì worker chạy ở máy có Internet
 * lấy ra gửi, còn request trả về tức thì.
 */
export type EmailJobData =
  | {
      /**
       * Email thông báo — worker tự dựng nội dung từ mẫu của web.
       *
       * `kind` để trống chứ không phải `'notification'`: lúc nâng cấp vẫn còn
       * job cũ nằm trong Redis chưa có trường này, worker phải hiểu được chúng.
       */
      kind?: undefined;
      to: string;
      recipientName: string;
      title: string;
      body: string | null;
      link: string | null;
    }
  | {
      /**
       * Nội dung đã dựng sẵn. Bên đẩy việc sở hữu mẫu email, worker chỉ gửi.
       *
       * Nhờ vậy `apps/api` giữ nguyên mẫu email xác thực của mình mà không phải
       * nhân bản sang web, và worker không cần biết gì về nghiệp vụ.
       */
      kind: 'raw';
      to: string;
      subject: string;
      html: string;
    };

/** Tên hàng đợi. Đặt ở đây để bên đẩy và bên xử lý không lệch nhau. */
export const EMAIL_QUEUE_NAME = 'email';
