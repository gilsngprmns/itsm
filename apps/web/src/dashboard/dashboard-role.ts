export type DashboardRole = 'ADMIN' | 'AUDIT' | 'IT_SUPPORT' | 'USER'

export function dashboardRole(roles: string[] | undefined): DashboardRole {
  if (roles?.includes('ADMIN')) return 'ADMIN'
  if (roles?.includes('AUDIT')) return 'AUDIT'
  if (roles?.includes('IT_SUPPORT')) return 'IT_SUPPORT'
  return 'USER'
}
