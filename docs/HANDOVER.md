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
docker compose -f docker-compose.prod.yml build
R=192.168.53.100:5000
for n in api worker; do
  docker tag lumibach/$n:latest $R/lumibach/$n:latest && docker push $R/lumibach/$n:latest
done
```

**Trên máy chủ**:

```bash
cd /opt/lumibach
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml --profile tools run --rm migrate
docker compose -f docker-compose.deploy.yml up -d
```

> **Image `web` không đẩy qua registry được.** Proxy nội bộ của Docker Desktop
> timeout với image lớn. Phải chuyển tay:
>
> ```bash
> docker save lumibach/web:latest -o web.tar        # ~436MB
> scp web.tar root@192.168.53.103:/opt/lumibach/
> ssh root@192.168.53.103 'cd /opt/lumibach && docker load -i web.tar && docker tag lumibach/web:latest 192.168.53.100:5000/lumibach/web:latest'
> ```
>
> Nếu sửa được cấu hình bỏ qua proxy cho dải `192.168.53.0/24` thì khỏi bước này.

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

**① Không có container `worker`** → email thông báo nằm im trong Redis, không ai
nhận được nhắc hạn nộp bài.

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
