import { useEffect } from 'react';
import { getSiteUrl } from '@/lib/siteUrl';

export default function LeavePreview() {
  useEffect(() => {
    const site = getSiteUrl();
    if (window.top && window.top !== window.self) {
      (window.top as Window).location.href = site;
    } else {
      // If already top-level for some reason, go home
      window.location.href = site;
    }
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse text-lg font-medium">Yönlendiriliyorsunuz…</div>
        <div className="mt-2 text-sm text-muted-foreground">Lütfen bekleyin.</div>
      </div>
    </div>
  );
}