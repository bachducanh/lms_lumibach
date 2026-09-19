# Bàn giao vận hành LumiBach LMS

Tài liệu một-trang cho người vận hành. Đọc hết trước khi đụng vào máy chủ — có
vài chỗ sai là hệ thống **vẫn chạy** nhưng mất chức năng, rất khó phát hiện.

Từ **19/9/2026** toàn bộ hệ thống chạy trên **một cloud VPS**. Cụm máy nội bộ cũ
(`192.168.53.100/101/103/105`, registry, `docker-compose.deploy.yml`) đã ngừng —
đừng làm theo tài liệu cũ nào còn nhắc tới chúng.

Chi tiết kỹ thuật: [DEPLOYMENT.md](DEPLOYMENT.md) · Sửa code: [DEVELOPMENT.md](DEVELOPMENT.md)

---

## 1. Hệ thống gồm những gì

```
Trình duyệt ─HTTPS─▶ Cloudflare ─tunnel─▶ cloudflared ─┬─▶ web    :3000  (Next.js)
                                                       ├─▶ api    :4000  (NestJS, cả /socket.io)
                                                       └─▶ minio  :9000  (media.lumibach.com)
```

| Thứ         | Ở đâu                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Máy chủ     | VPS `222.255.182.231` — Ubuntu 24.04, 4 CPU / 8GB / 50GB, Đà Nẵng. Hạn trên trang nhà cung cấp |
| Mọi dịch vụ | Docker, file [`docker-compose.single.yml`](../docker-compose.single.yml) ở `/opt/lumibach`     |
| Tên miền    | `lumibach.com`, mua ở **P.A Việt Nam**, nameserver trỏ về Cloudflare                           |
| Cloudflare  | Tài khoản của chủ dự án. Tunnel tên `lumibach`, chạy bằng `TUNNEL_TOKEN` trong `.env`          |
| Sao lưu     | `/opt/lumibach/backups` (hằng ngày) + `E:/lumibach-backups` trên máy phát triển                |

Container: `lumibach-{web,api,worker,postgres,redis,minio,cloudflared}` và
`judge0-{server,workers,db,redis}`.

**Route của tunnel** (Cloudflare → Networking → Tunnels → lumibach → Routes),
thứ tự quan trọng — khớp từ trên xuống:

1. `lumibach.com` path `^/socket\.io` → `http://api:4000`
2. `lumibach.com` → `http://web:3000`
3. `media.lumibach.com` → `http://minio:9000`

---

## 2. Vào máy chủ

```bash
ssh -i ~/.ssh/lumibach_ed25519 root@222.255.182.231
```

**Chỉ vào được bằng khoá SSH** — đăng nhập bằng mật khẩu đã tắt
(`/etc/ssh/sshd_config.d/00-lumibach.conf`). Khoá nằm trên máy phát triển;
**sao lưu file `~/.ssh/lumibach_ed25519` ra chỗ khác**. Mất khoá thì vào bằng
"Màn hình điều khiển" trên trang quản trị nhà cung cấp, rồi thêm khoá mới vào
`/root/.ssh/authorized_keys`.

Tường lửa `ufw` chỉ mở cổng 22. **Không `ports:` nào trong compose được mở ra
`0.0.0.0`** — Docker tự chèn luật iptables qua mặt ufw, nên `'5432:5432'` là lộ
DB ra Internet dù tường lửa đang bật. web/api chỉ nghe ở `127.0.0.1`.

---

## 3. Phát hành phiên bản mới

Máy chủ có Internet nên **build ngay tại chỗ**. Từ máy phát triển, trong thư mục repo:

```bash
# 1. Chép mã nguồn lên (chỉ file có trong git, không kèm .env của máy dev)
git ls-files -z | tar --null -T - -czf - | ssh -i ~/.ssh/lumibach_ed25519 root@222.255.182.231 'tar -C /opt/lumibach -xzf -'

# 2. Sao lưu về máy mình TRƯỚC — migration chỉ đi một chiều
bash scripts/backup-full.sh
```

Rồi trên máy chủ:

```bash
cd /opt/lumibach
C="docker compose -f docker-compose.single.yml"
$C --profile tools build migrate api worker web      # 10-20 phút
$C --profile tools run --rm migrate                   # migration TRƯỚC
$C up -d                                              # rồi mới lên bản mới
docker builder prune -af                              # ổ chỉ 50GB, cache build 10-15GB
```

> **Migration chạy TRƯỚC `up -d`.** Ngược lại có một khoảng mã mới đọc lược đồ
> cũ: trang lỗi hoặc hiện rỗng (sự cố Kho năng lực 13/8).
>
> **Đổi tên miền thì phải build lại `web`.** `NEXT_PUBLIC_*` bị nhúng vào image
> lúc build; sửa `.env` không đủ.

---

## 4. Những lỗi im lặng — kiểm ngay sau mỗi lần triển khai

**⓪ Sửa `.env` mà không tạo lại container.** `restart` KHÔNG đủ:

```bash
docker compose -f docker-compose.single.yml up -d --force-recreate api
docker exec lumibach-api printenv JUDGE0_API_URL      # giá trị THẬT đang dùng
```

**① Chấm code.** `JUDGE0_API_URL` phải là `http://judge0-server:2358`. Thử bằng
chính biến của ứng dụng, đừng ghi thẳng địa chỉ vào lệnh thử:

```bash
docker exec lumibach-api node -e "const u=process.env.JUDGE0_API_URL;fetch(u+'/submissions?base64_encoded=false&wait=true',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language_id:71,source_code:'print(2+3)'})}).then(r=>r.json()).then(d=>console.log(u,d.stdout,d.status.description))"
```

Phải ra `5` và `Accepted`. Judge0 1.13.1 chạy được trên cgroup v2 của máy này —
**không** cần sửa GRUB về cgroup v1 như nhiều hướng dẫn trên mạng.

**② Email.** Worker là nơi duy nhất gửi mail; nó chạy thì log có
`[email-worker] started`. Gmail cá nhân giới hạn ~500 người nhận/ngày và mật khẩu
ứng dụng có thể bị thu hồi không báo.

**③ Giờ.** `docker exec lumibach-web date` phải ra giờ Việt Nam.

**④ Kiểm qua tên miền** — đường người dùng thật đi:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://lumibach.com/login              # 200
curl -s -o /dev/null -w "%{http_code}\n" https://lumibach.com/api/v1/me          # 401 (đúng)
curl -s -o /dev/null -w "%{http_code}\n" "https://lumibach.com/socket.io/?EIO=4&transport=polling"  # 200
```

Rồi trên trình duyệt: đăng nhập → **đăng xuất** → tải ảnh đại diện → nộp một file
rồi xoá → nộp một bài code.

---

## 5. Việc chạy theo lịch

Cài từ [`scripts/server/crontab`](../scripts/server/crontab) bằng
`bash scripts/server/install-cron.sh` (tự điền `CRON_SECRET` từ `.env`). Log ở
`/var/log/lumibach-cron.log`.

| Giờ         | Việc                                                           |
| ----------- | -------------------------------------------------------------- |
| 02:00       | Sao lưu DB (giữ 14 bản) + bản sao MinIO                        |
| 03:00       | Dọn khoá học / hoạt động quá 30 ngày trong thùng rác           |
| mỗi 15 phút | Phòng chức năng: đơn đã duyệt quá giờ mà chưa nhận → `NO_SHOW` |
| 03:30       | Dọn ảnh bàn giao quá hạn lưu giữ                               |
| CN 04:00    | Dọn image/cache Docker cũ                                      |

`/api/cron/due-soon` (nhắc hạn nộp bài qua mail) **chưa bật**. Bật thì thêm một
dòng vào file crontab rồi cài lại.

---

## 6. Sao lưu và khôi phục

Hai tầng:

- **Trên máy chủ**, hằng ngày lúc 2h: `/opt/lumibach/backups/`. Chỉ cứu được lỗi
  thao tác — mất cả máy là mất luôn.
- **Trên máy phát triển**, chạy tay mỗi tuần và trước mỗi lần phát hành:

  ```bash
  bash scripts/backup-full.sh          # → E:/lumibach-backups/full-<thời điểm>
  ```

  Thư mục nằm ngoài repo có chủ đích: dump chứa dữ liệu cá nhân học sinh.

Nhà cung cấp cũng đang bật "Tự động Backup Server" (chụp cả máy).

**Khôi phục** — GHI ĐÈ toàn bộ DB và file trên máy chủ, dùng cả khi dời sang máy khác:

```bash
bash scripts/restore-to-server.sh E:/lumibach-backups/full-<thời điểm>
```

MinIO có **3** bucket: `lumibach-avatars` và `lumibach-files` cho đọc ẩn danh
**từng file** (chỉ `s3:GetObject`); `lumibach-handovers` riêng tư. Đừng dùng
`mc anonymous set download` — nó kèm quyền liệt kê, ai cũng xem được danh sách
tên file bài nộp.

---

## 7. Vận hành hằng ngày

```bash
cd /opt/lumibach; C="docker compose -f docker-compose.single.yml"
$C ps                         # trạng thái
$C logs -f --tail 100 api     # log
$C restart api                # khởi động lại (KHÔNG đọc lại .env — xem ⓪)
df -h /                       # ổ đĩa — quá 80% là phải dọn hoặc nâng gói
```

Dời sang máy khác: cài Docker, chép mã nguồn + `.env` + `judge0.conf` lên
`/opt/lumibach`, build, `restore-to-server.sh` với `SERVER=root@<ip mới>`, bật
`cloudflared` (`$C --profile tunnel up -d cloudflared`) — tên miền tự theo tunnel,
không phải sửa DNS. Tắt cloudflared ở máy cũ trước khi nạp dữ liệu lần cuối.
