import { ImportUsersForm } from '@/components/features/users/ImportUsersForm';

export default function ImportUsersPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import người dùng từ Excel</h1>
        <p className="text-sm text-muted-foreground">
          Tải lên file .xlsx với các cột: <strong>Họ tên</strong>, <strong>Email</strong>,
          Tên đăng nhập (tuỳ chọn), Vai trò (tuỳ chọn)
        </p>
      </div>
      <ImportUsersForm />
    </div>
  );
}
