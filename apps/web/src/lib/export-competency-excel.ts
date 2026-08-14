// Xuất Excel chấm điểm năng lực theo ĐÚNG bố cục file mẫu H.A.S
// "26-27 MIT S3 — Chấm điểm năng lực học sinh": 1 sheet "Tổng hợp kết quả"
// + 1 sheet cho mỗi học sinh.
//
// Dùng ExcelJS chứ không phải `xlsx` (SheetJS) như bản trước: bản cộng đồng của
// SheetJS không tô màu / kẻ viền được (đó là tính năng bản trả phí), mà file mẫu
// thì định dạng khá nặng — không có màu thì nhìn không ra file mẫu nữa.
//
// ── Vì sao sheet học sinh chia hai khối ──────────────────────────────────────
// Giống hệt file mẫu:
//   • Khối TRÁI (B–I): danh sách minh chứng, gom theo hoạt động. Ở file mẫu đây
//     là vùng giáo viên tick tay; ở đây LMS đã chấm rồi nên cột I điền sẵn mức
//     đã ghi nhận.
//   • Khối PHẢI (K–AB): vùng tính, công thức SỐNG. `COUNTIFS` quét cột B và I
//     của khối trái để đếm số lần đạt từng mức, đúng như file mẫu.
// Nhờ hai khối ăn khớp qua mã chỉ báo, mở file ra sửa một ô mức độ ở cột I là
// điểm năng lực ở AA tự tính lại — không phải xuất lại từ LMS.
import {
  COMPETENCY_LEVEL_LABEL,
  LEARNING_PACE_LABEL,
  type CompetencyExportData,
  type CompetencyExportStudent,
  type CompetencyLevelValue,
} from '@lumibach/types';
import type { Borders, Fill, Workbook, Worksheet } from 'exceljs';

// ── Bảng màu & phông lấy nguyên từ file mẫu ─────────────────────────────────
const FONT_TEXT = 'EB Garamond';
const FONT_NUM = 'Source Serif 4';
/** Mẫu để riêng phông cho phần mô tả rubric ở khối trái. */
const FONT_RUBRIC = 'Times New Roman';

const CAM = 'FFFF6D01';
const XANH_CHU = 'FF0B5394';
const XANH_DAM = 'FF1C4587';
const XANH_NGOC = 'FF009DA4';
const VANG = 'FFFFFF00';
const XANH_NHAT = 'FFCFE2F3';
const XANH_NHAC = 'FF3D85C6';
const XANH_THAM = 'FF073763';
const XANH_SO = 'FF252C65';
const TRANG = 'FFFFFFFF';

/** Năm mức thành thạo, đúng thứ tự cột D→H của file mẫu. */
const CAC_MUC: CompetencyLevelValue[] = [
  'NO_EVIDENCE',
  'BEGINNING',
  'APPROACHING',
  'PROFICIENT',
  'ADVANCED',
];

/** Khoá rubric trong dữ liệu ứng với từng mức. */
const KHOA_RUBRIC = {
  NO_EVIDENCE: 'noEvidence',
  BEGINNING: 'beginning',
  APPROACHING: 'approaching',
  PROFICIENT: 'proficient',
  ADVANCED: 'advanced',
} as const;

function to(color: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
}

function vien(): Partial<Borders> {
  const nét = { style: 'thin' as const, color: { argb: 'FF000000' } };
  return { top: nét, left: nét, bottom: nét, right: nét };
}

/**
 * Tên sheet hợp lệ: Excel cấm : \ / ? * [ ] và giới hạn 31 ký tự.
 *
 * Tên sheet còn được nhét vào công thức của sheet tổng hợp, nên hàm này là chỗ
 * duy nhất sinh tên — gọi lại với cùng đầu vào phải ra cùng kết quả.
 */
function tenSheetAnToan(value: string): string {
  return (
    (value || 'Sheet1')
      .replace(/[\\/?*[\]:]/g, ' ')
      .trim()
      .slice(0, 31) || 'Sheet1'
  );
}

/** Bọc nháy đơn cho tên sheet dùng trong công thức; nháy đơn trong tên nhân đôi. */
function thamChieuSheet(ten: string): string {
  return `'${ten.replace(/'/g, "''")}'`;
}

/**
 * Mã chỉ báo dùng làm khoá nối hai khối trái–phải.
 *
 * `COUNTIFS($B:$B, $N5, ...)` chỉ đúng khi mã ở cột B của khối trái TRÙNG KHÍT
 * mã ở cột N của khối phải, và mã đó không đụng chỉ báo nào khác trong cùng
 * sheet. Chỉ báo trong LMS có thể chưa đặt mã, hoặc hai thành phần lỡ đặt trùng
 * mã — cả hai trường hợp đều làm COUNTIFS đếm nhầm sang chỉ báo khác, nên sinh
 * mã ở đây một lần rồi dùng chung, thay vì ghép chuỗi bằng công thức như mẫu.
 *
 * Bỏ luôn * ? ~ khỏi mã: COUNTIFS coi đó là ký tự đại diện chứ không phải chữ,
 * nên một mã lỡ chứa `*` sẽ khớp cả sang chỉ báo khác và cộng dồn sai số lần đạt.
 */
function danhMaChiBao(student: CompetencyExportStudent): Map<string, string> {
  const ma = new Map<string, string>();
  const daDung = new Set<string>();
  const sach = (s: string) => s.replace(/[*?~]/g, '').trim();

  student.components.forEach((comp, ci) => {
    const goc = sach(comp.code ?? '') || `NL${ci + 1}`;
    comp.indicators.forEach((ind, ii) => {
      const duoi = sach(ind.code ?? '') || `${ii + 1}`;
      const base = duoi.startsWith(goc) ? duoi : `${goc}.${duoi}`;
      let ungVien = base;
      let n = 2;
      while (daDung.has(ungVien)) ungVien = `${base} (${n++})`;
      daDung.add(ungVien);
      ma.set(ind.indicatorId, ungVien);
    });
  });

  return ma;
}

// ── Sheet 1: Tổng hợp kết quả ───────────────────────────────────────────────

function dungSheetTongHop(
  ws: Worksheet,
  data: CompetencyExportData,
  tenSheetTheoHocSinh: Map<string, string>
): void {
  ws.columns = [
    { width: 8.9 },
    { width: 17.4 },
    { width: 28.9 },
    { width: 19.1 },
    { width: 17.1 },
    { width: 19.1 },
    { width: 16.9 },
    { width: 17.6 },
    { width: 17.4 },
    { width: 38.1 },
    { width: 45.1 },
    { width: 45.1 },
    { width: 45.1 },
    { width: 45.1 },
    { width: 23.4 },
  ];

  ws.getRow(1).height = 73.5;
  ws.getRow(2).height = 33;
  ws.getRow(3).height = 45;
  ws.getRow(4).height = 45;

  // Dải nhận diện bên trái, để trống đúng như mẫu (chỗ dán logo trường).
  ws.mergeCells('A1:C2');

  ws.mergeCells('D1:O1');
  const tieuDe = ws.getCell('D1');
  tieuDe.value =
    'TỔNG HỢP KẾT QUẢ NĂNG LỰC HỌC SINH/SUMMARY OF STUDENT COMPETENCY RESULTS\n' +
    `KỲ ĐÁNH GIÁ/Assessment period: ${data.period.name}`;
  tieuDe.font = { name: FONT_TEXT, size: 22, bold: true, color: { argb: CAM } };
  tieuDe.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  ws.mergeCells('D2:G2');
  ws.mergeCells('H2:I2');
  ws.getCell('H2').value = 'Lớp/Khối [Class/Grade]';
  ws.getCell('K2').value = 'Năng lực/[Competency]';
  for (const coord of ['H2', 'K2']) {
    ws.getCell(coord).font = { name: FONT_TEXT, size: 16, bold: true, color: { argb: XANH_CHU } };
    ws.getCell(coord).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  }

  // J2 bỏ trống cho giáo viên điền lớp — tô vàng để thấy ngay là ô cần nhập.
  const oLop = ws.getCell('J2');
  oLop.fill = to(VANG);
  oLop.border = vien();
  oLop.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  const oNangLuc = ws.getCell('L2');
  oNangLuc.value = data.category.name;
  oNangLuc.font = { name: FONT_TEXT, size: 18, bold: true, color: { argb: CAM } };
  oNangLuc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.mergeCells('M2:O2');

  // Header hai tầng: A–J và O gộp dọc hàng 3–4, K–N là nhóm "Phản hồi".
  const cotDon: [string, string][] = [
    ['A', 'STT/\nSerial No'],
    ['B', 'Mã học sinh/\nStudent Code'],
    ['C', 'Họ và tên/\nFull Name'],
    ['D', 'Cấp độ năng lực hiện tại/Present performance level'],
    ['E', 'Cấp độ năng lực đã định/Target performance level'],
    ['F', 'Tỷ lệ % chỉ báo đã hoàn thành tại cấp độ năng lực đã định/Progress'],
    ['G', 'Điểm năng lực/Performance level'],
    ['H', 'Mức độ tăng trưởng/Growth'],
    ['I', 'Tiến độ học-tập/On track'],
    ['J', 'Diễn giải/Explanation'],
    ['O', 'Ghi chú/Note'],
  ];
  for (const [cot, nhan] of cotDon) {
    ws.mergeCells(`${cot}3:${cot}4`);
    const o = ws.getCell(`${cot}3`);
    o.value = nhan;
    o.font = { name: FONT_TEXT, size: 14, bold: true, color: { argb: TRANG } };
    o.fill = to(XANH_DAM);
    o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    o.border = vien();
  }

  ws.mergeCells('K3:N3');
  const nhomPhanHoi = ws.getCell('K3');
  nhomPhanHoi.value = 'Phản hồi/Feedback summary';
  nhomPhanHoi.font = { name: FONT_TEXT, size: 14, bold: true, color: { argb: TRANG } };
  nhomPhanHoi.fill = to(XANH_DAM);
  nhomPhanHoi.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  nhomPhanHoi.border = vien();

  const conPhanHoi: [string, string][] = [
    ['K4', 'Đánh giá tổng thể/Overall evaluation'],
    ['L4', 'Điểm mạnh/Strengths'],
    ['M4', 'Điểm cần cải thiện/Areas for improvement'],
    ['N4', 'Hướng phát triển/Next steps for growth'],
  ];
  for (const [coord, nhan] of conPhanHoi) {
    const o = ws.getCell(coord);
    o.value = nhan;
    o.font = { name: FONT_TEXT, size: 14, bold: true, color: { argb: TRANG } };
    o.fill = to(XANH_NGOC);
    o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    o.border = vien();
  }

  // Các cột số kéo thẳng từ sheet học sinh. File mẫu dùng INDIRECT trỏ theo tên
  // ở cột C, nhưng tên sheet của ta đã bị cắt/thay ký tự cấm nên có thể lệch
  // với họ tên — tham chiếu thẳng tên sheet thì luôn đúng.
  //
  // Bọc IF(...="","") vì tham chiếu thẳng tới ô TRỐNG trong Excel ra số 0, mà
  // 0 ở cột cấp độ/điểm đọc thành "học sinh này 0 điểm" chứ không phải "chưa có
  // dữ liệu" — học sinh chưa được chấm chỉ báo nào sẽ rơi đúng vào cảnh đó.
  const keo = (sheet: string, o: string) => ({ formula: `IF(${sheet}!${o}="","",${sheet}!${o})` });

  data.students.forEach((student, i) => {
    const r = 5 + i;
    const sheet = thamChieuSheet(tenSheetTheoHocSinh.get(student.studentId) ?? '');

    ws.getCell(`A${r}`).value = i + 1;
    ws.getCell(`B${r}`).value = student.studentCode;
    ws.getCell(`C${r}`).value = student.fullName;
    ws.getCell(`D${r}`).value = keo(sheet, 'O3');
    ws.getCell(`E${r}`).value = keo(sheet, 'P3');
    ws.getCell(`F${r}`).value = keo(sheet, 'Z3');
    ws.getCell(`G${r}`).value = keo(sheet, 'AA3');
    ws.getCell(`H${r}`).value = keo(sheet, 'AB3');
    ws.getCell(`I${r}`).value = student.learningPace
      ? LEARNING_PACE_LABEL[student.learningPace]
      : '';

    for (let c = 1; c <= 15; c++) {
      const o = ws.getRow(r).getCell(c);
      o.border = vien();
      o.font = { name: FONT_TEXT, size: 13, color: { argb: XANH_CHU } };
      o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
    ws.getCell(`C${r}`).alignment = { vertical: 'middle', wrapText: true };
    ws.getCell(`C${r}`).font = { name: FONT_TEXT, size: 14, color: { argb: XANH_CHU } };

    // Ba ô mẫu tô vàng: cấp độ hiện tại, tỉ lệ %, điểm năng lực.
    ws.getCell(`D${r}`).fill = to(VANG);
    ws.getCell(`F${r}`).fill = to(VANG);
    ws.getCell(`G${r}`).fill = to(VANG);

    ws.getCell(`D${r}`).numFmt = '0.0';
    ws.getCell(`E${r}`).numFmt = '0.0';
    ws.getCell(`F${r}`).numFmt = '0.0%';
    ws.getCell(`G${r}`).numFmt = '0.00';
    ws.getCell(`H${r}`).numFmt = '0.00';
  });

  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 4 }];
}

// ── Sheet mỗi học sinh ──────────────────────────────────────────────────────

function dungSheetHocSinh(
  ws: Worksheet,
  data: CompetencyExportData,
  student: CompetencyExportStudent
): void {
  const maChiBao = danhMaChiBao(student);

  ws.columns = [
    { width: 4.9 },
    { width: 18.5 },
    { width: 21.5 },
    { width: 24.1 },
    { width: 24.1 },
    { width: 24.1 },
    { width: 24.1 },
    { width: 24.1 },
    { width: 38.6 },
    { width: 4.9 },
    { width: 16 },
    { width: 16 },
    { width: 59 },
    { width: 18.3 },
    { width: 18.3 },
    { width: 18.3 },
    { width: 20.1 },
    { width: 15.1 },
    { width: 15.1 },
    { width: 15.1 },
    { width: 15.1 },
    { width: 15.1 },
    { width: 20.1 },
    { width: 20.1 },
    { width: 20.1 },
    { width: 20.1 },
    { width: 14.4 },
    { width: 14.4 },
  ];

  // ── Khối phải: tiêu đề cột vùng tính ──────────────────────────────────────
  ws.getCell('K1').value = 'Mã học sinh:';
  ws.getCell('K1').font = { name: FONT_TEXT, size: 21, bold: true, color: { argb: XANH_THAM } };
  ws.getCell('L1').value = student.studentCode;
  ws.getCell('L1').font = { name: FONT_TEXT, size: 21, bold: true, color: { argb: XANH_THAM } };
  ws.getCell('M1').value = student.fullName;
  ws.getCell('M1').font = { name: FONT_TEXT, size: 21, bold: true, color: { argb: XANH_THAM } };

  // Tiêu đề gộp dọc hàng 1–2 như mẫu; riêng R gộp cả 5 cột mức (R1:V2) vì năm
  // cột đó là một nhóm "số lần đạt mức", tên mức nằm ở hàng tiêu đề thành phần.
  const tieuDeCot: [string, string, string][] = [
    ['N', 'N', 'Mã chỉ báo'],
    ['O', 'O', 'Cấp độ năng lực hiện tại'],
    ['P', 'P', 'Cấp độ năng lực đã định'],
    ['Q', 'Q', 'Số chỉ báo cần hoàn thành tại cấp độ năng lực đã định'],
    ['R', 'V', 'Số lần thành thạo\n(Kiểm tra công thức khi cần, không điền tay)'],
    ['W', 'W', 'Kết luận về mức độ hoàn thành chỉ báo'],
    ['X', 'X', 'Số chỉ báo đã hoàn thành ở từng thành tố năng lực'],
    ['Y', 'Y', 'Số chỉ báo đã hoàn thành ở từng năng lực thành phần'],
    ['Z', 'Z', 'Tỉ lệ % chỉ báo đã hoàn thành tại cấp độ năng lực đã định'],
    ['AA', 'AA', 'Điểm năng lực'],
    ['AB', 'AB', 'Mức độ tăng trưởng'],
  ];
  for (const [dau, cuoi, nhan] of tieuDeCot) {
    ws.mergeCells(`${dau}1:${cuoi}2`);
    const o = ws.getCell(`${dau}1`);
    o.value = nhan;
    o.font = { name: FONT_TEXT, size: 11, bold: true, color: { argb: XANH_THAM } };
    o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  }
  ws.getRow(1).height = 39.75;
  ws.getRow(2).height = 35.25;
  ws.getRow(3).height = 62.25;

  ws.mergeCells('K2:M2');
  ws.getCell('K2').value = `NĂNG LỰC ${data.category.name.toUpperCase()}`;
  ws.getCell('K2').font = { name: FONT_TEXT, size: 21, bold: true, color: { argb: 'FF1155CC' } };
  ws.getCell('K2').alignment = { vertical: 'middle' };

  // ── Khối phải: từng năng lực thành phần ───────────────────────────────────
  // Đi trước khối trái vì hàng 3 (tổng hợp cả năng lực) cần biết vị trí các
  // hàng tiêu đề thành phần để gộp lại.
  let r = 4;
  const hangTieuDeTP: number[] = [];
  const hangChiBaoDau: number[] = [];

  for (const comp of student.components) {
    const hTP = r;
    hangTieuDeTP.push(hTP);

    ws.getCell(`K${hTP}`).value = comp.code ?? '';
    ws.mergeCells(`L${hTP}:M${hTP}`);
    ws.getCell(`L${hTP}`).value = comp.name;
    for (const cot of ['K', 'L']) {
      ws.getCell(`${cot}${hTP}`).font = {
        name: FONT_TEXT,
        size: 13,
        bold: true,
        color: { argb: XANH_THAM },
      };
      ws.getCell(`${cot}${hTP}`).alignment = { vertical: 'middle', wrapText: true };
    }

    // Tên năm mức nằm ở hàng tiêu đề thành phần (R:V), vì R1:V2 đã gộp làm một.
    CAC_MUC.forEach((muc, k) => {
      const cot = String.fromCharCode('R'.charCodeAt(0) + k);
      const o = ws.getCell(`${cot}${hTP}`);
      o.value = COMPETENCY_LEVEL_LABEL[muc];
      o.font = { name: FONT_TEXT, size: 11, bold: true, color: { argb: XANH_THAM } };
      o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    if (comp.startLevel !== null) {
      ws.getCell(`O${hTP}`).value = comp.startLevel;
      ws.getCell(`O${hTP}`).numFmt = '0.0';
    }
    if (comp.targetLevel !== null) {
      ws.getCell(`P${hTP}`).value = comp.targetLevel;
      ws.getCell(`P${hTP}`).numFmt = '0.0';
    }

    const dau = hTP + 1;
    const cuoi = hTP + comp.indicators.length;
    if (comp.indicators.length > 0) {
      hangChiBaoDau.push(dau);
      ws.getCell(`Q${hTP}`).value = { formula: `SUM(Q${dau}:Q${cuoi})` };
    } else {
      ws.getCell(`Q${hTP}`).value = 0;
    }

    comp.indicators.forEach((ind, i) => {
      const hr = dau + i;
      const ma = maChiBao.get(ind.indicatorId) ?? '';

      ws.getCell(`L${hr}`).value = ind.code ?? '';
      ws.getCell(`M${hr}`).value = ind.name;
      ws.getCell(`N${hr}`).value = ma;
      // Mỗi chỉ báo tính 1 đơn vị cần hoàn thành — mẫu để giáo viên điền tay,
      // ở đây LMS biết chính xác nên điền sẵn.
      ws.getCell(`Q${hr}`).value = 1;

      CAC_MUC.forEach((muc, k) => {
        const cot = String.fromCharCode('R'.charCodeAt(0) + k);
        ws.getCell(`${cot}${hr}`).value = {
          formula: `COUNTIFS($B:$B,$N${hr},$I:$I,"${COMPETENCY_LEVEL_LABEL[muc]}")`,
        };
      });

      // Hoàn thành = đạt "Thành thạo" trở lên từ 2 lần — Chính sách H.A.S.
      ws.getCell(`W${hr}`).value = {
        formula: `IF(U${hr}+V${hr}>=2,"Hoàn thành","Chưa hoàn thành")`,
      };
      ws.getCell(`X${hr}`).value = { formula: `COUNTIF(W${hr},"Hoàn thành")` };

      for (const cot of ['L', 'M', 'N']) {
        ws.getCell(`${cot}${hr}`).font = { name: FONT_TEXT, size: 13, color: { argb: XANH_THAM } };
        ws.getCell(`${cot}${hr}`).alignment = { vertical: 'middle', wrapText: true };
      }
      for (const cot of ['Q', 'R', 'S', 'T', 'U', 'V', 'X']) {
        ws.getCell(`${cot}${hr}`).font = { name: FONT_NUM, size: 12, color: { argb: XANH_SO } };
        ws.getCell(`${cot}${hr}`).alignment = { horizontal: 'center', vertical: 'middle' };
      }
      ws.getCell(`W${hr}`).font = { name: FONT_NUM, size: 12, color: { argb: XANH_SO } };
      ws.getCell(`W${hr}`).alignment = { horizontal: 'center', vertical: 'middle' };
    });

    // Chỉ số tổng của thành phần đặt ở hàng chỉ báo ĐẦU TIÊN, đúng như mẫu.
    if (comp.indicators.length > 0) {
      // Gộp dọc suốt khối chỉ báo: mã thành phần ở cột K, bốn cột tổng Y–AB.
      // Không gộp thì con số chỉ dính ở hàng đầu, nhìn cứ như của riêng chỉ báo
      // đầu tiên chứ không phải của cả thành phần.
      ws.mergeCells(`K${hTP}:K${cuoi}`);
      if (cuoi > dau) {
        for (const cot of ['Y', 'Z', 'AA', 'AB']) {
          ws.mergeCells(`${cot}${dau}:${cot}${cuoi}`);
        }
      }

      const oY = ws.getCell(`Y${dau}`);
      oY.value = { formula: `SUM(X${dau}:X${cuoi})` };
      oY.font = { name: FONT_NUM, size: 12, color: { argb: XANH_SO } };
      oY.alignment = { horizontal: 'center', vertical: 'middle' };

      const oZ = ws.getCell(`Z${dau}`);
      // Chặn chia cho 0: thành phần chưa có chỉ báo nào thì để trống thay vì #DIV/0!.
      oZ.value = { formula: `IF(Q${hTP}=0,"",Y${dau}/Q${hTP})` };
      oZ.numFmt = '0.0%';
      oZ.font = { name: FONT_NUM, size: 12, color: { argb: XANH_SO } };
      oZ.alignment = { horizontal: 'center', vertical: 'middle' };

      const oAA = ws.getCell(`AA${dau}`);
      // Điểm = cấp độ xuất phát + 2 × tỉ lệ hoàn thành (Chính sách H.A.S).
      // Chưa đặt cấp độ xuất phát thì bỏ trống, đừng lấy 0 làm điểm.
      oAA.value = { formula: `IF(OR(O${hTP}="",Z${dau}=""),"",O${hTP}+(2*Z${dau}))` };
      oAA.numFmt = '0.00';
      oAA.font = { name: FONT_NUM, size: 12, color: { argb: XANH_SO } };
      oAA.alignment = { horizontal: 'center', vertical: 'middle' };

      const oAB = ws.getCell(`AB${dau}`);
      oAB.value = { formula: `IF(AA${dau}="","",AA${dau}-O${hTP})` };
      oAB.numFmt = '0.00';
      oAB.font = { name: FONT_NUM, size: 12, color: { argb: XANH_SO } };
      oAB.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    r = Math.max(cuoi, hTP) + 2;
  }

  // ── Hàng 3: tổng hợp cả năng lực ──────────────────────────────────────────
  const dsO = hangTieuDeTP.map((h) => `O${h}`).join(',');
  const dsP = hangTieuDeTP.map((h) => `P${h}`).join(',');
  const dsQ = hangTieuDeTP.map((h) => `Q${h}`).join(',');
  const dsY = hangChiBaoDau.map((h) => `Y${h}`).join(',');
  const dsAA = hangChiBaoDau.map((h) => `AA${h}`).join(',');

  // IFERROR bọc AVERAGE: chưa đặt cấp độ xuất phát/đích cho thành phần nào thì
  // AVERAGE của toàn ô rỗng ra #DIV/0!, và lỗi đó lan sang cả sheet tổng hợp.
  if (hangTieuDeTP.length > 0) {
    ws.getCell('O3').value = { formula: `IFERROR(AVERAGE(${dsO}),"")` };
    ws.getCell('P3').value = { formula: `IFERROR(AVERAGE(${dsP}),"")` };
    ws.getCell('Q3').value = { formula: `SUM(${dsQ})` };
  }
  if (hangChiBaoDau.length > 0) {
    ws.getCell('Y3').value = { formula: `SUM(${dsY})` };
    ws.getCell('Z3').value = { formula: `IF(Q3=0,"",Y3/Q3)` };
    ws.getCell('AA3').value = { formula: `IFERROR(AVERAGE(${dsAA}),"")` };
    ws.getCell('AB3').value = { formula: `IF(OR(AA3="",O3=""),"",AA3-O3)` };
  }

  ws.getCell('O3').numFmt = '0.0';
  ws.getCell('P3').numFmt = '0.0';
  ws.getCell('O3').font = { name: FONT_NUM, size: 14, bold: true, color: { argb: CAM } };
  ws.getCell('P3').font = { name: FONT_NUM, size: 14, bold: true, color: { argb: CAM } };
  ws.getCell('Q3').font = { name: FONT_NUM, size: 14, bold: true, color: { argb: XANH_SO } };
  ws.getCell('Y3').font = { name: FONT_NUM, size: 14, bold: true, color: { argb: XANH_SO } };

  const oZ3 = ws.getCell('Z3');
  oZ3.numFmt = '0.0%';
  oZ3.font = { name: FONT_NUM, size: 20, bold: true, color: { argb: XANH_SO } };
  oZ3.alignment = { horizontal: 'center', vertical: 'middle' };

  const oAA3 = ws.getCell('AA3');
  oAA3.numFmt = '0.00';
  oAA3.font = { name: FONT_NUM, size: 20, bold: true, color: { argb: TRANG } };
  oAA3.fill = to(CAM);
  oAA3.alignment = { horizontal: 'center', vertical: 'middle' };

  const oAB3 = ws.getCell('AB3');
  oAB3.numFmt = '0.00';
  oAB3.font = { name: FONT_NUM, size: 14, bold: true, color: { argb: XANH_SO } };
  oAB3.alignment = { horizontal: 'center', vertical: 'middle' };

  // ── Khối trái: minh chứng, gom theo hoạt động ─────────────────────────────
  dungKhoiMinhChung(ws, student, maChiBao);

  ws.views = [{ state: 'frozen', ySplit: 2 }];
}

/**
 * Khối trái (B–I): mỗi hoạt động một cụm, trong cụm mỗi lần chấm một CẶP HÀNG.
 *
 * Ở file mẫu cụm này là "ĐƠN VỊ HỌC TẬP: U0/U1/U3" do giáo viên tự chia; trong
 * LMS thứ tương đương gần nhất là hoạt động đã chấm (bài tập, trắc nghiệm…),
 * nên gom theo đó.
 *
 * Cặp hàng đúng như mẫu:
 *   • hàng trên  — D→H là mô tả rubric của năm mức, để người đọc biết "gần thành
 *     thạo" ở chỉ báo này nghĩa là gì; B/C/I gộp dọc cả hai hàng.
 *   • hàng dưới  — D→H là TRUE/FALSE, đúng một ô TRUE ở mức LMS đã chấm.
 * Cột I là CÔNG THỨC đọc hàng TRUE/FALSE ra tên mức, nên đổi ô TRUE ở dưới là
 * cột I đổi theo và điểm năng lực bên khối phải tự tính lại.
 */
function dungKhoiMinhChung(
  ws: Worksheet,
  student: CompetencyExportStudent,
  maChiBao: Map<string, string>
): void {
  type Dong = {
    ma: string;
    tenChiBao: string;
    rubric: Record<string, string | null>;
    muc: CompetencyLevelValue;
    chamLuc: string;
  };
  const theoHoatDong = new Map<string, Dong[]>();

  for (const comp of student.components) {
    for (const ind of comp.indicators) {
      for (const ev of ind.evidences) {
        const list = theoHoatDong.get(ev.activityTitle) ?? [];
        list.push({
          ma: maChiBao.get(ind.indicatorId) ?? '',
          tenChiBao: ind.name,
          rubric: ev.rubric as unknown as Record<string, string | null>,
          muc: ev.level,
          chamLuc: ev.gradedAt,
        });
        theoHoatDong.set(ev.activityTitle, list);
      }
    }
  }

  let r = 3;
  for (const [tenHoatDong, dsDong] of theoHoatDong) {
    const oNhom = ws.getCell(`B${r}`);
    oNhom.value = `HOẠT ĐỘNG: ${tenHoatDong}`;
    oNhom.font = { name: FONT_TEXT, size: 13, color: { argb: TRANG } };
    oNhom.fill = to(XANH_CHU);
    oNhom.alignment = { vertical: 'middle', wrapText: true };
    r += 1;

    // Dải "RUBRIC" vắt ngang B–H, đúng như mẫu: nó tách phần mô tả rubric khỏi
    // dòng tiêu đề bên dưới, nếu bỏ thì hai dải xanh dính liền nhau khó đọc.
    ws.mergeCells(`B${r}:H${r}`);
    const oRubric = ws.getCell(`B${r}`);
    oRubric.value = 'RUBRIC\n(Mô tả từng mức thành thạo của mỗi chỉ báo trong hoạt động này)';
    oRubric.font = { name: FONT_TEXT, size: 13, color: { argb: TRANG } };
    oRubric.fill = to(XANH_NHAC);
    oRubric.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    r += 1;

    const tieuDe = [
      'Mã chỉ báo',
      'Tiêu chí',
      ...CAC_MUC.map((m) => COMPETENCY_LEVEL_LABEL[m]),
      'Ghi nhận\n(Cột này được cài công thức tự động)',
    ];
    tieuDe.forEach((nhan, i) => {
      const o = ws.getRow(r).getCell(2 + i);
      o.value = nhan;
      o.font = { name: FONT_TEXT, size: 13, color: { argb: XANH_THAM } };
      o.fill = to(XANH_NHAT);
      o.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    r += 1;

    // Sắp theo thời điểm chấm để đọc được diễn tiến của học sinh.
    dsDong.sort((a, b) => a.chamLuc.localeCompare(b.chamLuc));

    for (const dong of dsDong) {
      const hMoTa = r;
      const hTick = r + 1;

      for (const cot of ['B', 'C', 'I']) {
        ws.mergeCells(`${cot}${hMoTa}:${cot}${hTick}`);
      }

      ws.getCell(`B${hMoTa}`).value = dong.ma;
      ws.getCell(`B${hMoTa}`).font = { name: FONT_TEXT, size: 13, color: { argb: XANH_THAM } };
      ws.getCell(`B${hMoTa}`).alignment = { vertical: 'middle', wrapText: true };

      ws.getCell(`C${hMoTa}`).value = dong.tenChiBao;
      ws.getCell(`C${hMoTa}`).font = {
        name: FONT_RUBRIC,
        size: 12,
        italic: true,
        color: { argb: XANH_THAM },
      };
      ws.getCell(`C${hMoTa}`).alignment = { vertical: 'middle', wrapText: true };

      CAC_MUC.forEach((muc, i) => {
        const cot = String.fromCharCode('D'.charCodeAt(0) + i);

        const oMoTa = ws.getCell(`${cot}${hMoTa}`);
        oMoTa.value = dong.rubric[KHOA_RUBRIC[muc]] ?? '';
        oMoTa.font = { name: FONT_RUBRIC, size: 12, color: { argb: XANH_THAM } };
        oMoTa.alignment = { vertical: 'middle', wrapText: true };

        // Đúng một ô TRUE — mức LMS đã ghi nhận cho lần chấm này.
        const oTick = ws.getCell(`${cot}${hTick}`);
        oTick.value = muc === dong.muc;
        oTick.font = { name: FONT_TEXT, size: 13, color: { argb: XANH_THAM } };
        oTick.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });

      const oGhiNhan = ws.getCell(`I${hMoTa}`);
      // Đọc hàng TRUE/FALSE ngay dưới. Trùng khít công thức của file mẫu, và là
      // thứ COUNTIFS ở khối phải đếm để ra số lần đạt từng mức.
      oGhiNhan.value = {
        formula: CAC_MUC.reduceRight((trong, muc, i) => {
          const cot = String.fromCharCode('D'.charCodeAt(0) + i);
          return `IF(${cot}${hTick},"${COMPETENCY_LEVEL_LABEL[muc]}",${trong})`;
        }, '""'),
      };
      oGhiNhan.font = { name: FONT_TEXT, size: 13, color: { argb: XANH_THAM } };
      oGhiNhan.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

      r += 2;
    }

    r += 1;
  }

  if (theoHoatDong.size === 0) {
    ws.getCell('B3').value = 'Chưa có minh chứng nào trong kỳ đánh giá này.';
    ws.getCell('B3').font = { name: FONT_TEXT, size: 13, italic: true, color: { argb: XANH_THAM } };
  }
}

// ── Điểm vào ────────────────────────────────────────────────────────────────

export async function exportCompetencyResultsToExcel(data: CompetencyExportData): Promise<void> {
  // Nạp động: ExcelJS nặng khoảng 900KB, mà nút xuất file thì hiếm khi bấm —
  // để import tĩnh là mọi lượt vào trang năng lực đều phải tải chỗ đó.
  const ExcelJS = (await import('exceljs')).default;
  const workbook: Workbook = new ExcelJS.Workbook();

  // Excel tính lại toàn bộ công thức khi mở. Thiếu cờ này thì các ô công thức
  // hiện trống cho tới khi người dùng bấm vào sửa — ExcelJS không ghi sẵn kết
  // quả, nó chỉ ghi chuỗi công thức.
  workbook.calcProperties.fullCalcOnLoad = true;

  const tenSheetTheoHocSinh = new Map<string, string>();
  const daDung = new Set<string>(['Tổng hợp kết quả']);
  for (const student of data.students) {
    let ungVien = tenSheetAnToan(student.fullName || student.studentCode);
    let i = 2;
    while (daDung.has(ungVien)) {
      ungVien = tenSheetAnToan(`${student.fullName || student.studentCode} ${i++}`);
    }
    daDung.add(ungVien);
    tenSheetTheoHocSinh.set(student.studentId, ungVien);
  }

  dungSheetTongHop(workbook.addWorksheet('Tổng hợp kết quả'), data, tenSheetTheoHocSinh);

  for (const student of data.students) {
    const ten = tenSheetTheoHocSinh.get(student.studentId)!;
    dungSheetHocSinh(workbook.addWorksheet(ten), data, student);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tong-hop-nang-luc-${tenSheetAnToan(data.category.name).toLowerCase().replace(/\s+/g, '-')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
