/**
 * Cây thư mục của ngân hàng câu hỏi.
 *
 * API trả thư mục dạng danh sách phẳng, mỗi thư mục mang `parentId`. Nơi nào cần
 * cây (màn hình kho, ô chọn thư mục đích, danh sách nguồn của quiz mẫu) đều đi
 * qua đây để thứ tự và đường dẫn hiển thị ở mọi nơi giống hệt nhau.
 */

export type NutThuMuc = {
  id: string;
  name: string;
  position: number;
  parentId?: string | null;
};

export type ThuMucTrongCay<T extends NutThuMuc> = T & {
  /** Tên đầy đủ từ gốc, ví dụ "Chương 1 / Bài 2". */
  path: string;
  /** 0 là thư mục ở cấp ngoài cùng. */
  depth: number;
};

/**
 * Xếp thư mục theo thứ tự đọc của cây: cha đứng trước, rồi tới các con của nó,
 * anh em theo `position`. Thư mục có cha không còn trong danh sách được coi như
 * nằm ở cấp ngoài cùng, để không bao giờ biến mất khỏi màn hình.
 */
export function sapTheoCay<T extends NutThuMuc>(folders: T[]): ThuMucTrongCay<T>[] {
  const ids = new Set(folders.map((f) => f.id));
  const theoCha = new Map<string | null, T[]>();
  for (const f of folders) {
    const cha = f.parentId && ids.has(f.parentId) ? f.parentId : null;
    const ds = theoCha.get(cha) ?? [];
    ds.push(f);
    theoCha.set(cha, ds);
  }
  for (const ds of theoCha.values()) {
    ds.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'vi'));
  }

  const ra: ThuMucTrongCay<T>[] = [];
  const daDi = new Set<string>();
  const di = (cha: string | null, tienTo: string, depth: number) => {
    for (const f of theoCha.get(cha) ?? []) {
      // Dữ liệu hỏng có vòng lặp thì vẫn dừng được.
      if (daDi.has(f.id)) continue;
      daDi.add(f.id);
      const path = tienTo ? `${tienTo} / ${f.name}` : f.name;
      ra.push({ ...f, path, depth });
      di(f.id, path, depth + 1);
    }
  };
  di(null, '', 0);

  // Chỉ xảy ra khi có vòng lặp: đưa phần còn sót ra cấp ngoài cùng.
  for (const f of folders) {
    if (!daDi.has(f.id)) ra.push({ ...f, path: f.name, depth: 0 });
  }
  return ra;
}

/** `rootId` cùng mọi thư mục nằm dưới nó, ở bất kỳ cấp nào. */
export function thuMucTrongNhanh(
  folders: { id: string; parentId?: string | null }[],
  rootId: string
): string[] {
  const con = new Map<string, string[]>();
  for (const f of folders) {
    if (!f.parentId) continue;
    const ds = con.get(f.parentId) ?? [];
    ds.push(f.id);
    con.set(f.parentId, ds);
  }
  const ra = [rootId];
  const daDi = new Set(ra);
  for (let i = 0; i < ra.length; i++) {
    for (const c of con.get(ra[i]!) ?? []) {
      if (daDi.has(c)) continue;
      daDi.add(c);
      ra.push(c);
    }
  }
  return ra;
}
