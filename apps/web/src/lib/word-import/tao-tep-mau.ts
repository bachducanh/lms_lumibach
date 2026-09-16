import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

/**
 * Sinh tệp Word mẫu cho việc nhập đề.
 *
 * Sinh bằng mã chứ không để sẵn một tệp nhị phân trong kho: quy ước của mẫu nằm
 * ngay cạnh bộ đọc, nên sửa quy ước là tệp mẫu đổi theo, không bao giờ lệch.
 */

const FONT_MA = 'Consolas';

function chu(text: string, dam = false): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, bold: dam })], spacing: { after: 80 } });
}

function tieuDe(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
  });
}

/** Dòng thuộc phần ví dụ: font đều để giáo viên thấy rõ đâu là nhãn. */
function viDu(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, font: FONT_MA, size: 20 })],
    spacing: { after: 40 },
  });
}

function o(text: string, dam = false): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: dam, size: 20 })] })],
  });
}

function bang(rows: string[][], coTieuDe = true): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (hang, i) => new TableRow({ children: hang.map((c) => o(c, coTieuDe && i === 0)) })
    ),
  });
}

const MA_LOAI: string[][] = [
  ['Mã', 'Loại câu hỏi', 'Phần bắt buộc'],
  ['TN1', 'Trắc nghiệm một đáp án', 'Các mục A., B.… và dòng Đáp án'],
  ['TNN', 'Trắc nghiệm nhiều đáp án', 'Các mục và dòng Đáp án (nhiều chữ cái)'],
  ['DS', 'Đúng / Sai', 'Dòng Đáp án ghi Đ hoặc S'],
  ['DSN', 'Đúng / Sai nhiều ý', 'Các mục và dãy Đ, S theo thứ tự'],
  ['TL', 'Tự luận', 'Chỉ cần đề bài'],
  ['TLN', 'Trả lời ngắn', 'Dòng Đáp án, các cách viết ngăn bởi |'],
  ['SX', 'Sắp xếp thứ tự', 'Các mục viết theo đúng thứ tự đúng'],
  ['GN', 'Ghép nối', 'Mỗi mục viết: vế trái | vế phải'],
  ['PARSONS', 'Sắp xếp dòng lệnh', 'Khối Code mẫu'],
  ['DK', 'Điền vào chỗ trống', 'Khối Code mẫu có ___ và dòng Đáp án'],
  ['PY', 'Lập trình Python', 'Khối Test'],
  ['CPP', 'Lập trình C++', 'Khối Test'],
  ['FIX_PY', 'Sửa lỗi Python', 'Khối Code mẫu và khối Test'],
  ['FIX_CPP', 'Sửa lỗi C++', 'Khối Code mẫu và khối Test'],
  ['WEB', 'Lập trình web', 'Khối Code mẫu'],
];

export async function taoTepMau(): Promise<Buffer> {
  const noiDung: (Paragraph | Table)[] = [
    new Paragraph({
      text: 'Mẫu nhập đề vào ngân hàng câu hỏi',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    chu('Xoá toàn bộ phần hướng dẫn phía dưới rồi gõ đề của bạn vào. Chỉ giữ lại các câu hỏi.'),

    tieuDe('Trước khi gõ đề lập trình: tắt sửa tự động của Word'),
    chu(
      'Word tự đổi dấu nháy thẳng thành nháy cong, hai dấu gạch nối thành gạch dài, và viết hoa chữ đầu dòng. Nhìn trên giấy không thấy gì lạ nhưng code sẽ chạy sai.'
    ),
    chu('Đường đi: File → Options → Proofing → AutoCorrect Options.'),
    chu(
      'Ở cả thẻ AutoCorrect và AutoFormat As You Type, bỏ chọn phần thay thế khi gõ và phần viết hoa đầu câu.'
    ),
    chu(
      'Đề chỉ có chữ và công thức thì không cần bước này. Công thức cứ gõ bằng Equation như thường lệ, hệ thống đọc được.'
    ),

    tieuDe('Ba quy tắc, không có ngoại lệ'),
    chu('1. Mỗi câu mở đầu bằng "Câu 1.", "Câu 2."… và mã loại đặt trong ngoặc vuông.'),
    chu('2. Các phương án viết thành dòng bắt đầu bằng A. B. C. D. cho tới H.'),
    chu(
      '3. Các dòng nhãn kết thúc bằng dấu hai chấm: Thư mục, Đề, Đáp án, Giải thích, Điểm, Code mẫu, Đáp án code, Test, Thời gian, Bộ nhớ.'
    ),
    chu(
      'Mọi đoạn không thuộc ba dạng trên sẽ được nối vào phần ngay trước nó. Nhờ vậy công thức đứng riêng một dòng hay đề bài dài mấy đoạn đều không cần làm gì thêm.'
    ),
    chu(
      'Bỏ trống mã loại thì hiểu là trắc nghiệm một đáp án. Bỏ trống dòng Điểm thì mỗi câu được 1 điểm.'
    ),

    tieuDe('Bảng mã loại'),
    bang(MA_LOAI),

    tieuDe('Khối Test cho câu lập trình'),
    chu(
      'Dạng viết gọn một dòng, ví dụ "Test: 5 => 25", chỉ dùng được khi dữ liệu vào nằm gọn trên một dòng. Thêm [ẩn] để giấu test khỏi học sinh và [2đ] để đổi điểm của test đó.'
    ),
    chu(
      'Dữ liệu vào nhiều dòng thì đặt một bảng ngay dưới nhãn Test, các cột là Đầu vào, Kết quả, Ẩn, Điểm.'
    ),
    chu(
      'Cột Kết quả được phép bỏ trống nếu bạn đã điền khối Đáp án code. Khi đó hãy dùng nút chạy đáp án trong ứng dụng để sinh kết quả mong đợi hàng loạt.'
    ),

    tieuDe('Những chỗ dễ sai'),
    chu(
      'Đừng đánh dấu đáp án đúng bằng dấu sao ở đầu dòng. Word sẽ biến nó thành danh sách gạch đầu dòng và ký hiệu biến mất. Hãy dùng dòng Đáp án.'
    ),
    chu(
      'Phương án xếp trong bảng hai cột vẫn đọc được, theo thứ tự trái sang phải rồi trên xuống dưới.'
    ),
    chu('Phương án đánh số tự động của Word cũng đọc được; hệ thống tự gán A, B, C theo thứ tự.'),
    chu(
      'Một dòng ghi chú đặt sau phương án cuối sẽ bị hiểu là phần nối tiếp của phương án đó. Nếu nó là phần chung của đề, hãy bọc đề bài bằng nhãn Đề.'
    ),
    chu('Ảnh cứ dán thẳng vào ngay dưới dòng đề, hệ thống tự tải lên và gắn vào câu hỏi.'),

    tieuDe('Ví dụ — xoá hết phần này trước khi nộp tệp'),
    chu(
      'Dòng Thư mục đứng riêng, áp cho mọi câu phía sau cho tới lần khai kế tiếp. Thư mục chưa có sẽ được tạo mới.'
    ),
    viDu('Thư mục: Chương 1 - Hàm số'),
    viDu(''),
    viDu('Câu 1. [TN1] Tập xác định của hàm số y = căn(x - 1) / (x - 3) là'),
    viDu('A. [1; +vô cùng)'),
    viDu('B. [1; +vô cùng) bỏ đi điểm 3'),
    viDu('C. (1; +vô cùng)'),
    viDu('D. R bỏ đi điểm 3'),
    viDu('Đáp án: B'),
    viDu('Giải thích: Biểu thức dưới căn không âm và mẫu khác không.'),
    viDu('Điểm: 0,25'),
    viDu(''),
    viDu('Câu 2. [TNN] Trong các hàm số sau, những hàm nào đồng biến trên R?'),
    viDu('A. y = x^3 + x'),
    viDu('B. y = x^3 - 3x'),
    viDu('C. y = 2x + 5'),
    viDu('Đáp án: A, C'),
    viDu(''),
    viDu('Câu 3. [DSN] Xét các phát biểu về tìm kiếm nhị phân:'),
    viDu('A. Dãy đầu vào phải được sắp xếp trước.'),
    viDu('B. Thuật toán chạy đúng trên dãy chưa sắp xếp.'),
    viDu('C. Số phép so sánh tối đa là log cơ số 2 của n, làm tròn lên.'),
    viDu('D. Luôn nhanh hơn tìm kiếm tuần tự với mọi kích thước dãy.'),
    viDu('Đáp án: Đ, S, Đ, S'),
    viDu(''),
    viDu('Câu 4. [DS] Số 2 là số nguyên tố.'),
    viDu('Đáp án: Đ'),
    viDu(''),
    viDu('Câu 5. [TLN] Tính giá trị của một phần hai dưới dạng số thập phân.'),
    viDu('Đáp án: 0,5 | 1/2'),
    viDu(''),
    viDu('Câu 6. [GN] Ghép hàm số với đạo hàm tương ứng.'),
    viDu('A. sin x | cos x'),
    viDu('B. ln x | 1/x'),
    viDu('C. e^(2x) | 2e^(2x)'),
    viDu(''),
    viDu('Câu 7. [SX] Sắp xếp các bước tìm giá trị lớn nhất của một dãy số.'),
    viDu('A. Gán phần tử đầu tiên làm giá trị lớn nhất tạm thời.'),
    viDu('B. Duyệt lần lượt các phần tử còn lại.'),
    viDu('C. Nếu phần tử đang xét lớn hơn thì cập nhật lại.'),
    viDu('D. Trả về giá trị tạm thời sau khi duyệt hết dãy.'),
    viDu(''),
    viDu('Câu 8. [TL] Cho hàm số y = x^3 - 3x^2 + m. Tìm m để đồ thị có hai điểm'),
    viDu('cực trị nằm về hai phía trục hoành.'),
    viDu('Điểm: 2'),
    viDu(''),
    viDu('Câu 9. [PARSONS] Sắp xếp các dòng lệnh để in tổng các số chẵn từ 1 đến n.'),
    viDu('Code mẫu:'),
    viDu('n = int(input())'),
    viDu('s = 0'),
    viDu('for i in range(1, n + 1):'),
    viDu('    if i % 2 == 0:'),
    viDu('        s = s + i'),
    viDu('print(s)'),
    viDu(''),
    viDu('Câu 10. [DK] Điền vào chỗ trống để hàm đếm số lần xuất hiện của ký tự.'),
    viDu('Code mẫu:'),
    viDu('def dem(s, c):'),
    viDu('    d = ___'),
    viDu('    for ch in s:'),
    viDu('        if ch == c:'),
    viDu('            d = ___'),
    viDu('    return d'),
    viDu('Đáp án: 0 | d + 1'),
    viDu(''),
    viDu('Câu 11. [PY] Đọc số nguyên dương n rồi in n số Fibonacci đầu tiên,'),
    viDu('các số cách nhau một dấu cách trên cùng một dòng.'),
    viDu('Code mẫu:'),
    viDu('n = int(input())'),
    viDu('# viết code của em ở đây'),
    viDu('Đáp án code:'),
    viDu('n = int(input())'),
    viDu('a, b = 0, 1'),
    viDu('kq = []'),
    viDu('for i in range(n):'),
    viDu('    kq.append(str(a))'),
    viDu('    a, b = b, a + b'),
    viDu("print(' '.join(kq))"),
    viDu('Test: 1 => 0'),
    viDu('Test: 5 => 0 1 1 2 3'),
    viDu('Test: 8 => 0 1 1 2 3 5 8 13 [ẩn] [2đ]'),
    viDu('Thời gian: 2'),
    viDu('Điểm: 3'),
    viDu(''),
    viDu('Câu 12. [CPP] In ra giá trị lớn nhất của dãy số.'),
    viDu('Đáp án code:'),
    viDu('#include <iostream>'),
    viDu('using namespace std;'),
    viDu('int main() {'),
    viDu('    int n; cin >> n;'),
    viDu('    int mx; cin >> mx;'),
    viDu('    for (int i = 1; i < n; i++) { int x; cin >> x; if (x > mx) mx = x; }'),
    viDu('    cout << mx;'),
    viDu('}'),
    viDu('Test:'),
    bang(
      [
        ['Đầu vào', 'Kết quả', 'Ẩn', 'Điểm'],
        ['3\n1 5 3', '5', '', '1'],
        ['4\n-9 -2 -7 -4', '-2', 'x', '2'],
      ],
      true
    ),
  ];

  const doc = new Document({ sections: [{ children: noiDung }] });
  return Packer.toBuffer(doc);
}
