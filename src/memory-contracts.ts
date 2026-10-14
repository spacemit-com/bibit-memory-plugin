export const MEMORY_OPS = {
  getSettings: 'privacy.settings.get',
  updateSettings: 'privacy.settings.update',
  clearHistory: 'privacy.clear_history',
  clearAll: 'privacy.clear_all',
  exportData: 'privacy.export_data',
} as const

/** daemon settings.get 响应里的 embedding 配置段（原样透传，字段由 Memory 后端定义）。 */
export type EmbeddingSection = Record<string, unknown>

export interface MemorySettingsV1 {
  memory_enabled: boolean
  retention_days: 0 | 7 | 30 | 90
  backup_enabled: boolean
  backup_frequency: 'manual' | 'daily' | 'weekly' | 'monthly'
  embedding_enabled: boolean
}

export const DEFAULT_MEMORY_SETTINGS: MemorySettingsV1 = {
  memory_enabled: true,
  retention_days: 0,
  backup_enabled: false,
  backup_frequency: 'weekly',
  embedding_enabled: false,
}

/**
 * 提取响应中的 embedding 配置段。段缺失（老版本 Memory 后端）时返回 null，
 * 页面据此隐藏「语义记忆」开关；保存时必须整段回传（后端为整段替换语义）。
 */
export function parseEmbeddingSection(value: unknown): EmbeddingSection | null {
  if (!value || typeof value !== 'object') return null
  const section = (value as { embedding?: unknown }).embedding
  if (!section || typeof section !== 'object' || Array.isArray(section)) return null
  return section as EmbeddingSection
}

/**
 * 云端备份能力检测：后端须同时声明已装配云备份适配器（backup_supported，
 * memoryd 以 --backup-base-url 等参数启动时才为 true）且当前账户允许上传
 * （identity.cloud_upload_allowed，本地 default/local 账户为 false）。
 * 任一缺失或为假（老版本后端、本地账户）时返回 false，页面据此隐藏
 * 「云端备份」开关与「自动备份频率」下拉，避免暴露不可用的控件。
 */
export function parseBackupSupported(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const record = value as { backup_supported?: unknown, identity?: unknown }
  if (record.backup_supported !== true) return false
  if (!record.identity || typeof record.identity !== 'object') return false
  const identity = record.identity as { cloud_upload_allowed?: unknown }
  return identity.cloud_upload_allowed === true
}

export function parseMemorySettings(value: unknown): MemorySettingsV1 {
  if (!value || typeof value !== 'object') throw new Error('Invalid memory settings response')
  const candidate = value as Partial<MemorySettingsV1>
  const retention = candidate.retention_days
  if (retention !== undefined && ![0, 7, 30, 90].includes(retention)) {
    throw new Error('Invalid retention_days in memory settings response')
  }
  if (candidate.backup_frequency !== undefined
    && !['manual', 'daily', 'weekly', 'monthly'].includes(candidate.backup_frequency)) {
    throw new Error('Invalid backup_frequency in memory settings response')
  }
  const booleanFields: Array<keyof Pick<MemorySettingsV1,
    | 'memory_enabled'
    | 'backup_enabled'>> = [
    'memory_enabled',
    'backup_enabled',
  ]
  for (const field of booleanFields) {
    if (candidate[field] !== undefined && typeof candidate[field] !== 'boolean') {
      throw new Error(`Invalid ${field} in memory settings response`)
    }
  }
  return {
    memory_enabled: candidate.memory_enabled ?? DEFAULT_MEMORY_SETTINGS.memory_enabled,
    retention_days: retention ?? DEFAULT_MEMORY_SETTINGS.retention_days,
    backup_enabled: candidate.backup_enabled ?? DEFAULT_MEMORY_SETTINGS.backup_enabled,
    backup_frequency: candidate.backup_frequency ?? DEFAULT_MEMORY_SETTINGS.backup_frequency,
    embedding_enabled: parseEmbeddingSection(value)?.enabled === true,
  }
}
