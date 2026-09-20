import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Typewriter } from '@/components/features/landing/Typewriter';

/**
 * Minh hoạ khung soạn code + kết quả chấm tự động ở hero. Khung tối ở cả hai
 * theme (như trình soạn thảo thật), không dùng hiệu ứng kính/blur.
 */
export function CodeWindow({ className }: { className?: string }) {
  return (
    <figure
      className={cn(
        'bg-lb-navy-deep overflow-hidden rounded-xl border border-white/10 shadow-[0_12px_32px_-10px_rgb(7_26_47_/_40%)]',
        className
      )}
      aria-label="Minh hoạ: bài tập Python được chấm tự động"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-black/20 px-4 py-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <p className="font-mono text-xs text-slate-300">bai-tap · python · tự chấm</p>
      </div>

      {/* Code body */}
      <div className="overflow-x-auto py-3 font-mono text-[12.5px] leading-relaxed text-slate-100">
        <CodeLine n={1}>
          <KW>def</KW> <FN>sieve</FN>(n):
        </CodeLine>
        <CodeLine n={2}>
          {'    is_prime = ['}
          <FN>True</FN>
          {'] * (n + '}
          <NUM>1</NUM>
          {')'}
        </CodeLine>
        <CodeLine n={3}>
          {'    is_prime['}
          <NUM>0</NUM>
          {'] = is_prime['}
          <NUM>1</NUM>
          {'] = '}
          <FN>False</FN>
        </CodeLine>
        <CodeLine n={4}>
          {'    '}
          <KW>for</KW>
          {' i '}
          <KW>in</KW> <FN>range</FN>
          {'('}
          <NUM>2</NUM>
          {', '}
          <FN>int</FN>
          {'(n ** '}
          <NUM>0.5</NUM>
          {') + '}
          <NUM>1</NUM>
          {'):'}
        </CodeLine>
        <CodeLine n={5}>
          {'        '}
          <KW>if</KW>
          {' is_prime[i]:'}
        </CodeLine>
        <CodeLine n={6}>
          {'            '}
          <KW>for</KW>
          {' j '}
          <KW>in</KW> <FN>range</FN>
          {'(i * i, n + '}
          <NUM>1</NUM>
          {', i):'}
        </CodeLine>
        <CodeLine n={7} highlight>
          {'                is_prime[j] = '}
          <FN>False</FN>
        </CodeLine>
        <CodeLine n={8}>
          {'    '}
          <KW>return</KW>
          {' [i '}
          <KW>for</KW>
          {' i, p '}
          <KW>in</KW> <FN>enumerate</FN>
          {'(is_prime) '}
          <KW>if</KW>
          {' p]'}
        </CodeLine>
        <CodeLine n={9} />
        <CodeLine n={10}>
          <FN>print</FN>
          {'('}
          <FN>sieve</FN>
          {'('}
          <FN>int</FN>
          {'('}
          <FN>input</FN>
          {'())))'}
        </CodeLine>
      </div>

      {/* Test results */}
      <div className="space-y-1.5 border-t border-white/10 bg-black/20 px-4 py-3 text-xs text-[#7dffbc]">
        <p className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Test 1/5: n = 30 → 10 số nguyên tố
          <span className="ml-auto font-mono text-white/60">0.04s</span>
        </p>
        <p className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Test 2/5: n = 100 → 25 số nguyên tố
          <span className="ml-auto font-mono text-white/60">0.06s</span>
        </p>
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Hoàn thành 5/5 test
          <span className="ml-auto font-mono font-bold">100/100</span>
        </p>
      </div>

      {/* Console line */}
      <div className="border-t border-white/10 bg-black/30 px-4 py-2.5 font-mono text-xs">
        <span className="text-[#ff5aa9]">$ </span>
        <Typewriter
          className="text-slate-300"
          phrases={[
            'chấm tự động qua test case…',
            'tổng hợp điểm vào sổ điểm…',
            'ghi nhận tiến độ học sinh…',
          ]}
        />
      </div>
    </figure>
  );
}

// Màu token code trên nền tối.
function KW({ children }: { children: ReactNode }) {
  return <span className="text-[#ff5aa9]">{children}</span>;
}
function FN({ children }: { children: ReactNode }) {
  return <span className="text-[#75c8ff]">{children}</span>;
}
function NUM({ children }: { children: ReactNode }) {
  return <span className="text-[#e8b974]">{children}</span>;
}

function CodeLine({
  n,
  children,
  highlight = false,
}: {
  n: number;
  children?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex w-max min-w-full items-baseline gap-4 px-4 py-px',
        highlight && 'border-l-lb-pink bg-lb-pink/10 border-l-2 pl-3.5'
      )}
    >
      <span className="w-4 shrink-0 text-right text-[11px] text-white/35 select-none" aria-hidden>
        {n}
      </span>
      <code className="whitespace-pre">{children ?? ' '}</code>
    </div>
  );
}
