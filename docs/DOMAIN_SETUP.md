# Setup tên miền lumibach.com (Cloudflare Tunnel)

Tài liệu này hướng dẫn đưa hệ thống đang chạy trên **máy chủ vật lý trong LAN**
(không có IP public) lên tên miền `lumibach.com` — tên miền chính thức duy nhất
của dự án.

Cách làm: **Cloudflare Tunnel** — cloudflared chạy trên server, tự mở kết nối ra
Cloudflare, nên **không cần IP tĩnh, không cần NAT port 80/443, không cần Certbot**
(HTTPS do Cloudflare cấp và tự gia hạn).

```
Trình duyệt ──HTTPS──▶ Cloudflare ──tunnel──▶ cloudflared (máy Ubuntu)
                                                  │
   lumibach.com/socket.io ────────────────────────┼──▶ :4000  NestJS  (WebSocket)
   lumibach.com (còn lại) ────────────────────────┴──▶ :3000  Next.js (web)
                                                             ├─▶ /api/v1/* → :4000 NestJS
                                                             └─▶ /storage/* → :9000 MinIO
```

**Chỉ một tên miền duy nhất.** Web dùng đường dẫn tương đối nên cùng một bản build
chạy được cả qua `https://lumibach.com` lẫn `http://localhost:3000` khi tunnel tắt.

Postgres, Redis, MinIO (:9000) và Judge0 (:2358) **không** được expose ra Internet.

> **Judge0 tuyệt đối không được public.** Nó chạy code tuỳ ý người gửi lên, và
> `JUDGE0_API_KEY` mặc định để trống (không xác thực). Nó chỉ được gọi từ phía
> server nên không cần tên miền — giữ `JUDGE0_API_URL="http://<IP-nội-bộ>:2358"`.

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
  - hostname: lumibach.com
    service: http://localhost:3000
    originRequest:
      httpHostHeader: lumibach.com

  # REST API + WebSocket (socket.io) — cùng cổng 4000.
  - hostname: api.lumibach.com
    service: http://localhost:4000
    originRequest:
      httpHostHeader: api.lumibach.com

  # File/ảnh phục vụ thẳng từ MinIO. Xem Bước 2b: phải có Transform Rule cắt
  # tiền tố /storage, vì MinIO phục vụ theo dạng /<bucket>/<object>.
  - hostname: media.lumibach.com
    service: http://192.168.53.105:9000
    originRequest:
      httpHostHeader: media.lumibach.com

  - service: http_status:404
```

Chạy như dịch vụ hệ thống để tự khởi động cùng server:

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared      # phải thấy "Registered tunnel connection"
```

> **Vì sao rule `/socket.io` phải nằm trên cùng:** cloudflared khớp ingress theo
> thứ tự từ trên xuống. Đặt sau rule chung thì WebSocket rơi vào Next.js — trả
> 308 chứ không tới NestJS, và socket reconnect vô hạn.

## Bước 2b — `media.lumibach.com`: không cần Transform Rule

Khi `NEXT_PUBLIC_MEDIA_URL` được đặt, [`getPublicUrl`](../apps/web/src/lib/storage.ts)
sinh thẳng đường dẫn gốc của MinIO:

```
https://media.lumibach.com/<bucket>/<object>
```

Khớp luôn cách MinIO phục vụ, nên **không phải cấu hình rewrite gì trên Cloudflare**.

Bên trong hệ thống vẫn quy mọi URL về một dạng chuẩn `/storage/<bucket>/<object>`
qua `toStoragePath()` — nơi duy nhất biết các biến thể URL. Nhờ vậy chức năng dọn
file rác và các guard chặn link ngoài không phải sửa, và **dữ liệu cũ vẫn chạy**:
hàm này nhận cả đường dẫn tương đối lẫn dạng có tiền tố `/storage/` từ trước.

> **Cảnh báo khi MinIO dùng chung với dự án khác.** `toStoragePath` chỉ chấp nhận
> đúng 2 bucket khai báo trong `.env`. Nếu không kiểm tên bucket, một URL bịa ra
> kiểu `https://media.lumibach.com/<bucket-dự-án-khác>/…` sẽ khiến hệ thống đọc —
> hoặc xoá — file của dự án khác trên cùng máy MinIO.

**Header CORS** (chỉ cần nếu dùng Scratch): trình soạn TurboWarp `fetch()` file
`.sb3` từ trong iframe. MinIO thường đã trả `Access-Control-Allow-Origin: *` cho
object công khai; nếu Console báo lỗi CORS thì thêm ở Cloudflare —
**Rules → Transform Rules → Modify Response Header**: `Hostname equals
media.lumibach.com` → set static `Access-Control-Allow-Origin` = `https://lumibach.com`.

> **Đánh đổi đã chọn:** URL file là tuyệt đối và được ghi vĩnh viễn vào DB. Khi
> tunnel tắt, ứng dụng vẫn đăng nhập/dùng được ở `http://localhost:3000` nhưng
> **ảnh và tệp sẽ không tải được**. Muốn ảnh chạy cả khi offline thì để trống
> `NEXT_PUBLIC_MEDIA_URL` — file sẽ đi qua rewrite `/storage/*` như trước.

### Bật cache ở edge (khuyến nghị)

**Caching → Cache Rules → Create**: `Hostname equals media.lumibach.com` →
**Eligible for cache**, Edge TTL 1 tháng. Tên file có chuỗi ngẫu nhiên nên không
sợ cache cũ.

### Chuyển hướng www → apex (tuỳ chọn)

Cloudflare Dashboard → **Rules → Redirect Rules → Create**:
`Hostname equals www.lumibach.com` → Dynamic redirect 301 →
`concat("https://lumibach.com", http.request.uri.path)`.

---

## Bước 3 — Cập nhật `.env` trên server

```dotenv
# Địa chỉ công khai, chỉ dùng để dựng link trong email (xác thực, đặt lại mật khẩu,
# mời vào lớp). Đặt tên miền thật kể cả khi đang test local — KHÔNG ảnh hưởng tới
# việc chạy local vì mọi thứ khác đều dùng đường dẫn tương đối.
NEXT_PUBLIC_APP_URL="https://lumibach.com"
AUTH_TRUST_HOST=true

# ĐỂ TRỐNG cả 4 biến dưới đây. Đó chính là thứ khiến một bản build chạy được cả
# ở https://lumibach.com lẫn http://localhost:3000 khi tunnel tắt.
AUTH_COOKIE_DOMAIN=""
# Đường dẫn tương đối → rewrite của Next.js chuyển tiếp sang NestJS, cùng origin
# nên không dính CORS và không cần cookie xuyên miền con.
NEXT_PUBLIC_API_URL="/api/v1"
# WebSocket tự chọn: URL có cổng (localhost/LAN) → nối thẳng cổng API; không có
# cổng (sau tunnel) → nối cùng origin. Xem apps/web/src/lib/socket.ts.
NEXT_PUBLIC_WS_URL=""
# Miền phục vụ file. Cần Transform Rule cắt /storage (Bước 2b). Để TRỐNG nếu muốn
# ảnh vẫn tải được khi tunnel tắt (khi đó file đi qua rewrite /storage/*).
NEXT_PUBLIC_MEDIA_URL="https://media.lumibach.com"

# Server Component gọi nội bộ, không vòng ra Internet — BẮT BUỘC là URL tuyệt đối
API_INTERNAL_URL="http://localhost:4000/api/v1"

# Kết nối nội bộ Node → MinIO (upload, xoá file). Trỏ tới nơi MinIO thật sự chạy.
MINIO_INTERNAL_ENDPOINT="localhost"
MINIO_INTERNAL_PORT=9000

# Judge0 chỉ gọi nội bộ — KHÔNG public
JUDGE0_API_URL="http://localhost:2358"
```

Sau đó build lại và khởi động lại (biến `NEXT_PUBLIC_*` được nhúng lúc **build**,
đổi trong `.env` mà không build lại sẽ không có tác dụng):

```bash
pnpm install && pnpm build && pm2 restart all
```

---

## Bước 4 — Email theo tên miền (noreply@lumibach.com)

> **Hiện dự án đang dùng Gmail cá nhân** (`SMTP_USER` = tài khoản Gmail, `SMTP_FROM`
> = chính địa chỉ đó). Cách này chạy được, không cần bản ghi DNS nào, nhưng có hai
> hạn chế cần biết:
>
> - Giới hạn khoảng **500 người nhận/ngày**. Mời cả khối vào lớp một lượt có thể chạm trần.
> - Mật khẩu ứng dụng Gmail **hết hạn/bị thu hồi** thì mail lặng lẽ ngừng gửi. Code có
>   dự phòng: ghi link xác thực vào `apps/api/logs/dev-emails.log` để lấy thủ công.
>   Kiểm tra định kỳ bằng `nodemailer.verify()`.
>
> Khi nào cần vượt các hạn chế trên thì chuyển sang mục dưới.

Muốn gửi bằng địa chỉ `@lumibach.com` thì **không dùng Gmail được** — Gmail chỉ gửi
bằng địa chỉ đã xác minh, và `lumibach.com` không uỷ quyền cho Gmail trong SPF nên
thư sẽ vào spam. Phải dùng dịch vụ gửi mail giao dịch — khuyến nghị **Resend**
(miễn phí 3.000 mail/tháng) hoặc **Brevo** (300 mail/ngày).

### 4.1 Gửi đi — Resend

1. Đăng ký https://resend.com → **Domains → Add Domain** → `lumibach.com`, Region
   **Tokyo (ap-northeast-1)** — gần Việt Nam nhất. Resend không có vùng Việt Nam;
   vùng chỉ quyết định nơi đặt máy chủ gửi, không ảnh hưởng khả năng thư tới nơi.
   **Không đổi được sau khi tạo**, muốn đổi phải xoá domain rồi thêm lại.
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
- [ ] Đăng nhập được; F5 vẫn giữ phiên; **đăng xuất được**.
- [ ] DevTools → Network: request `/api/v1/...` đi tới `lumibach.com` (không phải
      `localhost:4000`) và trả **200**.
- [ ] Ảnh đại diện / tệp bài tập hiển thị, không lỗi Mixed Content.
- [ ] Nộp file bài tập rồi **xoá** → file biến mất khỏi MinIO (guard `/storage/` còn đúng).
- [ ] Thông báo realtime chạy. DevTools → Network, lọc `/socket.io/`: - status **101** → đang chạy WebSocket (đã có rule `path: ^/socket\.io`) - status **200**, request lặp lại đều đặn → đang chạy long-polling dự phòng.
      Vẫn hoạt động đầy đủ, chỉ tốn băng thông hơn. - status **308** → cả hai đường đều hỏng, kiểm rewrite trong `next.config.ts`
- [ ] Nộp bài code chấm được (Judge0 + WebSocket `/code-execution`).
- [ ] Mở bài Scratch (.sb3) chạy được.
- [ ] Email đặt lại mật khẩu về hộp thư **Inbox**, không phải Spam; xem header có
      `spf=pass` và `dkim=pass`.
- [ ] Từ mạng ngoài, `:9000` (MinIO) và `:2358` (Judge0) **không** truy cập được.
- [ ] **Tắt cloudflared** → `http://localhost:3000` vẫn đăng nhập và dùng bình
      thường. Đây là phép thử quan trọng nhất của cấu hình một-miền.

---

## Hạ tầng production

| Máy                                    | Vai trò                                                    | Trạng thái                          |
| -------------------------------------- | ---------------------------------------------------------- | ----------------------------------- |
| `192.168.53.100:5000`                  | Docker Registry                                            | chưa dùng — repo chưa có Dockerfile |
| `192.168.53.101:5432`                  | PostgreSQL, DB `lumibach_lms`                              | ✅ đang dùng                        |
| `192.168.53.101:6379`                  | Redis 7.4.8 — **cùng máy với Postgres**, không phải `.104` | ✅ đang dùng                        |
| `192.168.53.104`                       | chỉ mở 22 và 3389, không có dịch vụ nào của dự án          | không dùng                          |
| `192.168.53.105:9000`                  | MinIO                                                      | ✅ đang dùng                        |
| `192.168.53.105`                       | cloudflared (cổng vào tên miền)                            | ✅                                  |
| máy Windows (Tailscale `100.66.84.91`) | Next.js :3000, NestJS :4000                                | tạm thời                            |

Chỉ còn ứng dụng chạy tạm trên máy Windows. Khi dời nốt sang server, xem bước dưới.

---

## Bước 7 — Chuyển ứng dụng sang server thật

Hiện hệ thống chạy tạm trên máy Windows, cloudflared trỏ tới nó qua Tailscale
(`100.66.84.91`). Khi dời hẳn sang máy Ubuntu — nơi cloudflared đang chạy — thì:

**Sửa cấu hình: đúng 3 dòng.** Trong `config.yml`, đổi mọi `service:` từ
`http://100.66.84.91:<cổng>` thành `http://localhost:<cổng>`. Hết. Phần còn lại
đã sẵn tính di động: `.env` dùng `localhost` cho kết nối nội bộ và đường dẫn
tương đối cho trình duyệt, nên không phụ thuộc vào máy nào.

**Bê dữ liệu sang** — phần tốn công thật sự:

| Thứ      | Cách chuyển                                                                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postgres | `pg_dump` ở máy cũ → `psql` restore ở máy mới. Đối chiếu số bản ghi vài bảng chính (User, Course, Submission) trước/sau                                         |
| MinIO    | Copy volume: `docker run --rm -v <vol_nguồn>:/from -v <vol_đích>:/to alpine cp -a /from/. /to/` — nhớ copy cả `.minio.sys` để giữ policy public-read của bucket |
| Redis    | Không cần — chỉ chứa cache và hàng đợi tạm                                                                                                                      |
| `.env`   | Chép nguyên si, không sửa gì                                                                                                                                    |

**Thứ tự an toàn:** dựng máy mới và bơm dữ liệu trước → đổi `config.yml` → khởi
động lại cloudflared → kiểm theo Bước 6 → chỉ tắt máy cũ sau khi chạy ổn vài
ngày, giữ volume cũ làm bản lùi.

> **Bẫy đã gặp:** kiểm `docker ps` xem cổng 5432/9000 trên máy mới có bị stack
> khác chiếm không. Trên máy Windows từng có hai bộ Postgres/MinIO chồng nhau,
> khiến ứng dụng nói chuyện với container này còn ta lại đi sửa container kia.

---

## Xử lý sự cố

| Triệu chứng                               | Nguyên nhân thường gặp                                                                                                                                                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Error 1033** từ Cloudflare              | cloudflared CHƯA kết nối — request chưa hề rời khỏi Cloudflare. `sudo journalctl -u cloudflared -n 50`, phải thấy `Registered tunnel connection`. Nếu app chết mà tunnel còn thông thì lỗi là **502**, không phải 1033                  |
| 502 / 1016                                | tunnel thông nhưng cloudflared không với tới dịch vụ — sai IP/cổng trong `config.yml`, hoặc Next.js chưa lên                                                                                                                            |
| Sửa `config.yml` mà không ăn gì           | systemd đang đọc file khác — `systemctl cat cloudflared \| grep ExecStart` xem `--config` trỏ đâu. Tunnel tạo từ dashboard (remotely-managed) thì bỏ qua file local hoàn toàn                                                           |
| Đăng nhập xong bị đá ra ngay              | thiếu `AUTH_TRUST_HOST=true` hoặc `NEXTAUTH_URL` còn `http://localhost:3000`                                                                                                                                                            |
| **Không đăng xuất được ở localhost**      | `AUTH_COOKIE_DOMAIN` còn giá trị. Cookie cấu hình là `__Secure-…` trên `.lumibach.com`, không khớp cookie thật (`authjs.session-token`, host-only) nên NextAuth xoá trượt. Để trống biến này, restart, rồi xoá cookie cũ trong DevTools |
| WebSocket 308, reconnect liên tục         | thiếu rewrite `/socket.io/*` trong `next.config.ts`, hoặc thiếu `skipTrailingSlashRedirect: true` — Next chuyển hướng bỏ dấu `/` cuối TRƯỚC khi rewrite chạy                                                                            |
| socket.io trả 404 `Cannot GET /socket.io` | request tới được NestJS nhưng mất dấu `/` cuối — cần `SocketIoAdapter` (`addTrailingSlash: false`) trong `main.ts`                                                                                                                      |
| Ảnh vỡ, Console báo Mixed Content         | `MINIO_INTERNAL_ENDPOINT` sai, hoặc trong DB còn URL tuyệt đối `http://192.168...` từ trước                                                                                                                                             |
| Link trong email vẫn là localhost         | `NEXT_PUBLIC_APP_URL` chưa đổi, hoặc chưa `pnpm build` lại                                                                                                                                                                              |
| Mail vào Spam                             | DKIM/SPF chưa verify xong, hoặc `SMTP_FROM` không cùng domain đã xác thực                                                                                                                                                               |

---

_Cập nhật: 05/08/2026 — chỉ dùng miền gốc `lumibach.com`, để một bản build chạy được
cả qua tên miền lẫn ở localhost khi tunnel tắt._
