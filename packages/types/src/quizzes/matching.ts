/**
 * Một cặp của câu Ghép nối được tính đúng khi CHỮ vế phải học sinh chọn trùng
 * chữ vế phải đúng (bỏ khoảng trắng hai đầu) — không so theo id của thẻ.
 *
 * Giáo viên hay cho nhiều vế trái cùng một đáp án ("TCP" cho 5 chức năng, "IP"
 * cho 3). Cột phải chỉ hiện chữ nên các thẻ trùng chữ không phân biệt được:
 * học sinh kéo thẻ "TCP" nào vào cũng là ghép đúng.
 *
 * Dùng chung cho bộ chấm (API) và trang kết quả / xem trước (web) — hai nơi so
 * khác nhau là điểm báo đúng mà từng dòng lại hiện sai.
 */
export function matchingPairCorrect(
  expectedRight: string | null | undefined,
  chosenRight: string | null | undefined
): boolean {
  const expected = (expectedRight ?? '').trim();
  return expected !== '' && (chosenRight ?? '').trim() === expected;
}
