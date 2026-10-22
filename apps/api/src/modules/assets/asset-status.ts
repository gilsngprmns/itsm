export const ASSET_STATUSES = [
  'AVAILABLE',
  'ASSIGNED',
  'IN_REPAIR',
  'DAMAGED',
  'LOST',
  'RETIRED',
  'DISPOSED',
] as const

export type AssetStatus = (typeof ASSET_STATUSES)[number]

export const ASSET_STATUS_TRANSITIONS: Record<
  AssetStatus,
  readonly AssetStatus[]
> = {
  AVAILABLE: ['IN_REPAIR', 'DAMAGED', 'LOST', 'RETIRED', 'DISPOSED'],
  ASSIGNED: [],
  IN_REPAIR: ['AVAILABLE', 'DAMAGED', 'RETIRED', 'DISPOSED'],
  DAMAGED: ['AVAILABLE', 'IN_REPAIR', 'RETIRED', 'DISPOSED'],
  LOST: ['AVAILABLE', 'RETIRED', 'DISPOSED'],
  RETIRED: ['DISPOSED'],
  DISPOSED: [],
}
