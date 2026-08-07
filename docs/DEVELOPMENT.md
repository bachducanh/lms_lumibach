# Sửa code và phát hành

Dành cho chủ dự án (máy phát triển Windows). Vận hành máy chủ xem
[HANDOVER.md](HANDOVER.md).

---

## Điều nguy hiểm nhất: `.env` trỏ vào đâu

Hệ thống có hai hồ sơ cấu hình:

| Hồ sơ       | Database              | MinIO  | Dùng khi                 |
| ----------- | --------------------- | ------ | ------------------------ |
| `.env.dev`  | `localhost:5432`      | local  | sửa code, thử nghiệm     |
| `.env.prod` | `192.168.53.101:5432` | `.105` | build image để phát hành |

File `.env` là bản sao của một trong hai. **Nếu đang ở hồ sơ prod mà chạy
`pnpm dev`, mọi thao tác thử nghiệm sẽ ghi thẳng vào dữ liệu học sinh thật.**
Xoá nhầm một khoá học lúc test là mất thật — không có bản nháp nào cả.

Kiểm bất cứ lúc nào:

```bash
pnpm env:which
```

Chuyển hồ sơ:

```bash
pnpm env:dev
```

Thói quen an toàn: **luôn `pnpm env:dev` ngay sau khi phát hành xong.** Lúc build
image là lần duy nhất cần hồ sơ prod.

---

## Vòng lặp sửa code hằng ngày

Bật dịch vụ nền (Postgres, Redis, MinIO, Judge0) — chỉ cần một lần sau khi khởi
động máy:

```bash
docker compose up -d postgres redis minio judge0-db judge0-redis judge0-server judge0-workers
```

Rồi:

```bash
pnpm env:dev && pnpm dev
```

Mở `http://localhost:3000`. Sửa code, trình duyệt tự nạp lại.

Trước khi commit:

```bash
pnpm type-check && pnpm lint && pnpm test
```

`type-check` là bước quan trọng nhất — nó bắt được những phụ thuộc mà tìm bằng
`grep` sẽ bỏ sót (đã từng suýt xoá nhầm worker email vì lý do này).

### Khi đổi schema database

```bash
pnpm db:migrate      # tạo file migration mới trong packages/db/prisma/migrations/
```

File migration **phải được commit**. Máy chủ sẽ tự áp dụng lúc phát hành.

> Trên Windows: dừng `pnpm dev` trước khi chạy `prisma generate`, nếu không sẽ
> lỗi `EPERM` do DLL đang bị khoá.

---

## Phát hành lên máy chủ

Bốn bước, khoảng 15–25 phút. Làm khi không có học sinh đang dùng.

### 1. Đẩy mã nguồn

```bash
git push
```

### 2. Dựng image ở hồ sơ prod

Các biến `NEXT_PUBLIC_*` được **nhúng vào image lúc build**, nên bước này bắt
buộc phải ở hồ sơ prod — build nhầm ở hồ sơ dev sẽ ra image trỏ về `localhost`
và trang web trên tên miền sẽ hỏng.

```bash
pnpm env:prod
docker compose -f docker-compose.prod.yml build
```

### 3. Đẩy image lên registry nội bộ

```bash
R=192.168.53.100:5000
for n in api worker migrate; do
  docker tag lumibach/$n:latest $R/lumibach/$n:latest && docker push $R/lumibach/$n:latest
done
```

Image `web` **chưa đẩy qua registry được** (proxy của Docker Desktop timeout với
image lớn). Chuyển tay:

```bash
docker save lumibach/web:latest -o web.tar
scp web.tar root@192.168.53.103:/opt/lumibach/
```

### 4. Cập nhật máy chủ

SSH vào `192.168.53.103`:

```bash
cd /opt/lumibach
docker load -i web.tar && docker tag lumibach/web:latest 192.168.53.100:5000/lumibach/web:latest
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml --profile tools run --rm migrate
docker compose -f docker-compose.deploy.yml up -d
```

### 5. Về lại hồ sơ dev

```bash
pnpm env:dev
```

---

## Kiểm sau khi phát hành

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://lumibach.com/login       # 200
curl -s -o /dev/null -w "%{http_code}\n" https://lumibach.com/api/v1/me   # 401
```

Rồi **trên trình duyệt**: đăng nhập → đăng xuất → tải ảnh đại diện → nộp một file
→ chấm một bài code Python.

Năm việc này phải làm bằng tay. Lệnh `curl` chỉ nói trang có mở được, không nói
chức năng có chạy không — đã có lần mọi `curl` đều 200 trong khi chấm code hỏng
hoàn toàn.

---

## Ba cái bẫy đã mất nhiều giờ

**Sửa `.env` trên máy chủ không có tác dụng** cho tới khi tạo lại container.
`restart` không đủ:

```bash
docker compose -f docker-compose.deploy.yml up -d --force-recreate api
docker exec lumibach-api printenv JUDGE0_API_URL     # giá trị THẬT đang dùng
```

**Đổi `NEXT_PUBLIC_*` phải build lại image**, sửa `.env` trên máy chủ không đủ.

**Khi thử một dịch vụ, đừng ghi thẳng địa chỉ vào lệnh test.** Làm vậy sẽ đi vòng
qua đúng biến môi trường đang hỏng — phép thử đạt mà ứng dụng vẫn lỗi.
