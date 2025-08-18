// Returns a safe, top-level SITE URL for redirects (never the Lovable id-preview iframe)
export function getSiteUrl() {
  // Prefer explicit env
  const envUrl =
    (import.meta as any).env?.VITE_SITE_URL ||
    (window as any).__SITE_URL__; // optional global

  const current = window.location.origin;

  // If we're in Lovable's id-preview iframe or a non-https localhost, use envUrl if present
  const isPreview = current.includes('id-preview--') || current.includes('lovableproject.com');
  if (envUrl && (isPreview || envUrl.startsWith('http'))) return envUrl.replace(/\/+$/, '');

  // Fallback to current origin in real deployments
  return current.replace(/\/+$/, '');
}