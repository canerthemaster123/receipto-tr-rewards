// Returns a safe, top-level SITE URL for redirects (never the Lovable id-preview iframe)
export function getSiteUrl() {
  // Prefer explicit env
  const envUrl =
    (import.meta as any).env?.VITE_SITE_URL ||
    (window as any).__SITE_URL__; // optional global

  const current = window.location.origin;

  // If we're in Lovable's preview, return the production URL
  const isPreview = current.includes('id-preview--') || current.includes('lovableproject.com');
  
  if (isPreview) {
    // If env is set, use that
    if (envUrl && envUrl.startsWith('http')) {
      return envUrl.replace(/\/+$/, '');
    }
    // Otherwise, use the known production URL for this project
    return 'https://receipto-tr-rewards.lovable.app';
  }

  // Use env URL if available and we're not in preview
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.replace(/\/+$/, '');
  }

  // Fallback to current origin in real deployments
  return current.replace(/\/+$/, '');
}