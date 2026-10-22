export interface ReportCount {
  name: string
  count: number
}

export interface TicketReport {
  totalCreated: number
  byStatus: ReportCount[]
  byPriority: ReportCount[]
  byCategory: ReportCount[]
  resolvedInPeriod: number
  trend: Array<{ date: string; count: number }>
}

export interface AssetReport {
  total: number
  byStatus: ReportCount[]
  byCategory: ReportCount[]
  byLocation?: ReportCount[]
}

export interface ActivityItem {
  id: string
  action: string
  entityType: string
  entityId: string | null
  createdAt: string
  actor: { id: string; fullName: string } | null
}

export interface OperationalOverview {
  period: { startDate: string; endDate: string }
  tickets: TicketReport
  assets: AssetReport
  recentActivity: ActivityItem[]
}

export interface TicketRecord {
  id: string
  ticketNumber: string
  subject: string
  status: string
  priority: string
  createdAt: string
  updatedAt: string
}

export interface TicketListResult {
  items: TicketRecord[]
  total: number
}

export interface AssignedAssetRecord {
  id: string
  assetTag: string
  name: string
  status: string
  category: { name: string }
}

export interface AssetListResult {
  items: AssignedAssetRecord[]
  total: number
}

export type AuditLogRecord = ActivityItem

export interface AuditListResult {
  items: AuditLogRecord[]
  page: number
  limit: number
  total: number
}
