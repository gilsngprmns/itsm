export interface AuthenticatedUser {
  id: string
  fullName: string
  email: string
  roles: string[]
  permissions: string[]
}

export interface LoginResult {
  token: string
  user: AuthenticatedUser
}
