import Link from 'next/link';
import { BookOpen, Users, Play } from 'lucide-react';
import type { CourseListItem } from '@lumibach/types';
import { cn } from '@/lib/utils';

// ── Subject → colored chip ─────────────────────────────────────

const CHIP_COLORS = [
  'border-blue-500/30 bg-blue-500/10 text-blue-400',
  'border-violet-500/30 bg-violet-500/10 text-violet-400',
  'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  'border-cyan-500/30 bg-cyan-500/10 text-cyan-400',
  'border-amber-500/30 bg-amber-500/10 text-amber-400',
  'border-rose-500/30 bg-rose-500/10 text-rose-400',
  'border-teal-500/30 bg-teal-500/10 text-teal-400',
  'border-orange-500/30 bg-orange-500/10 text-orange-400',
];

function getSubjectChip(subject: string | null): string {
  if (!subject) return '';
  const s = subject.toLowerCase();
  if (s.includes('python')) return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400';
  if (s.includes('html') || s.includes('web') || s.includes('css'))
    return 'border-violet-500/30 bg-violet-500/10 text-violet-400';
  if (s.includes('javascript') || s.includes(' js'))
    return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
  if (s.includes('lập trình') || s.includes('programming'))
    return 'border-blue-500/30 bg-blue-500/10 text-blue-400';
  if (s.includes('toán') || s.includes('math'))
    return 'border-green-500/30 bg-green-500/10 text-green-400';
  if (s.includes('cơ sở dữ liệu') || s.includes('database') || s.includes('sql'))
    return 'border-rose-500/30 bg-rose-500/10 text-rose-400';
  if (s.includes('mạng') || s.includes('network'))
    return 'border-teal-500/30 bg-teal-500/10 text-teal-400';
  if (s.includes('thuật toán') || s.includes('algorithm'))
    return 'border-orange-500/30 bg-orange-500/10 text-orange-400';
  if (s.includes('tin học')) return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400';
  let h = 0;
  for (let i = 0; i < subject.length; i++) h = (h * 31 + subject.charCodeAt(i)) >>> 0;
  return CHIP_COLORS[h % CHIP_COLORS.length] ?? CHIP_COLORS[0]!;
}

// ── Thumbnail gradient placeholder (Unity-dark palette) ─────────

const GRADIENTS = [
  ['#0d1b2a', '#1b3a5c', '#ff6b35'],
  ['#0d0d1a', '#1a1a3e', '#7c3aed'],
  ['#0a1628', '#0f3460', '#00d4ff'],
  ['#140a00', '#3d1f00', '#ff8c42'],
  ['#001a1a', '#003d3d', '#00d4ff'],
  ['#0f0a1e', '#2d1b5c', '#a855f7'],
  ['#001a0d', '#003d1f', '#22c55e'],
  ['#1a0010', '#3d0025', '#f43f5e'],
];

function pickGradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length]!;
}

// ── Status ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { dot: string; label: string; glow: string }> = {
  PUBLISHED: { dot: 'bg-emerald-500', label: 'Đang mở', glow: 'oklch(0.70 0.18 140 / 0.8)' },
  DRAFT: { dot: 'bg-amber-500', label: 'Nháp', glow: 'oklch(0.78 0.16 80  / 0.8)' },
  ARCHIVED: { dot: 'bg-slate-500', label: 'Lưu trữ', glow: 'none' },
};

// ── Component ──────────────────────────────────────────────────

type Props = { course: CourseListItem };

export function CourseCard({ course }: Props) {
  const ownerName =
    course.owner.fullName ?? `${course.owner.firstName} ${course.owner.lastName}`.trim();
  const [bg1, bg2, accent] = pickGradient(course.name);
  const chipClass = course.subject ? getSubjectChip(course.subject) : '';
  const status = STATUS_CONFIG[course.status] ?? {
    dot: 'bg-slate-500',
    label: course.status,
    glow: 'none',
  };

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group border-border bg-card unity-card-hover flex flex-col overflow-hidden rounded-xl border transition-all duration-200"
    >
      {/* ── Thumbnail (16:9) ──────────────────────────────── */}
      <div className="relative aspect-video w-full shrink-0 overflow-hidden">
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt={course.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="relative flex h-full w-full items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${bg1}, ${bg2})` }}
          >
            {/* Grid pattern */}
            <svg
              className="absolute inset-0 h-full w-full opacity-[0.07]"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id={`g-${course.id}`} width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#g-${course.id})`} />
            </svg>

            {/* Dot matrix pattern */}
            <svg
              className="absolute inset-0 h-full w-full opacity-[0.06]"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern id={`d-${course.id}`} width="16" height="16" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#d-${course.id})`} />
            </svg>

            {/* Accent glow blob */}
            <div
              className="absolute right-0 bottom-0 h-20 w-20 rounded-full opacity-40 blur-2xl"
              style={{ background: accent }}
            />

            {/* Center icon */}
            <div className="relative z-10 flex flex-col items-center gap-1.5">
              <BookOpen className="h-10 w-10 text-white/20" />
            </div>
          </div>
        )}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/20">
          <div
            className="bg-primary flex h-10 w-10 scale-75 transform items-center justify-center rounded-full opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100"
            style={{ boxShadow: '0 0 20px rgb(253 8 93 / 60%)' }}
          >
            <Play className="text-primary-foreground ml-0.5 h-4 w-4" />
          </div>
        </div>
      </div>

      {/* ── Card body ──────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Subject + grade chips */}
        <div className="flex flex-wrap gap-1.5">
          {course.subject && (
            <span
              className={cn(
                'inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold tracking-wide',
                chipClass
              )}
            >
              {course.subject}
            </span>
          )}
          {course.gradeLevel && (
            <span className="border-border bg-secondary/50 text-secondary-foreground inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium">
              {course.gradeLevel}
            </span>
          )}
        </div>

        {/* Title */}
        <div className="flex-1">
          <p className="group-hover:text-primary line-clamp-2 text-[15px] leading-snug font-semibold transition-colors duration-150">
            {course.name}
          </p>
          {course.shortName && (
            <p className="text-muted-foreground mt-0.5 font-mono text-xs">{course.shortName}</p>
          )}
        </div>

        {/* Teacher */}
        <p className="text-muted-foreground/70 truncate text-xs">{ownerName}</p>

        {/* Divider */}
        <div className="bg-border h-px" />

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" />
            {course._count.enrollments} học sinh
          </span>
          <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <span
              className={cn('h-1.5 w-1.5 rounded-full', status.dot)}
              style={{ boxShadow: `0 0 5px ${status.glow}` }}
            />
            {status.label}
          </span>
        </div>
      </div>
    </Link>
  );
}
