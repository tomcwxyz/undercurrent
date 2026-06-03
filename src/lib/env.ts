export function getBaseUrl(): string {
  // NextAuth v5 uses AUTH_URL; keep NEXTAUTH_URL for back-compat. On Vercel,
  // VERCEL_PROJECT_PRODUCTION_URL gives the canonical production domain when
  // neither is set explicitly. Localhost is the local-dev fallback only.
  if (process.env.AUTH_URL) return process.env.AUTH_URL;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}
