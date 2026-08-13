# PROMPT CHO CLAUDE CODE — Module "Phòng chức năng" (LMS Lumibach)

> Cách dùng: mở Claude Code tại thư mục gốc dự án LMS Lumibach, dán **PHẦN 0 + PHẦN 1** trước để Claude khảo sát codebase và chốt kế hoạch. Sau khi duyệt kế hoạch, dán tiếp từng Phase (PHẦN 4) để triển khai. Không nên dán toàn bộ và bảo "làm hết" — module này khá lớn, chia phase sẽ cho chất lượng cao hơn nhiều.

---

## PHẦN 0 — KHẢO SÁT TRƯỚC KHI VIẾT CODE

Bạn đang làm việc trong dự án **LMS Lumibach** (hệ thống LMS đã chạy thật). Tôi cần bổ sung một module mới tên là **"Phòng chức năng"**.

**Trước khi viết bất kỳ dòng code nào**, hãy khảo sát codebase và báo cáo lại cho tôi:

1. Stack thực tế: framework backend, ORM, hệ CSDL, framework frontend, thư viện UI/CSS, cách quản lý state, cách build.
2. Cơ chế xác thực & phân quyền hiện có: bảng user, model role/permission, middleware/guard kiểm tra quyền, cách phân biệt các vai trò (giáo viên, trợ giảng, quản trị viên, học sinh...).
3. Cấu trúc sidebar: file nào định nghĩa menu, menu item được render và ẩn/hiện theo quyền như thế nào.
4. Quy ước code hiện tại: cấu trúc thư mục theo feature hay theo layer, quy ước đặt tên bảng/cột (snake_case?), quy ước migration, cách viết API (REST/GraphQL/RPC), cách xử lý lỗi, cách validate input.
5. Hạ tầng sẵn có mà tôi có thể tái sử dụng: upload/lưu trữ file (local hay S3-compatible?), hệ thống thông báo (in-app/email/push?), job queue, i18n, thư viện ngày giờ, múi giờ mặc định (dự án dùng `Asia/Ho_Chi_Minh`).
6. Đã có sẵn component nào dạng calendar/lịch/table chưa? Có thể tái sử dụng không?

Xuất báo cáo ngắn gọn theo dạng bảng "hạng mục → đường dẫn file → nhận xét", kèm **danh sách giả định** bạn buộc phải đưa ra và **câu hỏi cần tôi trả lời**. **Dừng lại chờ tôi xác nhận**, chưa viết code.

---

## PHẦN 1 — MÔ TẢ NGHIỆP VỤ

### 1.1. Bối cảnh

Trường có các "phòng chức năng" (hiện tại: **Phòng Tin học 1 – máy Windows** và **Phòng Tin học 2 – máy MacBook**; sau này sẽ có thêm phòng khác). Giáo viên cần đăng ký mượn phòng theo khung giờ, hoặc chỉ mượn thiết bị của phòng đó. Quản trị viên duyệt, giao chìa khoá, và cần bằng chứng bàn giao rõ ràng ở cả hai đầu (nhận phòng / trả phòng).

### 1.2. Vai trò

| Vai trò                 | Quyền                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Giáo viên / Trợ giảng   | Thấy tab "Phòng chức năng"; xem lịch; tạo, sửa (khi còn `pending`), huỷ đơn của mình; check-in / check-out đơn của mình               |
| Quản trị viên (Admin)   | Toàn quyền + duyệt/từ chối đơn, CRUD phòng, CRUD nội quy, CRUD trường bàn giao, CRUD danh mục thiết bị, xem toàn bộ lịch sử & báo cáo |
| Học sinh / vai trò khác | **Không** thấy tab này                                                                                                                |

Tab **"Phòng chức năng"** xuất hiện trên sidebar chỉ với 3 vai trò đầu. Việc ẩn/hiện phải được kiểm tra **cả ở backend** (mọi endpoint đều check quyền), không chỉ ẩn ở UI.

### 1.3. Luồng mượn phòng

1. Giáo viên vào tab → chọn phòng chức năng.
2. Hiển thị **lịch tuần** (xem mục 2.3) hiển thị các slot đã đặt của phòng đó.
3. Chọn khung giờ trống → mở form đăng ký gồm: **Họ và tên**, **Mã nhân viên**, **Tổ chuyên môn**, **Lý do mượn phòng**, thời gian bắt đầu/kết thúc. (Họ tên / mã NV / tổ chuyên môn tự động điền từ hồ sơ người dùng nếu có, cho phép sửa; nếu hồ sơ chưa có trường "mã nhân viên"/"tổ chuyên môn" thì bổ sung vào bảng user hoặc bảng hồ sơ mở rộng.)
4. Đơn ở trạng thái **Chờ duyệt**. **Không cho phép trùng giờ** trên cùng một phòng.
5. Admin duyệt hoặc từ chối (từ chối bắt buộc nhập lý do). Người đăng ký nhận thông báo.
6. Khi được duyệt, thông báo có nội dung: _"Đơn đã được duyệt. Vui lòng gặp Quản trị viên để nhận chìa khoá."_ kèm **nội quy phòng** (nội dung do admin soạn/sửa được).
7. **Check-in** (đầu buổi): giáo viên phải (a) tick xác nhận đã đọc nội quy, (b) điền các **trường bàn giao** do admin cấu hình (VD: số máy cho mượn, số sạc cho mượn, số chuột...), (c) ghi **mô tả tình trạng phòng** hiện tại, (d) **chụp ảnh trực tiếp bằng camera** làm minh chứng.
8. **Check-out** (cuối buổi): lặp lại đúng bộ trường bàn giao (số máy trả, số sạc trả...), mô tả tình trạng phòng sau khi dùng, chụp ảnh minh chứng. Hệ thống **tự so sánh** số liệu check-in vs check-out và cảnh báo nếu lệch.
9. Sau check-out, hiện thông báo: _"Vui lòng mang trả chìa khoá cho Quản trị viên."_ Admin xác nhận đã nhận lại chìa khoá → đơn **Hoàn tất**.

### 1.4. Luồng mượn thiết bị

Trong mỗi phòng có **2 tab**: **Mượn phòng** và **Mượn thiết bị**.

Form mượn thiết bị: Họ và tên, Mã nhân viên, Tổ chuyên môn, **khung giờ sử dụng**, Lý do, **danh sách thiết bị** (chọn nhiều, mỗi thiết bị kèm **số lượng**). Danh mục thiết bị do admin CRUD, gắn theo phòng, mỗi thiết bị có tổng số lượng khả dụng.

Ràng buộc: với mỗi thiết bị, tổng số lượng đã được duyệt/đang mượn trong các khung giờ **giao nhau** không được vượt quá tổng số lượng của thiết bị đó. UI phải hiển thị "còn lại X/Y trong khung giờ đã chọn" theo thời gian thực.

Luồng duyệt → bàn giao (chụp ảnh lúc nhận và lúc trả, ghi tình trạng) giống mượn phòng.

> Lưu ý nghiệp vụ: mượn thiết bị **không** chiếm slot phòng trên lịch (giáo viên có thể mang thiết bị đi lớp khác). Nếu tôi nói ngược lại thì hãy hỏi tôi.

---

## PHẦN 2 — YÊU CẦU KỸ THUẬT BẮT BUỘC

### 2.1. Mô hình dữ liệu (đề xuất — bạn điều chỉnh cho khớp quy ước dự án)

- `function_rooms` — id, name, code, location, capacity, description, is_active, sort_order, timestamps.
- `room_rules` — room_id, content (rich text), version, updated_by, updated_at. **Lưu lịch sử phiên bản**; mỗi booking ghi nhận `rule_version_accepted` để về sau biết giáo viên đã đồng ý bản nội quy nào.
- `handover_fields` — room_id (null = áp dụng toàn hệ thống), label, key, data_type (`number` | `text` | `select` | `boolean`), options (json), is_required, applies_to (`checkin` | `checkout` | `both`), sort_order, is_active.
- `room_bookings` — id, room_id, user_id, full_name, staff_code, department, reason, start_at, end_at, status, approved_by, approved_at, reject_reason, key_returned_at, key_returned_confirmed_by, timestamps.
- `equipment` — room_id, name, code, unit, total_quantity, description, is_active.
- `equipment_bookings` — id, room_id, user_id, full_name, staff_code, department, reason, start_at, end_at, status, approved_by... (song song với `room_bookings`).
- `equipment_booking_items` — equipment_booking_id, equipment_id, quantity.
- `handovers` — polymorphic (`bookable_type`, `bookable_id`), type (`checkin` | `checkout`), performed_by, performed_at (**giờ server**), condition_note, field_values (json), timestamps.
- `handover_photos` — handover_id, file_path, mime, size, sha256, captured_at_server, exif_stripped, width/height.
- `notifications` — tái sử dụng hệ thống thông báo sẵn có nếu đã có.
- `audit_logs` — actor_id, action, entity, entity_id, before/after (json), ip, user_agent.

**Trạng thái booking (dùng chung cho cả 2 loại):**
`pending` → `approved` → `checked_in` → `checked_out` → `completed`
Nhánh phụ: `rejected`, `cancelled` (người dùng tự huỷ khi còn `pending`/`approved`), `no_show` (job tự động đánh dấu khi quá giờ mà không check-in).
Viết chuyển trạng thái thành **state machine tường minh**, chặn mọi bước nhảy không hợp lệ ở tầng service, có unit test cho ma trận chuyển trạng thái.

### 2.2. Chống trùng lịch — làm cho chắc

Đây là phần dễ sai nhất, hãy làm nghiêm túc:

- Chặn ở **3 lớp**: UI (không cho chọn slot bận), validation ở service (kiểm tra overlap trong transaction), và **ràng buộc ở tầng CSDL**.
- Nếu là PostgreSQL: dùng `EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE (status IN ('pending','approved','checked_in'))` (cần extension `btree_gist`). Nếu là MySQL: dùng `SELECT ... FOR UPDATE` trên các booking giao nhau bên trong transaction, cộng thêm kiểm tra lại trước khi commit.
- Quy ước khoảng thời gian là **nửa mở `[start, end)`** — booking 9:00–10:00 và 10:00–11:00 **không** coi là trùng.
- **Đơn `pending` vẫn giữ chỗ** (tránh việc admin duyệt hai đơn trùng giờ). Hãy nêu rõ điều này trên UI: "Khung giờ đang có đơn chờ duyệt".
- Toàn bộ thời gian lưu ở **UTC**, hiển thị theo `Asia/Ho_Chi_Minh`. Không bao giờ so sánh thời gian bằng chuỗi.
- Ràng buộc bổ sung, cấu hình được ở phần cài đặt admin: giờ mở cửa (VD 07:00–17:30), số ngày được đặt trước tối đa, thời lượng tối thiểu/tối đa mỗi lượt, có cho đặt vào cuối tuần/ngày lễ không.

### 2.3. Giao diện lịch

Tham chiếu bố cục lịch tuần của Microsoft Teams (ảnh minh hoạ tôi gửi), **nhưng đơn giản hoá cho đúng mục đích đăng ký phòng**:

- Chế độ xem: **Tuần làm việc (T2–T7)** mặc định, thêm **Ngày** và **Tháng**; điều hướng Hôm nay / ‹ / ›.
- Trục dọc = giờ (bước 30 phút, cấu hình được); cột = ngày. Đường kẻ chỉ thời điểm hiện tại.
- Mỗi block hiển thị: tên người mượn + tổ chuyên môn + trạng thái (màu sắc phân biệt: chờ duyệt / đã duyệt / đang sử dụng / hoàn tất / bị từ chối). **Kèm cả biểu tượng hoặc nhãn chữ** — không chỉ dựa vào màu (yêu cầu khả năng tiếp cận).
- Kéo-chọn khoảng trống để mở form đặt nhanh; click block để xem chi tiết.
- Bộ lọc: theo tổ chuyên môn, theo trạng thái, "chỉ hiện đơn của tôi".
- **Responsive**: trên điện thoại chuyển sang danh sách theo ngày (agenda view) thay vì lưới. Giáo viên sẽ check-in bằng điện thoại nên phần này bắt buộc phải làm tốt.
- Ưu tiên dùng thư viện lịch có sẵn phù hợp với stack thay vì tự viết lưới từ đầu — hãy đề xuất 2 lựa chọn kèm ưu/nhược điểm trước khi chọn.

### 2.4. Chụp ảnh minh chứng bằng camera

- Dùng `navigator.mediaDevices.getUserMedia` với `facingMode: 'environment'`; kèm phương án dự phòng `<input type="file" accept="image/*" capture="environment">` cho trình duyệt không hỗ trợ. Xử lý tử tế trường hợp người dùng từ chối quyền camera (hiện hướng dẫn bật lại quyền).
- Chỉ hoạt động trên HTTPS — ghi chú rõ trong tài liệu triển khai.
- **Thời gian là do server quyết định.** Không tin `captured_at` từ client, không tin EXIF. Lưu `server_received_at`; nếu lệch quá ngưỡng (VD 5 phút) so với timestamp client thì gắn cờ để admin xem lại.
- Dán **watermark** lên ảnh ở phía server: thời gian server, tên phòng, họ tên người mượn, mã đơn. Xoá EXIF, nén ảnh (cạnh dài tối đa ~1600px, chất lượng ~80%), lưu `sha256` để phát hiện chỉnh sửa/trùng lặp.
- Số ảnh: tối thiểu 1, tối đa 5 mỗi lần bàn giao (cấu hình được).
- File ảnh **không được truy cập công khai** — phải qua endpoint có kiểm tra quyền (chỉ người mượn + admin).
- Có chính sách lưu giữ: job dọn ảnh cũ hơn N tháng (cấu hình được, mặc định 12 tháng).
- Cho phép check-in trong cửa sổ ±15 phút quanh giờ bắt đầu (cấu hình được); ngoài khoảng đó cần admin mở khoá.

### 2.5. Trang quản trị

Admin CRUD được: phòng chức năng, nội quy từng phòng (soạn thảo rich text + xem lịch sử phiên bản), trường bàn giao động, danh mục thiết bị & số lượng, và các tham số đặt phòng ở mục 2.2.

Thêm màn hình **Hàng chờ duyệt** (duyệt/từ chối hàng loạt, kèm cảnh báo xung đột) và **Báo cáo**: tần suất sử dụng theo phòng/tổ chuyên môn/tháng, danh sách đơn no-show, danh sách bàn giao có số liệu lệch, xuất Excel/CSV.

### 2.6. Yêu cầu phi chức năng

- Mọi endpoint kiểm tra quyền ở backend; giáo viên chỉ đọc/sửa được đơn của chính mình.
- Ghi `audit_logs` cho: duyệt, từ chối, huỷ, sửa nội quy, sửa trường bàn giao, sửa thiết bị, xác nhận trả chìa khoá.
- Toàn bộ chuỗi giao diện bằng **tiếng Việt**, đi qua lớp i18n của dự án (đừng hard-code chuỗi rải rác).
- Thời gian hiển thị định dạng 24h, ngày dạng dd/MM/yyyy.
- Test: unit test cho logic overlap + state machine + tính khả dụng thiết bị; integration test cho luồng đăng ký → duyệt → check-in → check-out → hoàn tất; test đặt đồng thời (2 request cùng lúc vào cùng slot → đúng 1 thành công).
- Migration phải có `down`/rollback. Có seeder tạo sẵn 2 phòng tin học, vài thiết bị mẫu, nội quy mẫu.

---

## PHẦN 3 — QUY TẮC LÀM VIỆC

- **Bám theo quy ước có sẵn của dự án.** Nếu quy ước hiện tại khác đề xuất trong prompt này, hãy theo dự án và nói cho tôi biết bạn đã đổi gì.
- Không refactor những phần không liên quan. Không thêm dependency nặng nếu chưa hỏi.
- Không sửa schema/bảng dùng chung khi chưa xin phép (đặc biệt là bảng `users`).
- Sau mỗi phase: chạy test + linter, tóm tắt file đã thêm/sửa, nêu rõ những gì **chưa** làm, rồi **dừng chờ tôi review**.
- Gặp chỗ mơ hồ về nghiệp vụ: **hỏi, đừng tự đoán**. Nếu buộc phải giả định, ghi giả định đó vào đầu phần tóm tắt.
- Commit nhỏ, message rõ ràng theo quy ước dự án.

---

## PHẦN 4 — CHIA PHASE

**Phase 0 — Khảo sát & thiết kế.** Thực hiện PHẦN 0. Bổ sung: sơ đồ ERD, danh sách endpoint API, sơ đồ state machine, danh sách màn hình. Chưa viết code sản phẩm. → Dừng chờ duyệt.

**Phase 1 — Nền tảng.** Migration + model + seeder + phân quyền + tab sidebar + trang danh sách phòng (đọc). Kèm test cho model & quyền.

**Phase 2 — Lịch & đăng ký phòng.** Lịch tuần, tạo/sửa/huỷ đơn, chống trùng 3 lớp, agenda view cho mobile. Kèm test overlap và test đặt đồng thời.

**Phase 3 — Duyệt & thông báo.** Hàng chờ duyệt của admin, duyệt/từ chối, thông báo (in-app + email nếu dự án có sẵn), hiển thị nội quy khi duyệt.

**Phase 4 — Bàn giao & camera.** Trường bàn giao động, check-in/check-out, chụp ảnh + watermark + lưu trữ có kiểm soát quyền, so sánh chênh lệch số liệu, xác nhận trả chìa khoá.

**Phase 5 — Mượn thiết bị.** Danh mục thiết bị, form mượn nhiều thiết bị, tính số lượng khả dụng theo khung giờ giao nhau, dùng lại luồng duyệt + bàn giao của Phase 3–4.

**Phase 6 — Quản trị & báo cáo.** CRUD nội quy có phiên bản, cấu hình tham số đặt phòng, báo cáo + xuất file, job `no_show`, job dọn ảnh cũ.

**Phase 7 — Hoàn thiện.** Kiểm tra khả năng tiếp cận, trạng thái rỗng/lỗi/đang tải, tài liệu hướng dẫn cho giáo viên và cho admin (tiếng Việt), ghi chú triển khai (HTTPS, dung lượng lưu ảnh, cron job).

---

## PHẦN 5 — TIÊU CHÍ NGHIỆM THU

- [ ] Tài khoản học sinh không thấy tab "Phòng chức năng"; gọi thẳng API cũng bị chặn 403.
- [ ] Hai người đặt cùng slot cùng lúc → đúng 1 đơn thành công, người còn lại nhận thông báo lỗi rõ ràng.
- [ ] Booking 9:00–10:00 và 10:00–11:00 cùng phòng đều đặt được.
- [ ] Không check-in được nếu chưa tick xác nhận đã đọc nội quy.
- [ ] Không check-out được nếu chưa check-in.
- [ ] Ảnh minh chứng có watermark thời gian server; mở URL ảnh bằng tài khoản khác → bị từ chối.
- [ ] Số máy trả < số máy mượn → hệ thống cảnh báo và đánh dấu đơn để admin xem lại.
- [ ] Thiết bị có 10 máy: đã duyệt 8 máy trong 9:00–11:00 → người khác đặt 3 máy lúc 10:00–12:00 bị chặn, đặt 2 máy thì được.
- [ ] Admin sửa nội quy → các đơn cũ vẫn giữ đúng phiên bản nội quy đã được chấp nhận.
- [ ] Lịch dùng được trên điện thoại; check-in bằng camera điện thoại chạy tốt.
- [ ] Toàn bộ giao diện tiếng Việt, giờ hiển thị đúng múi giờ Việt Nam.

---

## PHẦN 6 — NHỮNG ĐIỂM CẦN HỎI TÔI

Trước khi bắt đầu Phase 1, hãy hỏi tôi về những điểm sau (và bất kỳ điểm nào khác bạn thấy mơ hồ):

1. Bảng `users` đã có "mã nhân viên" và "tổ chuyên môn" chưa? Nếu chưa thì thêm vào đâu?
2. Có cần nhiều cấp duyệt (VD tổ trưởng duyệt trước rồi admin duyệt sau) không, hay chỉ một cấp admin?
3. Giáo viên có được sửa đơn sau khi đã duyệt không, hay phải huỷ và đặt lại?
4. Có ràng buộc theo thời khoá biểu dạy học không (VD chỉ đặt được vào tiết mình được phân công)?
5. Kênh thông báo mong muốn: chỉ trong hệ thống, hay có cả email/Zalo/push?
6. Có cần đồng bộ hai chiều với Microsoft 365 Calendar không? (Nếu có, đây nên là một dự án riêng sau này.)
