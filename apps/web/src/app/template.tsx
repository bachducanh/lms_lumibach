// app/template.tsx — re-renders on every navigation, so the entrance
// animation runs fresh each time the user moves between routes
// (App Router pattern). It also re-mounts ScrollRevealProvider so
// new pages get their .lb-reveal elements wired up automatically.

import { ScrollRevealProvider } from '@/components/features/landing/ScrollRevealProvider';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="lb-page-enter">
      <ScrollRevealProvider />
      {children}
    </div>
  );
}
