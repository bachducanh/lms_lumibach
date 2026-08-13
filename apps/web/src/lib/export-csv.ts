// Xuất CSV phía client. Dùng UTF-8 BOM để Excel hiển thị tiếng Việt đúng và
// pandas (pd.read_csv) đọc thẳng không cần encoding đặc biệt.

type CsvCellValue = string | number | boolean | null | undefined;

function escapeCell(value: CsvCellValue): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Bọc trong dấu nháy nếu chứa dấu phẩy, nháy kép hoặc xuống dòng.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportRowsToCsv({ rows, fileName }: { rows: CsvCellValue[][]; fileName: string }) {
  const content = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
  // \uFEFF = BOM, bat buoc de Excel doc dung tieng Viet. Viet dang escape
  // thay vi ky tu that: ky tu BOM tho vo hinh trong editor va bi linter chan.
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
