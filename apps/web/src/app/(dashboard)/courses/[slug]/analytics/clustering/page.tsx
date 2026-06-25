import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { hasMinRole } from '@/lib/permissions';
import { ChevronLeft, Database } from 'lucide-react';
import type { UserRole } from '@lumibach/db';
import { ClusteringDataset } from '@/components/features/analytics/ClusteringDataset';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Dữ liệu phân cụm · ${slug}` };
}

export default async function ClusteringPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  const role = session?.user?.role as UserRole | undefined;
  if (!role || !hasMinRole(role, 'TA')) redirect(`/courses/${slug}`);

  return (
    <div className="max-w-[1600px] space-y-6">
      <div>
        <Link
          href={`/courses/${slug}/analytics`}
          className="text-muted-foreground hover:text-primary mb-2 inline-flex items-center gap-1.5 text-xs transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Phân tích khoá học
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <Database className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Dữ liệu phân cụm học sinh</h1>
            <p className="text-muted-foreground text-sm">
              Ma trận đặc trưng mỗi học sinh = 1 dòng. Xuất CSV/XLSX để xử lý phân cụm (K-Means,
              thuật toán tiến hoá…).
            </p>
          </div>
        </div>
      </div>

      <div className="border-border bg-card rounded-xl border p-5">
        <ClusteringDataset courseSlug={slug} />
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Lưu ý chuẩn bị dữ liệu: các cột điểm đã chuẩn hoá về [0,1]; cờ <code>has_*</code> phân biệt
        “chưa làm” với “0 điểm”. Trước khi chạy K-Means nên chuẩn hoá z-score toàn bộ cột số, xử lý
        giá trị thiếu và loại bỏ cột định danh (Mã HS, Họ tên, Email).
      </p>
    </div>
  );
}
