import { describe, expect, it } from 'vitest';
import { sapTheoCay, thuMucTrongNhanh } from '@lumibach/types';

/**
 * Hàm dựng cây thư mục dùng chung cho màn hình kho, ô chọn thư mục đích và danh
 * sách nguồn của quiz mẫu — sai ở đây là ba nơi cùng hiện lệch.
 */

const f = (id: string, parentId: string | null, position: number, name = id) => ({
  id,
  name,
  parentId,
  position,
});

describe('sapTheoCay', () => {
  it('cha đứng trước con, anh em theo position, kèm đường dẫn và độ sâu', () => {
    const ra = sapTheoCay([
      f('b', null, 1, 'Chương 2'),
      f('a1', 'a', 0, 'Bài 1'),
      f('a', null, 0, 'Chương 1'),
      f('a1x', 'a1', 0, 'Dạng 1'),
      f('a2', 'a', 1, 'Bài 2'),
    ]);
    expect(ra.map((x) => [x.path, x.depth])).toEqual([
      ['Chương 1', 0],
      ['Chương 1 / Bài 1', 1],
      ['Chương 1 / Bài 1 / Dạng 1', 2],
      ['Chương 1 / Bài 2', 1],
      ['Chương 2', 0],
    ]);
  });

  it('thư mục mất cha được đưa ra cấp ngoài cùng, không biến mất', () => {
    const ra = sapTheoCay([f('x', 'khong-con', 0)]);
    expect(ra.map((x) => [x.id, x.depth])).toEqual([['x', 0]]);
  });

  it('dữ liệu hỏng có vòng lặp vẫn dừng và vẫn hiện đủ thư mục', () => {
    const ra = sapTheoCay([f('a', 'b', 0), f('b', 'a', 0)]);
    expect(ra.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });
});

describe('thuMucTrongNhanh', () => {
  it('lấy thư mục gốc cùng mọi cấp con, bỏ nhánh bên cạnh', () => {
    const ds = [f('a', null, 0), f('b', 'a', 0), f('c', 'b', 0), f('d', null, 1)];
    expect(thuMucTrongNhanh(ds, 'a').sort()).toEqual(['a', 'b', 'c']);
  });
});
