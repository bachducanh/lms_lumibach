import { CreateUserForm } from '@/components/features/users/CreateUserForm';

export default function CreateUserPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tạo tài khoản mới</h1>
        <p className="text-muted-foreground text-sm">Thêm người dùng vào hệ thống</p>
      </div>
      <CreateUserForm />
    </div>
  );
}
