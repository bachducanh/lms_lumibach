import { describe, expect, it } from 'vitest';
import type { HandoverFieldDto } from '@lumibach/types';
import { soSanhBanGiao } from '@/modules/rooms/handovers.service';

function truong(over: Partial<HandoverFieldDto> & { key: string }): HandoverFieldDto {
  return {
    id: `f_${over.key}`,
    roomId: null,
    label: over.label ?? over.key,
    dataType: over.dataType ?? 'NUMBER',
    options: over.options ?? null,
    isRequired: over.isRequired ?? false,
    appliesTo: over.appliesTo ?? 'BOTH',
    sortOrder: over.sortOrder ?? 0,
    isActive: over.isActive ?? true,
    isShared: true,
    ...over,
  };
}

const SO_MAY = truong({ key: 'so_may', label: 'Số máy', dataType: 'NUMBER' });
const SO_CHUOT = truong({ key: 'so_chuot', label: 'Số chuột', dataType: 'NUMBER' });

describe('soSanhBanGiao — đối chiếu số liệu nhận và trả', () => {
  it('trả về đủ số máy thì không lệch', () => {
    const diff = soSanhBanGiao({ so_may: 30 }, { so_may: 30 }, [SO_MAY]);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ changed: false, shortfall: 0 });
  });

  it('TRẢ ÍT HƠN lúc nhận thì shortfall dương — đây là trường hợp phải cảnh báo', () => {
    const diff = soSanhBanGiao({ so_may: 30 }, { so_may: 28 }, [SO_MAY]);
    expect(diff[0]).toMatchObject({ changed: true, shortfall: 2 });
  });

  it('trả nhiều hơn lúc nhận thì shortfall âm, không tính là thiếu hụt', () => {
    const diff = soSanhBanGiao({ so_may: 28 }, { so_may: 30 }, [SO_MAY]);
    expect(diff[0]?.shortfall).toBe(-2);
    expect((diff[0]?.shortfall ?? 0) > 0).toBe(false);
  });

  it('so nhiều trường cùng lúc, chỉ trường thiếu mới có shortfall dương', () => {
    const diff = soSanhBanGiao({ so_may: 30, so_chuot: 15 }, { so_may: 30, so_chuot: 12 }, [
      SO_MAY,
      SO_CHUOT,
    ]);
    const thieu = diff.filter((d) => (d.shortfall ?? 0) > 0);
    expect(thieu).toHaveLength(1);
    expect(thieu[0]?.key).toBe('so_chuot');
    expect(thieu[0]?.shortfall).toBe(3);
  });

  it('trường dạng chữ chỉ đánh dấu có đổi, không tính shortfall', () => {
    const ghiChu = truong({ key: 'ghi_chu', label: 'Ghi chú', dataType: 'TEXT' });
    const diff = soSanhBanGiao({ ghi_chu: 'sạch' }, { ghi_chu: 'bẩn' }, [ghiChu]);
    expect(diff[0]).toMatchObject({ changed: true, shortfall: null });
  });

  it('trường có/không đổi trạng thái được đánh dấu changed', () => {
    const mayChieu = truong({ key: 'may_chieu', label: 'Máy chiếu', dataType: 'BOOLEAN' });
    const diff = soSanhBanGiao({ may_chieu: true }, { may_chieu: false }, [mayChieu]);
    expect(diff[0]).toMatchObject({ changed: true, shortfall: null });
  });

  it('trường dạng chọn đổi giá trị được đánh dấu', () => {
    const veSinh = truong({
      key: 've_sinh',
      label: 'Vệ sinh',
      dataType: 'SELECT',
      options: ['Sạch', 'Cần dọn'],
    });
    const diff = soSanhBanGiao({ ve_sinh: 'Sạch' }, { ve_sinh: 'Cần dọn' }, [veSinh]);
    expect(diff[0]).toMatchObject({ changed: true, shortfall: null });
  });

  it('bỏ qua trường chỉ áp dụng cho một lượt — không có gì để đối chiếu', () => {
    const chiNhan = truong({ key: 'chi_nhan', appliesTo: 'CHECKIN' });
    const chiTra = truong({ key: 'chi_tra', appliesTo: 'CHECKOUT' });
    const diff = soSanhBanGiao({ chi_nhan: 5, so_may: 30 }, { chi_tra: 5, so_may: 30 }, [
      chiNhan,
      chiTra,
      SO_MAY,
    ]);
    expect(diff.map((d) => d.key)).toEqual(['so_may']);
  });

  it('thiếu giá trị ở một bên thì coi là null, không tính shortfall', () => {
    const diff = soSanhBanGiao({ so_may: 30 }, {}, [SO_MAY]);
    expect(diff[0]).toMatchObject({
      checkinValue: 30,
      checkoutValue: null,
      changed: true,
      shortfall: null,
    });
  });

  it('không có trường nào thì bảng đối chiếu rỗng', () => {
    expect(soSanhBanGiao({ so_may: 30 }, { so_may: 30 }, [])).toEqual([]);
  });

  it('số 0 là giá trị hợp lệ, không bị coi như bỏ trống', () => {
    const diff = soSanhBanGiao({ so_may: 2 }, { so_may: 0 }, [SO_MAY]);
    expect(diff[0]).toMatchObject({ checkoutValue: 0, shortfall: 2 });
  });
});
