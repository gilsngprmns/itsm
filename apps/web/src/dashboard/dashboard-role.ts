export type DashboardRole = 'ADMIN' | 'AUDIT' | 'IT_SUPPORT' | 'USER'

export function dashboardRole(
  roles: string[] | undefined,
  permissions: string[] = [],
): DashboardRole {
  if (
    roles?.includes('AUDIT') ||
    roles?.includes('ADMIN')
  ) {
    return roles?.includes('AUDIT') && !roles.includes('ADMIN') ? 'AUDIT' : 'ADMIN'
  }
  if (
    permissions.includes('users.read') ||
    permissions.includes('settings.manage')
  ) {
    return 'ADMIN'
  }
  if (
    permissions.includes('audit.read') ||
    permissions.includes('reports.read')
  ) {
    return 'AUDIT'
  }
  if (
    roles?.includes('IT_SUPPORT') ||
    permissions.includes('tickets.read.all') ||
    permissions.includes('tickets.assign')
  ) {
    return 'IT_SUPPORT'
  }
  return 'USER'
}
