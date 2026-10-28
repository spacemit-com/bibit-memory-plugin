export const MEMORY_OPS = {
  getSettings: 'privacy.settings.get',
  updateSettings: 'privacy.settings.update',
  clearHistory: 'privacy.clear_history',
  clearAll: 'privacy.clear_all',
  exportData: 'privacy.export_data',
  importData: 'privacy.import_data',
} as const

/** 导出文件的格式标识；导入只接受这一种文档。 */
export const EXPORT_FORMAT = 'bianbu-agent-memory.export.v1'

export interface ImportResultV1 {
  imported: {
    session_events: number
    session_summaries: number
    long_term_memories: number
  }
  skipped: {
    session_events: number
    session_summaries: number
    long_term_memories: number
  }
}

/**
 * 校验一个待导入文件的内容。只做结构与格式检查，不解释业务字段：
 * 语义校验由 memory 侧负责，页面提前拒绝可以给出更准确的提示。
 */
export function parseImportDocument(text: string): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('导入文件不是合法的 JSON')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('导入文件不是记忆导出文档')
  }
  const document = value as Record<string, unknown>
  if (document.format !== EXPORT_FORMAT) {
    throw new Error(`导入文件格式不受支持（需要 ${EXPORT_FORMAT}）`)
  }
  return document
}

/** daemon settings.get 响应里的 embedding 配置段（原样透传，字段由 Memory 后端定义）。 */
export type EmbeddingSection = Record<string, unknown>

export interface MemorySettingsV1 {
  memory_enabled: boolean
  retention_days: 0 | 7 | 30 | 90
  embedding_enabled: boolean
}

export const DEFAULT_MEMORY_SETTINGS: MemorySettingsV1 = {
  memory_enabled: true,
  retention_days: 0,
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

export function parseMemorySettings(value: unknown): MemorySettingsV1 {
  if (!value || typeof value !== 'object') throw new Error('Invalid memory settings response')
  const candidate = value as Partial<MemorySettingsV1>
  const retention = candidate.retention_days
  if (retention !== undefined && ![0, 7, 30, 90].includes(retention)) {
    throw new Error('Invalid retention_days in memory settings response')
  }
  const booleanFields: Array<keyof Pick<MemorySettingsV1, 'memory_enabled'>> = [
    'memory_enabled',
  ]
  for (const field of booleanFields) {
    if (candidate[field] !== undefined && typeof candidate[field] !== 'boolean') {
      throw new Error(`Invalid ${field} in memory settings response`)
    }
  }
  return {
    memory_enabled: candidate.memory_enabled ?? DEFAULT_MEMORY_SETTINGS.memory_enabled,
    retention_days: retention ?? DEFAULT_MEMORY_SETTINGS.retention_days,
    embedding_enabled: parseEmbeddingSection(value)?.enabled === true,
  }
}
