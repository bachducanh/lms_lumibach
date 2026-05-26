'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { BarChart3, ChevronRight, Target } from 'lucide-react';
import type { ActivityType } from '@lumibach/types';

type Props = {
  courseId: string;
  courseSlug: string;
  activityType: ActivityType;
  activityId: string;
  canManage: boolean;
};

const ACTIVITY_LABEL: Record<ActivityType, string> = {
  assignment: 'bài tập',
  quiz: 'quiz',
  'code-exercise': 'bài code',
  'practice-test': 'đề luyện tập',
};

export function ActivityCompetencyPanel({
  courseSlug,
  activityType,
  activityId,
  canManage,
}: Props) {
  const href = `/courses/${courseSlug}/competencies/grade?activityType=${activityType}&activityId=${activityId}`;

  return (
    <section className="border-border bg-card overflow-hidden rounded-lg border">
      <div className="relative px-5 py-4">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 border-primary/20 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
              <Target className="text-primary h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">Đánh giá năng lực</h2>
                <Badge variant="outline" className="text-[11px]">
                  {ACTIVITY_LABEL[activityType]}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                Mở trang chấm riêng để gán chỉ báo, chọn học sinh và ghi nhận minh chứng rõ ràng
                hơn.
              </p>
            </div>
          </div>
          <Link
            href={href}
            className={buttonVariants({ variant: canManage ? 'default' : 'outline', size: 'sm' })}
          >
            <BarChart3 className="mr-1.5 h-4 w-4" />
            Mở trang chấm
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
