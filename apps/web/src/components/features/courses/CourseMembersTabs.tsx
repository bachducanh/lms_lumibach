'use client';

import { useState } from 'react';
import { Users, UsersRound } from 'lucide-react';
import { PeoplePanel } from './PeoplePanel';
import { GroupsPanel } from './GroupsPanel';
import { cn } from '@/lib/utils';
import type { CourseMember, CourseTA, CourseCoTeacher, CourseGroupsData } from '@lumibach/types';

type Props = {
  courseId: string;
  canManage: boolean;
  enrollments: CourseMember[];
  tas: CourseTA[];
  coTeachers: CourseCoTeacher[];
  courseOwner: {
    id: string;
    fullName: string | null;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  };
  groupsData: CourseGroupsData;
};

export function CourseMembersTabs({
  courseId,
  canManage,
  enrollments,
  tas,
  coTeachers,
  courseOwner,
  groupsData,
}: Props) {
  const [tab, setTab] = useState<'people' | 'groups'>('people');

  return (
    <div className="space-y-4">
      <div className="border-border flex gap-1 border-b">
        <TabButton
          active={tab === 'people'}
          onClick={() => setTab('people')}
          icon={<Users className="h-4 w-4" />}
          label="Thành viên"
        />
        <TabButton
          active={tab === 'groups'}
          onClick={() => setTab('groups')}
          icon={<UsersRound className="h-4 w-4" />}
          label="Nhóm"
        />
      </div>

      {tab === 'people' ? (
        <PeoplePanel
          courseId={courseId}
          canManage={canManage}
          enrollments={enrollments}
          tas={tas}
          coTeachers={coTeachers}
          courseOwner={courseOwner}
        />
      ) : (
        <GroupsPanel
          courseId={courseId}
          canManage={canManage}
          data={groupsData}
          students={enrollments}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'border-primary text-foreground'
          : 'text-muted-foreground hover:text-foreground border-transparent'
      )}
    >
      {icon}
      {label}
    </button>
  );
}
