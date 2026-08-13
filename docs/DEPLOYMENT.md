# Triển khai LumiBach LMS bằng Docker

Tài liệu dành cho người tiếp nhận vận hành hệ thống trên server Ubuntu.
**Không cần cài Node, pnpm hay pm2** — chỉ cần Docker.

- Đưa lên tên miền `lumibach.com`: xem [DOMAIN_SETUP.md](DOMAIN_SETUP.md)
- Dựng máy chủ vật lý từ đầu: xem [PHYSICAL_SERVER_SETUP.md](PHYSICAL_SERVER_SETUP.md)

---

## 1. Kiến trúc

Ứng dụng gồm **3 container**, còn lại là dịch vụ có sẵn trên hạ tầng:

| Thành phần        | Nguồn                   | Cổng | Vai trò                                                      |
| ----------------- | ----------------------- | ---- | ------------------------------------------------------------ |
| `lumibach-web`    | `apps/web` (Next.js 16) | 3000 | Giao diện; rewrite `/api/v1/*`, `/storage/*`, `/socket.io/*` |
| `lumibach-api`    | `apps/api` (NestJS 11)  | 4000 | REST `/api/v1`, WebSocket, Swagger `/api/docs`               |
| `lumibach-worker` | `apps/web/src/workers`  | —    | Xử lý hàng đợi email thông báo                               |
| PostgreSQL        | máy riêng `.101`        | 5432 | Dữ liệu                                                      |
| Redis             | máy riêng `.101`        | 6379 | Cache **và hàng đợi email**                                  |
| MinIO             | máy riêng `.105`        | 9000 | File, ảnh                                                    |
| Judge0            | `docker-compose.yml`    | 2358 | Sandbox chấm code                                            |

Trình duyệt chỉ nói chuyện với `lumibach.com`; mọi thứ khác đi vòng bên trong.

> **Đừng bỏ container `worker`.** `lib/notifications.ts` đẩy email thông báo vào
> hàng đợi Redis (cron nhắc hạn nộp bài, báo cáo tham gia); worker là tiến trình
> duy nhất lấy ra và gửi đi. Không chạy nó thì email nằm im trong Redis mà web và
> API **vẫn hoạt động bình thường** — rất dễ tưởng là ổn.
>
> Riêng worker chấm code trước đây đã bỏ: API gọi thẳng Judge0, không qua hàng đợi.

---

## 2. Yêu cầu trên server

- Ubuntu 22.04 hoặc 24.04
- 2 CPU / 4GB RAM tối thiểu (khuyến nghị 4 CPU / 8GB nếu chạy cả Judge0)
- 20GB SSD

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER    # đăng xuất/đăng nhập lại cho có hiệu lực
```

Server phải với tới được PostgreSQL + Redis ở `192.168.53.101` và MinIO ở
`192.168.53.105`.

---

## 3. Triển khai lần đầu

```bash
git clone https://github.com/bachducanh/lms_lumibach.git
cd lms_lumibach
cp .env.example .env
nano .env
```

Sáu giá trị bắt buộc phải điền:

```dotenv
DATABASE_URL=postgresql://lumibach:MẬT_KHẨU@192.168.53.101:5432/lumibach_lms?schema=public
REDIS_URL=redis://:MẬT_KHẨU@192.168.53.101:6379
MINIO_INTERNAL_ENDPOINT=192.168.53.105
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
AUTH_SECRET=...                      # sinh bằng: openssl rand -base64 32
```

> **KHÔNG đặt giá trị trong dấu nháy.** `env_file` của Docker giữ nguyên nháy làm
> một phần của giá trị, khác với dotenv. Viết `MINIO_INTERNAL_ENDPOINT="1.2.3.4"`
> sẽ khiến MinIO báo `Invalid endPoint`.

Chạy migration rồi khởi động:

```bash
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
docker compose -f docker-compose.prod.yml up -d --build
```

Lần build đầu mất khoảng 5–15 phút. Kiểm tra:

```bash
docker compose -f docker-compose.prod.yml ps
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/api/v1/health
```

Cả hai phải trả **200**. Kiểm worker đã lên:

```bash
docker compose -f docker-compose.prod.yml logs worker | tail -3   # phải thấy "[email-worker] started"
```

### Scratch — không cần làm gì

Bản build trình soạn Scratch (`apps/web/public/scratch-gui/`, 498 file) **đã nằm
sẵn trong git**, nên `git clone` là có luôn. Không phải chạy `build:scratch-gui`.

Chỉ khi muốn **nâng cấp lên phiên bản Scratch mới** mới cần chạy lại — và lệnh đó
cần `git`, Node 18+ cùng ~5GB trống vì nó clone TurboWarp rồi `npm install`:

```bash
pnpm --filter @lumibach/web build:scratch-gui
```

Kiểm nhanh sau khi triển khai:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/scratch-gui/editor.html   # 200
```

### Judge0 — đừng quên

`JUDGE0_API_URL` mặc định là `http://localhost:2358`, tức Judge0 phải chạy **trên
cùng máy với API**. Khởi động nó từ `docker-compose.yml`:

```bash
docker compose up -d judge0-db judge0-redis judge0-server judge0-workers
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:2358/about   # phải 200
```

Nếu Judge0 nằm ở máy khác thì sửa `JUDGE0_API_URL` thành địa chỉ máy đó. **Thiếu
bước này thì mọi thứ khác chạy bình thường, chỉ chức năng chấm code là chết** —
lỗi dễ bỏ sót vì trang vẫn mở được.

---

## 4. Cập nhật phiên bản mới

```bash
cd lms_lumibach
git pull
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
docker compose -f docker-compose.prod.yml up -d --build
```

Lệnh `migrate` an toàn để chạy thừa — nó bỏ qua migration đã áp dụng.

---

## 5. Điều PHẢI nhớ về biến môi trường

Một số giá trị **nhúng vào image lúc build**, không đọc lại lúc chạy:

| Biến                                | Vì sao                                      |
| ----------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_*`                     | Nhúng thẳng vào mã JS gửi xuống trình duyệt |
| `API_INTERNAL_URL`                  | Next.js sinh sẵn bảng rewrite lúc build     |
| `MINIO_INTERNAL_ENDPOINT` / `_PORT` | Dùng trong rewrite `/storage/*`             |

Đổi những giá trị này thì sửa `.env` **là chưa đủ**, phải build lại:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Các biến còn lại (`DATABASE_URL`, `REDIS_URL`, `SMTP_*`, `AUTH_SECRET`,
`CRON_SECRET`, khoá MinIO…) đọc lúc chạy, chỉ cần khởi động lại:

```bash
docker compose -f docker-compose.prod.yml restart
```

---

## 6. Vận hành

```bash
docker compose -f docker-compose.prod.yml logs -f api     # xem log
docker compose -f docker-compose.prod.yml restart api     # khởi động lại 1 dịch vụ
docker compose -f docker-compose.prod.yml down            # dừng toàn bộ
docker image prune -f                                     # dọn image cũ sau nhiều lần build
```

Khi SMTP hỏng, link xác thực email vẫn được ghi vào `logs/dev-emails.log` bên
trong container `api` để lấy thủ công:

```bash
docker compose -f docker-compose.prod.yml exec api tail -20 logs/dev-emails.log
```

### Cron dọn thùng rác

`/api/cron/purge-trash` xoá hẳn khoá học đã ở thùng rác quá 30 ngày (kèm file
MinIO). Cần header `x-cron-secret` khớp `CRON_SECRET`; **thiếu biến này thì
endpoint từ chối mọi lần gọi** và thùng rác không bao giờ được dọn.

```cron
0 3 * * * curl -s -H "x-cron-secret: GIÁ_TRỊ_THẬT" http://localhost:3000/api/cron/purge-trash >> /var/log/lumibach-cron.log 2>&1
```

Tương tự với `/api/cron/due-soon` (nhắc hạn nộp bài) nếu muốn bật.

### Cron của Phòng chức năng

Hai việc này gọi thẳng vào **API cổng 4000**, không qua web như hai cron ở trên —
nghiệp vụ phòng (chuyển trạng thái, thông báo, nhật ký) nằm ở `apps/api`, đi
vòng qua web chỉ thêm một chặng mà không được gì. Vẫn dùng chung `CRON_SECRET`.

```cron
*/15 * * * * curl -s -X POST -H "x-cron-secret: GIÁ_TRỊ_THẬT" http://localhost:4000/api/v1/room-jobs/no-show >> /var/log/lumibach-cron.log 2>&1
30 3 * * * curl -s -X POST -H "x-cron-secret: GIÁ_TRỊ_THẬT" http://localhost:4000/api/v1/room-jobs/purge-photos >> /var/log/lumibach-cron.log 2>&1
```

- **`no-show`** đánh dấu đơn đã duyệt mà quá giờ kết thúc vẫn chưa ai nhận
  phòng, rồi báo cho người mượn. Mốc là giờ KẾT THÚC chứ không phải giờ bắt
  đầu — người mượn được phép nhận muộn cho tới hết khung giờ, đánh dấu sớm hơn
  sẽ huỷ oan đơn của người đến trễ. Chạy 15 phút một lần là đủ; chạy thưa hơn
  thì phòng bị giữ chỗ lâu hơn mức cần.
- **`purge-photos`** dọn ảnh minh chứng quá hạn lưu giữ (mặc định 12 tháng, đặt
  riêng được cho từng phòng). **Chỉ xoá file ảnh, giữ nguyên bản ghi bàn giao** —
  số liệu kiểm đếm và mô tả tình trạng vẫn cần tra cứu. Đặt thời hạn `0` nghĩa
  là giữ vĩnh viễn, không phải xoá sạch.

### Sao lưu

Dữ liệu **không** nằm trong container — sao lưu ở hai nơi:

Máy chủ `.103` **không có `pg_dump`**, và image `lumibach-api` cũng không —
`docker exec lumibach-api sh -c 'pg_dump ...'` chỉ ra `pg_dump: not found` rồi
để lại một file **0 byte** trông y như đã sao lưu xong. Luôn kiểm `ls -lh` sau
khi chạy.

Chạy từ máy phát triển (tới được `.101`), dùng image Postgres đúng phiên bản:

```bash
docker run --rm --env-file .env.prod postgres:17-alpine \
  sh -c 'pg_dump "${DATABASE_URL%%\?*}" -Fc' > lumibach-$(date +%F).dump

# MinIO: dùng `mc mirror`, hoặc sao lưu volume trên máy 192.168.53.105
```

Hai chi tiết bắt buộc:

- **`postgres:17-alpine`**, không phải 16 — server đang chạy PostgreSQL 17.9 và
  `pg_dump` cũ hơn server thì từ chối chạy.
- **`${DATABASE_URL%%\?*}`** cắt phần `?schema=public`. Đó là tham số riêng của
  Prisma; `psql`/`pg_dump` báo `invalid URI query parameter: "schema"`. Cắt ngay
  trong container để chuỗi kết nối không lọt ra lịch sử lệnh.

Kiểm bản dump đọc được trước khi tin là đã có sao lưu:

```bash
docker run --rm -v "//e/lumibach-backups:/backup" postgres:17-alpine \
  pg_restore -l /backup/lumibach-2026-08-10.dump | head
```

### Bảo mật

Không mở ra Internet: **5432** (Postgres), **6379** (Redis), **9001** (MinIO
Console), **2358** (Judge0). Judge0 chạy `privileged: true` và `JUDGE0_API_KEY`
để trống — lộ ra ngoài là ai cũng chạy được code tuỳ ý trên server.

---

## 7. Xử lý sự cố

| Triệu chứng                                       | Nguyên nhân thường gặp                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `Invalid endPoint : "1.2.3.4"`                    | Giá trị trong `.env` còn dấu nháy — bỏ hết nháy đi                                        |
| API không nối được DB                             | Sai `DATABASE_URL`, hoặc máy `.101` chặn cổng 5432 từ IP của server                       |
| `Prisma Client could not locate the Query Engine` | Image build lỗi — build lại kèm `--no-cache`                                              |
| Web trả 500 ở mọi trang                           | API chưa lên — `docker compose -f docker-compose.prod.yml logs api` xem lý do             |
| Đổi tên miền mà web vẫn gọi địa chỉ cũ            | Chưa build lại image — xem mục 5                                                          |
| Build lỗi ở bước `tsc` mà không rõ lý do          | Xoá cache: `docker builder prune -f` rồi build lại                                        |
| Trang chạy nhưng ảnh không hiện                   | Sai `MINIO_INTERNAL_ENDPOINT`, hoặc `NEXT_PUBLIC_MEDIA_URL` trỏ miền chưa cấu hình tunnel |

Vấn đề liên quan tới Cloudflare, WebSocket và đăng nhập: xem mục **Xử lý sự cố**
trong [DOMAIN_SETUP.md](DOMAIN_SETUP.md).

---

_Cập nhật: 06/08/2026 — chuyển sang triển khai bằng Docker._
