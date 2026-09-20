/**
 * Khoá localStorage lưu lựa chọn sáng/tối của người dùng.
 *
 * Đổi từ `theme` sang `lb-theme` khi chuyển mặc định sang sáng: bản cũ tự ghi
 * `dark` cho mọi khách (kể cả người chưa từng chọn), nên không thể phân biệt
 * "chọn tối" với "mặc định tối". Khoá mới chỉ được ghi khi người dùng bấm nút
 * chuyển theme, nên mặc định sau này có thể đổi mà không lệch với lựa chọn thật.
 */
export const THEME_STORAGE_KEY = 'lb-theme';
