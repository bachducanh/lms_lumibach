# Setup tên miền lumibach.com (Cloudflare Tunnel)

Tài liệu này hướng dẫn đưa hệ thống đang chạy trên **máy chủ vật lý trong LAN**
(không có IP public) lên tên miền `lumibach.com` — tên miền chính thức duy nhất
của dự án.

Cách làm: **Cloudflare Tunnel** — cloudflared chạy trên server, tự mở kết nối ra
Cloudflare, nên **không cần IP tĩnh, không cần NAT port 80/443, không cần Certbot**
(HTTPS do Cloudflare cấp và tự gia hạn).

```
Trình duyệt ──HTTPS──▶ Cloudflare ──tunnel──▶ cloudflared (server LAN)
                                                 ├─▶ :3000  Next.js  (web + /api/v1 rewrite + /storage rewrite)
                                                 └─▶ :4000  NestJS   (chỉ /socket.io — WebSocket)
```

Postgres, Redis, MinIO (:9000/:9001) và Judge0 (:2358) **không** được expose ra
Internet — chúng chỉ đi qua nội bộ (Next.js rewrite `/storage/*` → MinIO).

---

## Bước 1 — Đưa lumibach.com về Cloudflare

1. Đăng ký tài khoản tại https://dash.cloudflare.com (gói **Free** là đủ), xác thực email.
2. Sidebar **Domains** → nút **Onboard a domain** (tên cũ là _Add a site_) → nhập
   `lumibach.com` → **Continue** → chọn plan **Free**.
3. Màn hình DNS records: **không thêm bản ghi nào** — `cloudflared tunnel route dns`
   sẽ tự tạo CNAME cho apex. Nếu có bản ghi parking `A`/`CNAME` của nhà đăng ký thì
   xoá đi, không thì lệnh tunnel sẽ báo _record with that host already exists_.
4. Cloudflare hiện 2 nameserver dạng `xxx.ns.cloudflare.com` (mỗi tài khoản một cặp riêng).
   Vào trang quản trị nhà đăng ký → mục **Nameservers / Thay đổi DNS** → xoá hết
   nameserver cũ, nhập 2 cái của Cloudflare → lưu.
   Tên miền của dự án mua tại P.A Việt Nam: https://access.pavietnam.vn →
   chọn `lumibach.com` → **Thay đổi DNS** → **Lưu cấu hình**.
5. Bấm **Check nameservers now**, rồi chờ (thường 30 phút–2 giờ, tối đa 24h).
   Tự kiểm tra: `nslookup -type=NS lumibach.com 8.8.8.8`.
6. Khi trang **Overview** hiện **Active**: vào **SSL/TLS → Overview → `Full (strict)`**
   (tunnel là kết nối nội bộ đã mã hoá, không cần cert ở origin).

> Nếu không muốn đổi nameserver, có thể giữ DNS ở nhà đăng ký và tự thêm bản ghi
> CNAME cho tunnel, nhưng Cloudflare Tunnel + Email Routing chỉ hoạt động đầy đủ
> khi domain nằm trên nameserver Cloudflare. **Khuyến nghị đổi nameserver.**

---

## Bước 2 — Cài cloudflared và tạo tunnel trên server

Trên máy chủ Ubuntu (chạy với user thường, không phải root):

```bash
# Cài cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Đăng nhập — lệnh in ra 1 URL, mở bằng trình duyệt và chọn domain lumibach.com
cloudflared tunnel login

# Tạo tunnel (ghi lại UUID được in ra)
cloudflared tunnel create lumibach

# Trỏ DNS: tự tạo bản ghi CNAME proxied cho apex và www
cloudflared tunnel route dns lumibach lumibach.com
cloudflared tunnel route dns lumibach www.lumibach.com
```

### File cấu hình

Tạo `/etc/cloudflared/config.yml` (thay `<UUID>` và tên user cho đúng):

```yaml
tunnel: <UUID>
credentials-file: /home/<user>/.cloudflared/<UUID>.json

ingress:
  # WebSocket (socket.io) phải đi thẳng vào NestJS — Next.js rewrite không proxy được WS.
  # Đặt TRƯỚC rule chung, vì cloudflared khớp theo thứ tự từ trên xuống.
  - hostname: lumibach.com
    path: ^/socket\.io
    service: http://localhost:4000
  - hostname: www.lumibach.com
    path: ^/socket\.io
    service: http://localhost:4000

  # Toàn bộ phần còn lại → Next.js (đã tự rewrite /api/v1/* và /storage/*)
  - hostname: lumibach.com
    service: http://localhost:3000
  - hostname: www.lumibach.com
    service: http://localhost:3000

  - service: http_status:404
```

Chạy như dịch vụ hệ thống để tự khởi động cùng server:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared      # phải thấy "Registered tunnel connection"
```

> **Vì sao WebSocket cần route riêng:** `apps/web/src/lib/socket.ts` kết nối tới
> `window.location.origin` khi `NEXT_PUBLIC_WS_URL` để trống, còn xác thực WS
> (`apps/api/src/common/gateway/ws-auth.ts`) đọc cookie `__Secure-authjs.session-token`.
> Cookie này là **host-only** của `lumibach.com`, nên nếu tách WS sang
> `api.lumibach.com` thì cookie sẽ không được gửi kèm và socket bị disconnect.
> Giữ cùng một hostname là cách gọn nhất, không phải sửa code.

### Chuyển hướng www → apex (tuỳ chọn)

Cloudflare Dashboard → **Rules → Redirect Rules → Create**:
`Hostname equals www.lumibach.com` → Dynamic redirect 301 →
`concat("https://lumibach.com", http.request.uri.path)`.

---

## Bước 3 — Cập nhật `.env` trên server

```dotenv
# Domain hiển thị cho người dùng — dùng trong link xác thực email, mời vào lớp…
NEXT_PUBLIC_APP_URL="https://lumibach.com"
NEXTAUTH_URL="https://lumibach.com"
AUTH_TRUST_HOST=true

# Trình duyệt gọi API theo đường dẫn tương đối → Next.js rewrite chuyển tiếp sang NestJS
NEXT_PUBLIC_API_URL="/api/v1"
# Server Component gọi thẳng NestJS — BẮT BUỘC là URL tuyệt đối
API_INTERNAL_URL="http://localhost:4000/api/v1"
# Để TRỐNG: socket.io sẽ tự dùng https://lumibach.com (xem Bước 2)
NEXT_PUBLIC_WS_URL=

# MinIO giữ nguyên nội bộ — ảnh/tệp đi qua rewrite /storage/* nên luôn là HTTPS
MINIO_INTERNAL_ENDPOINT="192.168.53.105"
MINIO_INTERNAL_PORT=9000
```

Sau đó build lại và khởi động lại (biến `NEXT_PUBLIC_*` được nhúng lúc **build**,
đổi trong `.env` mà không build lại sẽ không có tác dụng):

```bash
pnpm install && pnpm build && pm2 restart all
```

---

## Bước 4 — Email theo tên miền (noreply@lumibach.com)

Gmail cá nhân không gửi được với địa chỉ `@lumibach.com` (bị SPF/DKIM chặn, dễ vào
spam). Dùng một dịch vụ gửi mail giao dịch — khuyến nghị **Resend** (miễn phí
3.000 mail/tháng, đủ cho 200–600 học sinh) hoặc **Brevo** (300 mail/ngày).

### 4.1 Gửi đi — Resend

1. Đăng ký https://resend.com → **Domains → Add Domain** → `lumibach.com`.
2. Resend hiển thị 3 bản ghi; thêm vào Cloudflare DNS đúng như hiển thị:

   | Type | Name                | Nội dung                                            | Proxy    |
   | ---- | ------------------- | --------------------------------------------------- | -------- |
   | MX   | `send`              | `feedback-smtp.<region>.amazonses.com` (ưu tiên 10) | DNS only |
   | TXT  | `send`              | `v=spf1 include:amazonses.com ~all`                 | DNS only |
   | TXT  | `resend._domainkey` | (chuỗi DKIM Resend cấp)                             | DNS only |

3. Bấm **Verify** trong Resend (thường xong trong vài phút).
4. Thêm DMARC — Cloudflare DNS → TXT:

   | Type | Name     | Nội dung                                               |
   | ---- | -------- | ------------------------------------------------------ |
   | TXT  | `_dmarc` | `v=DMARC1; p=none; rua=mailto:bachducanh.jr@gmail.com` |

5. **API keys → Create API Key**, rồi sửa `.env`:

```dotenv
SMTP_HOST="smtp.resend.com"
SMTP_PORT="587"
SMTP_USER="resend"
SMTP_PASSWORD="re_xxxxxxxxxxxxxxxx"   # API key của Resend
SMTP_FROM="LumiBach <noreply@lumibach.com>"
```

`pm2 restart lumibach-api` rồi thử chức năng "Quên mật khẩu" để kiểm tra.

### 4.2 Nhận mail — Cloudflare Email Routing (miễn phí)

Để nhận thư gửi tới `lienhe@lumibach.com`, `admin@lumibach.com`…:

Cloudflare Dashboard → **Email → Email Routing → Enable** → tạo địa chỉ và forward
về `bachducanh.jr@gmail.com`. Cloudflare tự thêm bản ghi MX cho **apex domain** —
không xung đột với Resend vì Resend dùng MX trên subdomain `send.lumibach.com`.

---

## Bước 5 — Cron dọn thùng rác

`/api/cron/purge-trash` yêu cầu header `x-cron-secret` khớp `CRON_SECRET` trong `.env`.
Thêm vào crontab của server (chạy nội bộ, không cần đi qua Internet):

```bash
crontab -e
```

```cron
0 3 * * * curl -s -H "x-cron-secret: $CRON_SECRET" http://localhost:3000/api/cron/purge-trash >> /var/log/lumibach-cron.log 2>&1
```

(Thay `$CRON_SECRET` bằng giá trị thật, hoặc khai báo biến ở đầu crontab.)

---

## Bước 6 — Kiểm tra sau khi lên domain

- [ ] `https://lumibach.com` mở được, ổ khoá HTTPS hợp lệ.
- [ ] Đăng nhập được; F5 vẫn giữ phiên (cookie `__Secure-authjs.session-token`).
- [ ] Ảnh đại diện / tệp bài tập hiển thị (kiểm tra Console không có lỗi Mixed Content).
- [ ] Thông báo realtime chạy: DevTools → Network → WS thấy `/socket.io/?...` status **101**.
- [ ] Nộp bài code chấm được (Judge0 + WebSocket `/code-execution`).
- [ ] Email đặt lại mật khẩu về hộp thư **Inbox**, không phải Spam; xem header có
      `spf=pass` và `dkim=pass`.
- [ ] Từ mạng ngoài, `http://<IP-public>:9000` và `:2358` **không** truy cập được.

---

## Xử lý sự cố

| Triệu chứng                       | Nguyên nhân thường gặp                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Error 1033 / 502 từ Cloudflare    | cloudflared chưa chạy hoặc Next.js chưa lên port 3000 — `sudo systemctl status cloudflared`, `pm2 ls`        |
| Đăng nhập xong bị đá ra ngay      | thiếu `AUTH_TRUST_HOST=true` hoặc `NEXTAUTH_URL` còn `http://localhost:3000`                                 |
| WebSocket liên tục reconnect      | rule `path: ^/socket\.io` đặt sau rule chung trong `config.yml`, hoặc `NEXT_PUBLIC_WS_URL` còn trỏ IP LAN cũ |
| Ảnh vỡ, Console báo Mixed Content | `MINIO_INTERNAL_ENDPOINT` sai, hoặc trong DB còn URL tuyệt đối `http://192.168...` từ trước                  |
| Link trong email vẫn là localhost | `NEXT_PUBLIC_APP_URL` chưa đổi, hoặc chưa `pnpm build` lại                                                   |
| Mail vào Spam                     | DKIM/SPF chưa verify xong, hoặc `SMTP_FROM` không cùng domain đã xác thực                                    |

---

_Cập nhật: 03/08/2026_
