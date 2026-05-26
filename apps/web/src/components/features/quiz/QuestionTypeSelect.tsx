'use client';

import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { QUESTION_TYPE_LABEL, QUESTION_TYPE_ICON } from '@/lib/question-type-labels';
import { cn } from '@/lib/utils';

// Grouped so the (now 14) types stay scannable in the menu.
const GROUPS: { label: string; types: string[] }[] = [
  {
    label: 'Trắc nghiệm / Đúng – Sai',
    types: ['MULTIPLE_CHOICE_SINGLE', 'MULTIPLE_CHOICE_MULTIPLE', 'TRUE_FALSE', 'TRUE_FALSE_MULTI'],
  },
  {
    label: 'Tự luận & Ghép / Sắp xếp',
    types: ['ESSAY', 'ORDERING', 'MATCHING'],
  },
  {
    label: 'Lập trình',
    types: [
      'CODE_PYTHON',
      'CODE_CPP',
      'CODE_WEB',
      'PARSONS',
      'CODE_FILL',
      'CODE_DEBUG_PYTHON',
      'CODE_DEBUG_CPP',
    ],
  },
];

type Props = {
  value: string;
  onChange: (type: string) => void;
  disabled?: boolean;
};

export function QuestionTypeSelect({ value, onChange, disabled }: Props) {
  const CurrentIcon = QUESTION_TYPE_ICON[value];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          'group border-input bg-background hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-ring/30 flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none',
          'data-[popup-open]:border-ring data-[popup-open]:ring-ring/30 data-[popup-open]:ring-[3px]',
          disabled && 'cursor-default opacity-70'
        )}
      >
        {CurrentIcon && <CurrentIcon className="text-primary h-4 w-4 shrink-0" />}
        <span className="flex-1 truncate">{QUESTION_TYPE_LABEL[value] ?? value}</span>
        {!disabled && (
          <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-data-[popup-open]:rotate-180" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-[420px] w-(--anchor-width) min-w-[260px] overflow-y-auto">
        {GROUPS.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-[10px] tracking-wider uppercase">
                {group.label}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
              {group.types.map((t) => {
                const Icon = QUESTION_TYPE_ICON[t];
                return (
                  <DropdownMenuRadioItem key={t} value={t} className="gap-2 pr-8 pl-2">
                    {Icon && <Icon className="text-muted-foreground h-4 w-4 shrink-0" />}
                    <span className="truncate">{QUESTION_TYPE_LABEL[t] ?? t}</span>
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
