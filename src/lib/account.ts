export function isSuperAdmin(email: string | null | undefined): boolean {
  return !!email && email === process.env.SUPER_ADMIN_EMAIL;
}

export function isDemoAccount(email: string | null | undefined): boolean {
  return !!email && email === process.env.DEMO_ACCOUNT_EMAIL;
}

export function hasFreeAccess(email: string | null | undefined): boolean {
  return isSuperAdmin(email) || isDemoAccount(email);
}
