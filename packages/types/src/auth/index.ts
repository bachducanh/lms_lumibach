/**
 * Quy tắc tên đăng nhập, dùng chung cho form đăng ký (apps/web) và kiểm tra
 * phía máy chủ (apps/api). Để một chỗ vì nếu hai bên lệch nhau thì form cho
 * qua rồi API mới từ chối — người dùng không hiểu vì sao.
 */

/**
 * 3–30 ký tự, bắt đầu bằng chữ cái, chỉ gồm chữ thường, số, dấu chấm và gạch
 * dưới.
 *
 * Không cho phép chữ hoa: tên đăng nhập được chuẩn hoá về chữ thường trước khi
 * lưu, nếu nhận cả chữ hoa thì "AnhBach" và "anhbach" trông như hai tài khoản
 * khác nhau trong khi thực tế trùng nhau.
 *
 * Không cho phép dấu tiếng Việt: gõ tên đăng nhập có dấu rất dễ sai khi đăng
 * nhập ở máy khác bộ gõ.
 */
export const USERNAME_REGEX = /^[a-z][a-z0-9._]{2,29}$/;

export const USERNAME_RULE_MESSAGE =
  'Tên đăng nhập 3–30 ký tự, bắt đầu bằng chữ cái, chỉ gồm chữ thường, số, dấu chấm và gạch dưới';

/** Chuẩn hoá trước khi lưu và trước khi tra cứu lúc đăng nhập. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Người dùng gõ gì vào ô đăng nhập — email hay tên đăng nhập.
 *
 * Nhận diện bằng dấu `@`: tên đăng nhập không cho phép ký tự này nên không thể
 * nhầm lẫn hai đằng.
 */
export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes('@');
}
