import { describe, expect, it } from 'vitest';
import { vnDateTimeToUtc } from '@lumibach/types';
import { timDonXungDot, type KhoangDon } from '@/modules/rooms/room-bookings.service';

const NGAY = '2026-09-01';
const gio = (h: number, m = 0) => vnDateTimeToUtc(NGAY, h * 60 + m);

const don = (id: string, roomId: string, tu: number, den: number): KhoangDon => ({
  id,
  roomId,
  startAt: gio(tu),
  endAt: gio(den),
});

const ids = (ds: KhoangDon[]) => ds.map((d) => d.id).sort();

describe('timDonXungDot', () => {
  it('không tự coi mình là xung đột với chính mình', () => {
    const a = don('a', 'p1', 9, 11);
    expect(timDonXungDot(a, [a])).toEqual([]);
  });

  it('hai khung liền kề không tính là xung đột (nửa mở)', () => {
    const a = don('a', 'p1', 9, 10);
    const b = don('b', 'p1', 10, 11);
    expect(timDonXungDot(a, [a, b])).toEqual([]);
    expect(timDonXungDot(b, [a, b])).toEqual([]);
  });

  it('phát hiện khung giao nhau một phần', () => {
    const a = don('a', 'p1', 9, 11);
    const b = don('b', 'p1', 10, 12);
    expect(ids(timDonXungDot(a, [a, b]))).toEqual(['b']);
    expect(ids(timDonXungDot(b, [a, b]))).toEqual(['a']);
  });

  it('phát hiện khung nằm lọt hoàn toàn bên trong khung khác', () => {
    const bao = don('bao', 'p1', 8, 16);
    const trong = don('trong', 'p1', 10, 11);
    expect(ids(timDonXungDot(bao, [bao, trong]))).toEqual(['trong']);
    expect(ids(timDonXungDot(trong, [bao, trong]))).toEqual(['bao']);
  });

  it('hai khung trùng khít nhau là xung đột', () => {
    const a = don('a', 'p1', 9, 11);
    const b = don('b', 'p1', 9, 11);
    expect(ids(timDonXungDot(a, [a, b]))).toEqual(['b']);
  });

  it('khác phòng thì không xung đột dù trùng giờ', () => {
    const a = don('a', 'p1', 9, 11);
    const b = don('b', 'p2', 9, 11);
    expect(timDonXungDot(a, [a, b])).toEqual([]);
  });

  it('trả về nhiều đơn khi có nhiều xung đột', () => {
    const a = don('a', 'p1', 8, 16);
    const b = don('b', 'p1', 9, 10);
    const c = don('c', 'p1', 11, 12);
    const khacPhong = don('d', 'p2', 9, 10);
    expect(ids(timDonXungDot(a, [a, b, c, khacPhong]))).toEqual(['b', 'c']);
  });

  it('khung tách rời hoàn toàn thì không xung đột', () => {
    const sang = don('sang', 'p1', 8, 10);
    const chieu = don('chieu', 'p1', 14, 16);
    expect(timDonXungDot(sang, [sang, chieu])).toEqual([]);
  });

  it('chênh nhau đúng một phút vẫn bắt được', () => {
    const a: KhoangDon = { id: 'a', roomId: 'p1', startAt: gio(9), endAt: gio(10, 1) };
    const b: KhoangDon = { id: 'b', roomId: 'p1', startAt: gio(10), endAt: gio(11) };
    expect(ids(timDonXungDot(a, [a, b]))).toEqual(['b']);
  });

  it('danh sách rỗng trả về rỗng', () => {
    expect(timDonXungDot(don('a', 'p1', 9, 11), [])).toEqual([]);
  });
});
