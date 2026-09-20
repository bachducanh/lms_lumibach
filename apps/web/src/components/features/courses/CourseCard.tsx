import Link from 'next/link';
import { Tag, Users } from 'lucide-react';
import type { CourseListItem } from '@lumibach/types';
import { cn } from '@/lib/utils';

// ── Thumbnail placeholder (bảng màu thương hiệu) ────────────────
// Mảng màu phẳng + lưới chấm + chữ cái đầu của tên khoá (ô logo trắng đè lên bên trái).

const TONES = [
  'bg-lb-pink-strong text-white',
  'bg-lb-navy text-white',
  'bg-lb-navy-mid text-lb-cyan',
  'bg-lb-cyan text-lb-navy-deep',
  'bg-lb-navy-deep text-lb-pink',
  'bg-lb-pink text-white',
];

function pickTone(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length]!;
}

/** Mã ngắn (vd "PY-10" → "PY") nếu có; không thì chữ cái đầu của hai từ đầu trong tên khoá. */
function getInitials(course: { name: string; shortName: string | null }) {
  const fromShort = Array.from((course.shortName ?? '').replace(/[^\p{L}\p{N}]/gu, ''))
    .slice(0, 2)
    .join('');
  if (fromShort) return fromShort.toUpperCase();

  const words = course.name.split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? words.slice(0, 2).map((w) => Array.from(w)[0] ?? '')
      : Array.from(words[0] ?? '').slice(0, 2);
  return letters.join('').toUpperCase() || '·';
}

// ── Status ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  PUBLISHED: { dot: 'bg-emerald-500', label: 'Đang mở' },
  DRAFT: { dot: 'bg-amber-500', label: 'Nháp' },
  ARCHIVED: { dot: 'bg-slate-400', label: 'Lưu trữ' },
};

// ── Component ──────────────────────────────────────────────────
//
// Bố cục theo thẻ khoá học của edX: ảnh bìa thấp với ô logo trắng đè lên → tiêu đề đậm +
// đơn vị cung cấp → các dòng thông tin có biểu tượng ở chân thẻ.
// Hover chỉ đổi bóng (không nhấc thẻ), viền 1px, bo góc 12px.

type Props = { course: CourseListItem };

export function CourseCard({ course }: Props) {
  const ownerName =
    course.owner.fullName ?? `${course.owner.firstName} ${course.owner.lastName}`.trim();
  const status = STATUS_CONFIG[course.status] ?? {
    dot: 'bg-slate-400',
    label: course.status,
  };

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group focus-visible:outline-lb-navy block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 dark:focus-visible:outline-white"
    >
      <article className="bg-card text-card-foreground dark:border-border flex h-full min-w-[240px] flex-col overflow-hidden rounded-xl border border-[#cfd6e1] shadow-sm transition-shadow duration-300 ease-in-out group-hover:shadow-[0_4px_18px_rgb(11_31_54_/_16%)]">
        {/* ── Ảnh bìa + ô logo ──────────────────────────────── */}
        <div className="relative h-36 w-full shrink-0 overflow-hidden">
          {course.thumbnail ? (
            <img
              src={course.thumbnail}
              alt=""
              className="h-full w-full object-cover object-top"
              loading="lazy"
            />
          ) : (
            <div
              className={cn(
                'relative flex h-full w-full items-center justify-end pr-5 text-4xl font-extrabold tracking-tight',
                pickTone(course.name)
              )}
              aria-hidden
            >
              <span
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1.5px)',
                  backgroundSize: '16px 16px',
                }}
              />
              <span className="relative">{getInitials(course)}</span>
            </div>
          )}
          {/* Logo do người tạo khoá chọn; chưa đặt thì rơi về logo LumiBach. */}
          <img
            src={course.logo || '/LumiBach_secondlogo.png'}
            alt=""
            width={132}
            height={42}
            className="absolute top-4 left-4 h-[42px] w-[132px] rounded-md bg-white object-contain p-1 shadow"
          />
        </div>

        {/* ── Tiêu đề + đơn vị cung cấp ─────────────────────── */}
        <div className="flex flex-1 flex-col px-4 pt-4">
          <h3 className="text-foreground group-hover:text-primary line-clamp-2 text-xl leading-[1.5] font-bold break-words">
            {course.name}
          </h3>
          <p className="text-foreground/90 mt-0.5 truncate text-base">{ownerName}</p>
        </div>

        {/* ── Thông tin ở chân thẻ ──────────────────────────── */}
        {/* Chỉ giữ ba dòng: sĩ số, môn, trạng thái. Mã lớp và đường dẫn danh mục
            đã có ở trang khoá học — nhét vào đây chỉ làm thẻ cao lệch nhau. */}
        <ul className="text-foreground/90 flex flex-col gap-2 px-4 pt-6 pb-5 text-sm">
          <li className="flex items-center gap-2">
            <Users className="h-5 w-5 shrink-0" aria-hidden />
            <span>{course._count.enrollments} học sinh</span>
          </li>
          {course.subject && (
            <li className="flex items-center gap-2">
              <Tag className="h-5 w-5 shrink-0" aria-hidden />
              <span className="truncate">{course.subject}</span>
            </li>
          )}
          <li className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
              <span className={cn('h-2.5 w-2.5 rounded-full', status.dot)} />
            </span>
            <span>{status.label}</span>
          </li>
        </ul>
      </article>
    </Link>
  );
}
