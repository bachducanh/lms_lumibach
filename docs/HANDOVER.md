# Bàn giao vận hành LumiBach LMS

Tài liệu một-trang cho người tiếp nhận. Đọc hết trước khi triển khai — có vài chỗ
sai là hệ thống **vẫn chạy** nhưng mất chức năng, rất khó phát hiện.

Chi tiết kỹ thuật: [DEPLOYMENT.md](DEPLOYMENT.md) · Tên miền: [DOMAIN_SETUP.md](DOMAIN_SETUP.md)
· Sửa code & phát hành: [DEVELOPMENT.md](DEVELOPMENT.md)

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
| web / api / worker | `192.168.53.103`      | 3 container, `docker-compose.deploy.yml`                   |
| Judge0             | `192.168.53.103`      | 4 container, `docker-compose.judge0.yml`                   |
| PostgreSQL         | `192.168.53.101:5432` | DB `lumibach_lms`                                          |
| Redis              | `192.168.53.101:6379` | cache **và hàng đợi email**                                |
| MinIO              | `192.168.53.105:9000` | dùng chung với dự án khác — chỉ đụng 2 bucket `lumibach-*` |
| Docker Registry    | `192.168.53.100:5000` | kho image, tài khoản `admin`                               |
| cloudflared        | `192.168.53.105`      | cổng vào tên miền, trỏ về `.103`                           |

Tên miền: `lumibach.com` (web + API + WebSocket) và `media.lumibach.com` (file, ảnh).

---

## 2. Máy chủ KHÔNG có Internet — điều này quyết định mọi thứ

`192.168.53.103` chỉ thấy mạng nội bộ, không ra được Internet. Nên **không build
tại chỗ được** (build cần tải ~1200 gói npm và image nền).

Thay vào đó:

```
Máy phát triển (có Internet)      Registry .100         Máy chủ .103
   build image      ──push──▶     lưu image   ──pull──▶   chạy
```

Máy chủ chỉ cần **4 file**, không cần mã nguồn:

```
/opt/lumibach/
├── .env                        ← bí mật, gửi riêng
├── docker-compose.deploy.yml   ← web + api + worker + migrate
├── docker-compose.judge0.yml   ← Judge0
└── judge0.conf
```

### Triển khai lần đầu

```bash
mkdir -p /opt/lumibach && cd /opt/lumibach
# chép 4 file trên sang, rồi:

cat > /etc/docker/daemon.json <<'EOF'
{ "insecure-registries": ["192.168.53.100:5000"] }
EOF
systemctl restart docker

docker login 192.168.53.100:5000 -u admin
docker network create lumibach-net

docker compose -f docker-compose.deploy.yml --profile tools run --rm migrate
docker compose -f docker-compose.deploy.yml up -d
docker compose -f docker-compose.judge0.yml pull    # 14.2GB, mất 7-20 phút
docker compose -f docker-compose.judge0.yml up -d
```

### Phát hành phiên bản mới

**Trên máy phát triển** (có mã nguồn và Internet):

```bash
git pull
pnpm env:prod          # BẮT BUỘC: NEXT_PUBLIC_* và MINIO_INTERNAL_* bị nhúng
                       # vào image lúc build. Build khi .env đang ở hồ sơ dev sẽ
                       # ra image trỏ về localhost — trang trắng trên máy chủ.
docker compose -f docker-compose.prod.yml build

# Image migrate dựng RIÊNG — compose không dựng được nó, xem cảnh báo bên dưới.
docker build -f packages/db/Dockerfile.migrate -t lumibach/migrate:latest .

R=192.168.53.100:5000
for n in api worker migrate; do
  docker tag lumibach/$n:latest $R/lumibach/$n:latest && docker push $R/lumibach/$n:latest
done
pnpm env:dev           # trả .env về hồ sơ dev, tránh `pnpm dev` ghi vào DB thật
```

> **Có HAI thứ tên `migrate`, đừng lẫn.**
>
> - `packages/db/Dockerfile.migrate` → image **thật** máy chủ kéo về. Nhỏ (~420MB),
>   chỉ có Prisma CLI + `prisma/`, và tự chạy nhờ `CMD`. Dựng bằng `docker build`
>   như trên.
> - Service `migrate` trong `docker-compose.prod.yml` → chỉ là lối chạy migration
>   tiện tay lúc dev. Nó mượn stage `build` của API và dựa hoàn toàn vào
>   `command:` trong compose; image sinh ra KHÔNG có `CMD`.
>
> Dựng nhầm cái thứ hai rồi push đè lên tag của cái thứ nhất thì `docker compose
run --rm migrate` trên máy chủ **rơi vào REPL của Node** và không migrate gì cả.
>
> **`migrate` phải nằm trong vòng push.** Quên push thì máy chủ chạy migrate bằng
> image cũ: lệnh vẫn báo thành công, mà migration mới không được áp — dữ liệu và
> mã nguồn lệch nhau, biểu hiện ra là màn hình trống hoặc số liệu sai. Đây đúng
> là sự cố Kho năng lực ngày 13/8.

> **Image `web` không đẩy qua registry được.** Proxy nội bộ của Docker Desktop
> timeout với image lớn. Chuyển tay từ máy phát triển:
>
> ```bash
> docker save lumibach/web:latest -o web.tar        # ~390MB
> scp web.tar root@192.168.53.103:/opt/lumibach/
> ```
>
> Nếu sửa được cấu hình bỏ qua proxy cho dải `192.168.53.0/24` thì khỏi bước này.

**Trên máy chủ** — thứ tự dưới đây quan trọng, đừng đảo:

```bash
cd /opt/lumibach

# 1. Sao lưu DB TRƯỚC — chạy trên MÁY PHÁT TRIỂN, xem mục "Sao lưu" bên dưới.
#    Máy .103 KHÔNG có pg_dump (chỉ chạy container, không có Internet để cài).
#    Migration chỉ đi một chiều, không có đường lùi.

# 2. Kéo 3 image đi qua registry. CHỈ NÊU ĐÍCH DANH — xem cảnh báo bên dưới.
docker compose -f docker-compose.deploy.yml pull api worker
docker compose -f docker-compose.deploy.yml --profile tools pull migrate

# 3. Nạp image web (làm SAU bước 2)
docker load -i web.tar
docker tag lumibach/web:latest 192.168.53.100:5000/lumibach/web:latest

# 4. Áp migration, rồi mới lên bản mới
docker compose -f docker-compose.deploy.yml --profile tools run --rm migrate
docker compose -f docker-compose.deploy.yml up -d
```

> **Đừng chạy `docker compose pull` trống.** Không nêu tên service thì nó kéo cả
> `web` từ registry — mà bản `web` trên đó luôn cũ, vì `web` chuyển tay qua
> `web.tar` chứ không push. Chạy sau bước `docker load` là đè mất đúng bản vừa
> nạp, và triệu chứng là "đã deploy rồi mà giao diện vẫn như cũ".
>
> **Migration chạy TRƯỚC `up -d`.** Ngược lại thì có một khoảng mã mới đọc lược
> đồ cũ: trang lỗi hoặc hiện rỗng, đúng như sự cố Kho năng lực ngày 13/8.

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

## 4. Những lỗi im lặng — kiểm ngay sau khi triển khai

Tất cả đều khiến hệ thống **trông như đang chạy tốt** mà thực ra mất chức năng.

**⓪ Sửa `.env` mà không tạo lại container.** Container giữ giá trị CŨ trong bộ
nhớ — sửa file không có tác dụng, và `restart` cũng KHÔNG đủ:

```bash
docker compose -f docker-compose.deploy.yml up -d --force-recreate api
docker exec lumibach-api printenv JUDGE0_API_URL     # giá trị THẬT đang dùng
```

Luôn kiểm bằng `printenv`, đừng tin vào nội dung file `.env`. Lỗi này từng làm
chấm code chết dù `.env` trên máy chủ đã hoàn toàn đúng.

**① Container `worker` không chạy, HOẶC chạy trên máy không có Internet** →
email nằm im trong Redis, không ai nhận được gì.

Worker là **nơi duy nhất thật sự gửi email**, nên nó phải đặt ở máy với tới được
`smtp.gmail.com:587`. Máy ứng dụng `.103` không có Internet — đặt worker ở đó thì
mọi email đều thất bại trong im lặng. Kiểm đường ra trước khi tin là xong:

```bash
timeout 10 bash -c 'exec 3<>/dev/tcp/smtp.gmail.com/587 && head -c 40 <&3'
```

```bash
docker compose -f docker-compose.prod.yml logs worker | tail -3   # "[email-worker] started"
```

**② `JUDGE0_API_URL` sai** → chấm code chết trong khi mọi trang vẫn mở được.

Phải là `http://judge0-server:2358` — tên service trong mạng `lumibach-net`.
**Không dùng `localhost:2358`**: bên trong container, `localhost` là chính
container đó chứ không phải máy chủ.

Kiểm bằng cách chấm thử một bài từ trong container api. Lệnh dưới đọc
`process.env.JUDGE0_API_URL` chứ **không ghi thẳng địa chỉ** — nếu ghi thẳng thì
phép thử vẫn đạt trong khi ứng dụng thật vẫn hỏng:

```bash
docker exec lumibach-api node -e "const u=process.env.JUDGE0_API_URL;console.log('dang dung:',u);fetch(u+'/submissions?base64_encoded=false&wait=true',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language_id:71,source_code:'print(2+3)'})}).then(r=>r.json()).then(d=>console.log(d.stdout,d.status&&d.status.description))"
```

Phải ra `5` và `Accepted`. Sau đó vẫn nên chấm thử một bài **trên trình duyệt** —
đó mới là đường đi thật của người dùng.

**③ Thiếu `CRON_SECRET`** → `/api/cron/purge-trash` từ chối mọi lần gọi nên thùng
rác không bao giờ được dọn; còn `/api/cron/due-soon` thì ngược lại, bỏ qua kiểm
tra và ai gọi cũng được.

**④ Thiếu `TZ=Asia/Ho_Chi_Minh`** → mọi mốc thời gian render phía server hiển thị
lệch 7 tiếng. Ba compose file đã khai sẵn cho `api`, `web`, `worker`; nếu tự viết
lệnh `docker run` thì phải tự thêm.

```bash
docker exec lumibach-web date        # phải ra giờ Việt Nam
```

Lần triển khai đầu sau bản fix múi giờ còn phải chạy **một lần duy nhất** script
kéo lùi 7 tiếng cho các mốc đã lưu sai trước đó (xem đầu file
`packages/db/scripts/shift-legacy-dates.ts` — chạy hai lần là hỏng dữ liệu):

```bash
pnpm --filter @lumibach/db db:shift-legacy-dates            # xem trước
pnpm --filter @lumibach/db db:shift-legacy-dates --apply    # ghi thật
```

**⑤ Trình soạn Scratch** — bản build đã có sẵn trong git, không phải làm gì thêm.
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

Chạy trên **máy phát triển**, không phải `.103` — máy đó chỉ có Docker, không có
`pg_dump` và cũng không có Internet để cài. Dùng luôn container cho khỏi cài gì:

```bash
mkdir -p /e/lumibach-backups
DB=$(grep -m1 '^DATABASE_URL=' .env.prod | cut -d= -f2- | tr -d '"' | sed 's/?.*//')
docker run --rm -e DBURL="$DB" postgres:17-alpine sh -c 'pg_dump "$DBURL" -Fc' \
  > /e/lumibach-backups/lumibach-$(date +%F-%H%M).dump
```

Ba điểm dễ sai:

- **Phải cắt `?schema=public`** khỏi `DATABASE_URL`. Đó là tham số riêng của
  Prisma, `libpq` gặp là báo `invalid URI query parameter` rồi thoát.
- **Bản `pg_dump` phải bằng hoặc mới hơn máy chủ.** Production đang chạy
  PostgreSQL **17**; dùng `postgres:16-alpine` là bị từ chối thẳng.
- **Kiểm lại file, đừng tin exit code.** Thư mục lưu ngoài repo có chủ đích: dump
  chứa dữ liệu cá nhân học sinh, để trong repo là có ngày lỡ tay commit.

```bash
docker run --rm -i postgres:17-alpine pg_restore -l < <file>.dump | grep -c "TABLE DATA"
```

Ra khoảng 60+ bảng là dump lành. Ra 0 hoặc lệnh báo lỗi thì file hỏng — đừng
chạy migration cho tới khi có bản sao lưu đọc được.

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
