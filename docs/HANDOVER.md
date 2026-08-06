# Bàn giao vận hành LumiBach LMS

Tài liệu một-trang cho người tiếp nhận. Đọc hết trước khi triển khai — có vài chỗ
sai là hệ thống **vẫn chạy** nhưng mất chức năng, rất khó phát hiện.

Chi tiết kỹ thuật: [DEPLOYMENT.md](DEPLOYMENT.md) · Tên miền: [DOMAIN_SETUP.md](DOMAIN_SETUP.md)

---

## 1. Hệ thống gồm những gì

```
Trình duyệt ──HTTPS──▶ Cloudflare ──tunnel──▶ cloudflared
                                                  ├─▶ :3000  web    (Next.js)
                                                  ├─▶ :4000  api    (NestJS)
                                                  └─       worker (hàng đợi email)
```

| Dịch vụ            | Máy                   | Ghi chú                                                    |
| ------------------ | --------------------- | ---------------------------------------------------------- |
| web / api / worker | **cần triển khai**    | 3 container, `docker-compose.prod.yml`                     |
| PostgreSQL         | `192.168.53.101:5432` | DB `lumibach_lms`                                          |
| Redis              | `192.168.53.101:6379` | cache **và hàng đợi email**                                |
| MinIO              | `192.168.53.105:9000` | dùng chung với dự án khác — chỉ đụng 2 bucket `lumibach-*` |
| Judge0             | cùng máy với api      | chấm code, `docker-compose.yml`                            |
| cloudflared        | `192.168.53.105`      | cổng vào tên miền                                          |

Tên miền: `lumibach.com` (web + API + WebSocket) và `media.lumibach.com` (file, ảnh).

---

## 2. Triển khai

```bash
git clone https://github.com/bachducanh/lms_lumibach.git
cd lms_lumibach
cp .env.example .env && nano .env
docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
docker compose -f docker-compose.prod.yml up -d --build
docker compose up -d judge0-db judge0-redis judge0-server judge0-workers
```

### Bảy giá trị bí mật cần điền vào `.env`

Chủ dự án gửi riêng, **không nằm trong git**:

`DATABASE_URL` · `REDIS_URL` · `MINIO_ACCESS_KEY` · `MINIO_SECRET_KEY` ·
`AUTH_SECRET` · `SMTP_PASSWORD` · `CRON_SECRET`

> **KHÔNG đặt giá trị trong dấu nháy.** `env_file` của Docker giữ nháy làm một
> phần của giá trị, khác dotenv. `MINIO_INTERNAL_ENDPOINT="1.2.3.4"` sẽ khiến
> MinIO báo `Invalid endPoint`.

---

## 3. Việc cần làm trên Cloudflare

| Việc                                                      | Vì sao                                                                                 |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Bật **Always Use HTTPS** (SSL/TLS → Edge Certificates)    | Vào bằng `http://` thì cookie phiên không gửi được, mọi request API bị chặn CORS       |
| Thêm rule `path: ^/socket\.io` vào **đầu** khối `ingress` | Có thì WebSocket thật; không thì tự lùi về long-polling, vẫn chạy nhưng tốn băng thông |
| Xoá bản ghi DNS `judge0.lumibach.com`                     | Judge0 chạy code tuỳ ý và không xác thực — không được để lộ ra Internet                |

Rule WebSocket, đặt **trước** rule `lumibach.com` chung:

```yaml
- hostname: lumibach.com
  path: ^/socket\.io
  service: http://localhost:4000
  originRequest:
    httpHostHeader: lumibach.com
```

File `config.yml` mẫu đầy đủ: [cloudflared-config.yml](cloudflared-config.yml).
Nếu ứng dụng chạy **khác máy** với cloudflared thì đổi `localhost` thành IP máy đó.

---

## 4. Ba lỗi im lặng — kiểm ngay sau khi triển khai

Cả ba đều khiến hệ thống **trông như đang chạy tốt** mà thực ra mất chức năng.

**① Không có container `worker`** → email thông báo nằm im trong Redis, không ai
nhận được nhắc hạn nộp bài.

```bash
docker compose -f docker-compose.prod.yml logs worker | tail -3   # "[email-worker] started"
```

**② Judge0 không cùng máy với api** → `JUDGE0_API_URL=http://localhost:2358` trỏ
vào chỗ rỗng, chấm code chết trong khi mọi trang vẫn mở được.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:2358/about   # 200
```

**③ Thiếu `CRON_SECRET`** → `/api/cron/purge-trash` từ chối mọi lần gọi nên thùng
rác không bao giờ được dọn; còn `/api/cron/due-soon` thì ngược lại, bỏ qua kiểm
tra và ai gọi cũng được.

**④ Trình soạn Scratch** — bản build đã có sẵn trong git, không phải làm gì thêm.
Nhưng cứ kiểm cho chắc:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/scratch-gui/editor.html   # 200
```

---

## 5. Kiểm tra sau khi lên

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://lumibach.com/login              # 200
curl -s -o /dev/null -w "%{http_code}\n" https://lumibach.com/api/v1/me          # 401 (đúng)
curl -s -o /dev/null -w "%{http_code}\n" "https://lumibach.com/socket.io/?EIO=4&transport=polling"  # 200
```

Rồi trong trình duyệt: đăng nhập → **đăng xuất** → tải ảnh đại diện → nộp một file
rồi xoá → nộp một bài code. Xong cả năm là hệ thống đầy đủ chức năng.

---

## 6. Vận hành hằng ngày

```bash
docker compose -f docker-compose.prod.yml logs -f api      # xem log
docker compose -f docker-compose.prod.yml restart api      # khởi động lại
git pull && docker compose -f docker-compose.prod.yml up -d --build   # cập nhật
```

**Sao lưu** — dữ liệu không nằm trong container:

```bash
pg_dump -h 192.168.53.101 -U lumibach -d lumibach_lms -Fc -f lumibach-$(date +%F).dump
```

Ảnh và file nằm ở MinIO `192.168.53.105`, 2 bucket `lumibach-avatars` và
`lumibach-files`.

---

## 7. Những điều dễ mắc

- **Đổi tên miền hay địa chỉ MinIO thì phải build lại image.** `NEXT_PUBLIC_*`,
  `API_INTERNAL_URL`, `MINIO_INTERNAL_*` được nhúng lúc build, sửa `.env` không đủ.
- **MinIO dùng chung với dự án khác.** Chỉ đụng `lumibach-avatars` và
  `lumibach-files`; các bucket còn lại thuộc dự án khác.
- **Gửi mail qua Gmail cá nhân**, giới hạn khoảng 500 người nhận/ngày. Mật khẩu
  ứng dụng có thể bị Google thu hồi mà không báo — khi đó mail lặng lẽ ngừng gửi,
  link xác thực vẫn được ghi vào `logs/dev-emails.log` trong container `api`.
- **Không mở ra Internet**: 5432, 6379, 9001, 2358.

Bảng xử lý sự cố đầy đủ ở cuối [DEPLOYMENT.md](DEPLOYMENT.md) và
[DOMAIN_SETUP.md](DOMAIN_SETUP.md).
