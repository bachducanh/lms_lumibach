import Image from 'next/image';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <Image
        src="/LumiBach_secondlogo.png"
        alt="LumiBach"
        width={220}
        height={71}
        priority
        className="drop-shadow-sm"
        style={{ height: 'auto' }}
      />
      {children}
    </div>
  );
}
