# Scratch tích hợp trong LMS

LMS hỗ trợ Scratch như một loại hoạt động khoá học. Có 2 chế độ vận hành:

| Chế độ                  | UX nộp bài                                                                                  | Cài đặt                                   |
| ----------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Fallback** (mặc định) | Học sinh mở Scratch ở tab mới (TurboWarp.org), tải `.sb3` về máy, kéo vào LMS, bấm Nộp      | Không cần làm gì — hoạt động ngay         |
| **Self-host (Phase B)** | Học sinh code ngay trong LMS, bấm Save trong menu Scratch — bài tự nộp, không thao tác thêm | Phải build `scratch-gui` riêng (xem dưới) |

LMS tự động phát hiện chế độ bằng cách kiểm tra `/scratch-gui/index.html`. Nếu file tồn tại → bật self-host; nếu không → dùng fallback.

## Build self-hosted scratch-gui

### Yêu cầu

- **Node 18+** (đã đáp ứng vì project này đã dùng Node 20)
- **Git**
- **Python 3** (cho scratch-blocks compile pipeline)
- **Java JDK 8+** (Google Closure Compiler chạy bằng Java — bắt buộc để compile scratch-blocks)
  - Windows: tải từ adoptium.net hoặc `winget install EclipseAdoptium.Temurin.21.JDK`
  - Verify: `java -version`
- **Mạng ổn định tới `registry.npmjs.org` và `codeload.github.com`** (npm fetch dễ ECONNRESET nếu mạng yếu)
- **~10 GB ổ cứng trống** (`node_modules` rất lớn)
- **30+ phút** lần đầu (lần sau cache ngắn hơn)
- **Windows**: bật long path support — `git config --system core.longpaths true`

### Chạy build

```bash
pnpm build:scratch-gui
```

Script sẽ tự động:

1. Clone `https://github.com/TurboWarp/scratch-gui.git` (branch `develop`) vào `external/scratch-gui/`
2. Chạy `npm install --legacy-peer-deps` trong thư mục đó
3. **Patch** save handler để thêm `postMessage` về parent window khi học sinh save (đây là cốt lõi của 1-click submit)
4. Build với `STATIC_PATH=/scratch-gui/static` và `ROOT=/scratch-gui/`
5. Copy output từ `external/scratch-gui/build/` sang `public/scratch-gui/`

Sau khi xong, restart Next dev server. Mở bài Scratch trong LMS — sẽ thấy editor nhúng trực tiếp.

### Test self-host

```
http://localhost:3000/scratch-gui/
```

Nếu nó load Scratch IDE → OK. Nếu lỗi 404 → build chưa chạy hoặc chạy fail.

### Cập nhật scratch-gui lên version mới

```bash
pnpm clean:scratch-gui   # xoá cả source và build
pnpm build:scratch-gui   # clone lại từ đầu
```

Hoặc chỉ pull commit mới:

```bash
cd external/scratch-gui && git pull && cd ../..
pnpm build:scratch-gui
```

### MinIO CORS (nếu starter .sb3 không load)

Nếu sau khi build xong mà mở bài Scratch thấy editor load nhưng starter project không xuất hiện, mở Console kiểm tra. Nếu thấy lỗi CORS từ MinIO:

```bash
# Cài MinIO Client (mc)
# Rồi set CORS cho bucket
mc alias set local http://localhost:9000 minioadmin minioadmin_password
mc admin policy attach local readwrite --user minioadmin

# Tạo file cors.json
cat > cors.json <<EOF
[{
  "AllowedOrigin": ["http://localhost:3000"],
  "AllowedMethod": ["GET", "HEAD"],
  "AllowedHeader": ["*"],
  "ExposeHeader": ["ETag", "Content-Length"],
  "MaxAgeSeconds": 3600
}]
EOF

# Apply
mc anonymous set download local/lumibach-files
```

Hoặc đơn giản hơn — proxy qua Next.js API route (sẽ làm sau nếu cần).

### Khi build fail

Lý do hay gặp (theo thứ tự thực tế):

1. **`Could not find "java" in your PATH`** → cài Java JDK (xem mục Yêu cầu)
2. **`ECONNRESET` khi npm fetch** → mạng không ổn định tới npm/github. Thử lại lần khác, hoặc dùng VPN, hoặc đổi mạng (mobile hotspot…)
3. **`EPERM` trên `npm-cache/_cacache/tmp`** → Windows Defender đang quét cache. Tạm tắt real-time scan cho `%LOCALAPPDATA%\npm-cache` trong lúc build
4. **Long path** trên Windows → `git config --system core.longpaths true`
5. **Native dep build fail** (node-gyp) → cài `windows-build-tools` hoặc dùng WSL
6. **Heap out of memory** → tăng heap size: `NODE_OPTIONS=--max-old-space-size=4096 pnpm build:scratch-gui`
7. **Patch không apply** (TurboWarp đổi file structure) → cập nhật `DOWNLOAD_BLOB_CANDIDATES` trong `scripts/build-scratch-gui.mjs`

Khi build fail, **LMS vẫn hoạt động bình thường** vì fallback "mở tab mới" luôn sẵn sàng. Chỉ là chưa có 1-click submit.

## Kiến trúc

```
┌──────────────────────────────────────────────────┐
│  LMS page  /courses/[slug]/scratch/[id]          │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  <iframe src="/scratch-gui/?project_url= │    │
│  │           https://minio/.../starter.sb3"/│    │
│  │                                          │    │
│  │  [Scratch IDE chạy trong iframe]         │    │
│  │                                          │    │
│  │  Học sinh code → File → Save             │    │
│  │  └─ Patched save handler:                │    │
│  │     window.parent.postMessage({          │    │
│  │       type: 'lumibach:scratch-save',     │    │
│  │       sb3: ArrayBuffer                   │    │
│  │     })                                   │    │
│  └──────────────────────────────────────────┘    │
│           │                                       │
│           ▼  postMessage                          │
│  ScratchEditor / ScratchTakePanel listen,         │
│  upload .sb3 lên MinIO, gọi submitScratchAction,  │
│  toast "Đã nộp bài tự động"                       │
└──────────────────────────────────────────────────┘
```

### Vì sao phải patch?

Bản Scratch gốc (Scratch.mit.edu, TurboWarp.org) **chặn iframe**. Phải self-host để cùng origin với LMS — lúc đó browser cho phép `postMessage` cross-frame thoải mái.

Patch chỉ thêm 1 hook nhỏ vào hàm `downloadBlob`: gọi `postMessage` về parent **bên cạnh** việc tải file xuống máy như bình thường. Không phá hành vi gốc của Scratch.

### Tham số URL

`scratch-gui` của TurboWarp đọc các tham số sau khi mount:

| Param                | Mô tả                                                             |
| -------------------- | ----------------------------------------------------------------- |
| `?project_url=<URL>` | Tự động load project Scratch từ URL khi vào (ta dùng cho starter) |

LMS truyền `starterFileUrl` (lưu trong `CodeExercise.starterFileUrl` trên DB) vào tham số này.

## Vận hành

- **Source code scratch-gui** không check-in repo (gitignore `external/scratch-gui/`). Dev nào cần build phải tự chạy lệnh trên.
- **Build output** cũng không check-in (gitignore `public/scratch-gui/`). Mỗi máy / mỗi deploy phải build riêng.
- **Khi deploy (self-host)**: build output không check-in repo, nên trên server phải chạy `pnpm build:scratch-gui` trước `pnpm build` (hoặc thêm vào script build / CI).
