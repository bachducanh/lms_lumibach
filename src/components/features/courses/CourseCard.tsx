import Link from 'next/link';
import { BookOpen, Users, Calendar, ArrowRight } from 'lucide-react';
import type { CourseListItem } from '@/actions/courses';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT:     { label: 'Nháp',     className: 'bg-orange-500/15 text-orange-500 border border-orange-500/25' },
  PUBLISHED: { label: 'Hoạt động', className: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 dark:text-emerald-400' },
  ARCHIVED:  { label: 'Lưu trữ',  className: 'bg-slate-500/15 text-slate-500 border border-slate-500/25' },
};

/* Gradient nền khi không có thumbnail — xoay vòng theo hash tên */
const GRADIENTS = [
  'from-[#050E3C] via-[#0A2260] to-[#0D3B8E]',
  'from-[#0A1628] via-[#0D2D5A] to-[#0B4F8A]',
  'from-[#0D1B3E] via-[#1A3A6B] to-[#0E5E8A]',
  'from-[#070F2B] via-[#142550] to-[#1A3C7A]',
];

function pickGradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

type Props = { course: CourseListItem };

export function CourseCard({ course }: Props) {
  const ownerName =
    course.owner.fullName ??
    `${course.owner.firstName} ${course.owner.lastName}`.trim();

  const status = STATUS_CONFIG[course.status] ?? STATUS_CONFIG.DRAFT;
  const grad   = pickGradient(course.name);

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden
                 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 hover:border-primary/30"
    >
      {/* Thumbnail */}
      <div className="relative h-40 w-full shrink-0 overflow-hidden">
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt={course.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${grad}`}>
            {/* Grid pattern overlay */}
            <svg className="absolute inset-0 h-full w-full opacity-10" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id={`grid-${course.id}`} width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M 24 0 L 0 0 0 24" fill="none" stroke="white" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#grid-${course.id})`} />
            </svg>
            <BookOpen className="relative h-12 w-12 text-white/20" />
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2.5 left-2.5">
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${status.className}`}>
            {status.label}
          </span>
        </div>

        {/* Subject/grade badge top-right */}
        {(course.subject || course.gradeLevel) && (
          <div className="absolute top-2.5 right-2.5">
            <span className="inline-flex items-center rounded-md bg-black/40 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-white/80">
              {[course.subject, course.gradeLevel].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-primary/0 transition-colors duration-200 group-hover:bg-primary/5" />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex-1">
          <p className="font-semibold leading-snug line-clamp-2 transition-colors duration-150 group-hover:text-primary">
            {course.name}
          </p>
          {course.shortName && (
            <p className="mt-0.5 text-xs text-muted-foreground">{course.shortName}</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          <span className="text-muted-foreground/60">GV · </span>{ownerName}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {course._count.enrollments}
            </span>
            {course.startDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(course.startDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' })}
              </span>
            )}
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 transition-all duration-150 group-hover:text-primary group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}
