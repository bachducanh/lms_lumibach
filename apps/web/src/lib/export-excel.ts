type ExcelCellValue = string | number | boolean | Date | null | undefined;

function toSheetValue(value: ExcelCellValue) {
  return value ?? '';
}

function visibleLength(value: ExcelCellValue): number {
  if (value == null) return 0;
  if (value instanceof Date) return 16;
  return String(value).length;
}

function safeSheetName(value: string): string {
  return (
    (value || 'Sheet1')
      .replace(/[\\/?*[\]:]/g, ' ')
      .trim()
      .slice(0, 31) || 'Sheet1'
  );
}

export function safeExcelFileName(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'du-lieu';
}

// xlsx được build CJS — đôi khi với Turbopack/ESM interop, namespace import
// không có .utils trực tiếp mà nằm trong .default. Hàm này lấy đúng object.
async function loadXLSX() {
  const mod: { utils?: unknown; default?: unknown } = (await import('xlsx')) as unknown as {
    utils?: unknown;
    default?: unknown;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const x: any = (mod as any).utils ? mod : ((mod as any).default ?? mod);
  if (!x?.utils || typeof x.writeFile !== 'function') {
    throw new Error('Không thể tải thư viện xlsx (utils/writeFile bị thiếu).');
  }
  return x as typeof import('xlsx');
}

export async function exportRowsToExcel({
  rows,
  fileName,
  sheetName = 'Bai lam',
}: {
  rows: ExcelCellValue[][];
  fileName: string;
  sheetName?: string;
}) {
  const XLSX = await loadXLSX();
  const normalizedRows = rows.map((row) => row.map(toSheetValue));
  const worksheet = XLSX.utils.aoa_to_sheet(normalizedRows);
  const columnCount = Math.max(0, ...rows.map((row) => row.length));

  worksheet['!cols'] = Array.from({ length: columnCount }, (_, columnIndex) => {
    const maxLength = rows.reduce((max, row) => Math.max(max, visibleLength(row[columnIndex])), 8);
    return { wch: Math.min(36, Math.max(10, maxLength + 2)) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheetName));
  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

// Export workbook nhiều sheet trong 1 file.
export async function exportSheetsToExcel({
  sheets,
  fileName,
}: {
  sheets: { name: string; rows: ExcelCellValue[][] }[];
  fileName: string;
}) {
  const XLSX = await loadXLSX();
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const s of sheets) {
    const normalizedRows = s.rows.map((row) => row.map(toSheetValue));
    const worksheet = XLSX.utils.aoa_to_sheet(normalizedRows);
    const columnCount = Math.max(0, ...s.rows.map((row) => row.length));
    worksheet['!cols'] = Array.from({ length: columnCount }, (_, columnIndex) => {
      const maxLength = s.rows.reduce(
        (max, row) => Math.max(max, visibleLength(row[columnIndex])),
        8
      );
      return { wch: Math.min(48, Math.max(10, maxLength + 2)) };
    });

    // Tránh trùng tên sheet (Excel cấm).
    let candidate = safeSheetName(s.name);
    let i = 2;
    while (usedNames.has(candidate)) {
      candidate = safeSheetName(`${s.name} ${i++}`);
    }
    usedNames.add(candidate);

    XLSX.utils.book_append_sheet(workbook, worksheet, candidate);
  }

  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}
