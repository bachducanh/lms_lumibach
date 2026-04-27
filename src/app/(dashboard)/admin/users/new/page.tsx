import { CreateUserForm } from '@/components/features/users/CreateUserForm';

export default function CreateUserPage() {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tạo tài khoản mới</h1>
        <p className="text-sm text-muted-foreground">Thêm người dùng vào hệ thống</p>
      </div>
      <CreateUserForm />
    </div>
  );
}
