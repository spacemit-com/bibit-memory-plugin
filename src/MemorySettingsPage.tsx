import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFeatureCapability, type FeatureSettingsProps } from '@bibit/feature-sdk'
import './memory.css'
import {
  DEFAULT_MEMORY_SETTINGS,
  MEMORY_OPS,
  parseBackupSupported,
  parseEmbeddingSection,
  parseImportDocument,
  parseMemorySettings,
  type MemorySettingsV1,
} from './memory-contracts'

type SettingPatch = Partial<MemorySettingsV1> & { embedding?: Record<string, unknown> }

/**
 * The page ships its own markup and stylesheet rather than the 0.3.0
 * feature-ui bundle, whose icon catalog expects a global `React` symbol and
 * blanks the surface under the automatic JSX runtime.  Visual parity with the
 * host settings pages comes from the design tokens in `memory.css`.
 *
 * Chinese is the source language; the host passes `language` and the table
 * below only overrides it for other locales.
 */
const EN_MESSAGES: Record<string, string> = {
  '记忆': 'Memory',
  '记忆设置': 'Memory settings',
  '数据管理': 'Data management',
  '本页设置与操作仅作用于 BiBit 应用自己的记忆数据。设备上其他智能体应用的记忆相互独立，不受本页影响。':
    'These settings and actions only apply to BiBit memory. Other agents on this device keep their own separate memory spaces.',
  '记忆功能': 'Memory',
  '关闭后 BiBit 不记忆对话历史和用户偏好。':
    'When off, BiBit stops remembering conversation history and preferences.',
  '语义记忆': 'Semantic recall',
  '开启后使用本地语义模型增强记忆检索，需要设备已安装 embedding 模型。':
    'Uses the local embedding model to improve recall. The model must be installed on this device.',
  '记忆保留时长': 'Retention',
  '可选 7天、30天、90天或永久。': 'Keep memory for 7, 30 or 90 days, or forever.',
  '7天': '7 days',
  '30天': '30 days',
  '90天': '90 days',
  '永久': 'Forever',
  '云端备份': 'Cloud backup',
  '开启后定期将记忆加密备份到进迭时空社区云端。':
    'Periodically store an encrypted memory backup in the Bianbu community cloud.',
  '自动备份频率': 'Backup frequency',
  '可选每天、每周、每月或手动。': 'Back up daily, weekly, monthly or only on demand.',
  '每天': 'Daily',
  '每周': 'Weekly',
  '每月': 'Monthly',
  '手动': 'Manual',
  '清除对话历史': 'Clear conversation history',
  '清除 BiBit 记忆中保存的对话记录与摘要，长期记忆（如你的偏好）会保留。':
    'Removes stored conversation records and summaries. Long-term memory such as your preferences is kept.',
  '清除所有记忆': 'Clear all memory',
  '永久删除 BiBit 应用记忆空间中的全部数据（对话记录、摘要、长期记忆与偏好）。':
    'Permanently deletes everything in the BiBit memory space: conversations, summaries, long-term memory and preferences.',
  '数据导出': 'Export data',
  '将 BiBit 应用记忆空间中的数据导出为 JSON 文件。不包含其他智能体应用的记忆，也不包含聊天对话原文。':
    'Exports BiBit memory as a JSON file. Other agents and the raw chat transcripts are not included.',
  '数据导入': 'Import data',
  '选择要导入的记忆数据文件': 'Choose a memory export file to import',
  '从之前导出的 JSON 文件恢复 BiBit 记忆。已存在的记忆会保留当前内容，同一文件可重复导入。':
    'Restores BiBit memory from a previously exported JSON file. Existing records keep their current content, and importing the same file twice is safe.',
  '正在读取导入文件...': 'Reading the import file...',
  '导入文件不是合法的 JSON': 'The selected file is not valid JSON.',
  '导入文件不是记忆导出文档': 'The selected file is not a memory export document.',
  '导入文件格式不受支持（需要 bianbu-agent-memory.export.v1）':
    'Unsupported import file format (expected bianbu-agent-memory.export.v1).',
  '已取消导入，记忆未更改。': 'Import cancelled; memory was not changed.',
  '正在导入记忆数据...': 'Importing memory...',
  '记忆数据已导入。': 'Memory was imported.',
  '导入完成，但没有新增记忆（记录都已存在）。':
    'Import finished, but nothing was added because those records already exist.',
  '导入失败，记忆未更改。': 'Import failed; memory was not changed.',
  '导入文件过大，未读取。': 'The selected file is too large to import.',
  '导入文件无法读取': 'The selected file could not be read.',
  '即将把该文件中的记忆合并到 BiBit 应用记忆空间。已存在的记录保留当前内容，导入不会删除任何记忆。\n\n注意：仅影响 BiBit 应用自己的记忆，设备上其他智能体应用的记忆不受影响。':
    'This merges the memories in this file into BiBit memory. Existing records keep their current content and nothing is deleted.\n\nOnly BiBit memory is affected; other agents keep their own memory.',
  '正在加载记忆设置...': 'Loading memory settings...',
  '正在检查记忆服务': 'Checking the memory service',
  '记忆服务运行中': 'Memory service is running',
  '记忆服务不可用': 'Memory service is unavailable',
  '记忆服务未授权': 'Memory service not authorized',
  '重试': 'Retry',
  '记忆服务（bianbu-agent-memory）未响应，设置已暂时禁用。':
    'The memory service (bianbu-agent-memory) is not responding, so these settings are disabled.',
  '当前插件未获得 service:memory 能力，设置已暂时禁用。':
    'This plugin was not granted service:memory, so these settings are disabled.',
  '记忆设置已加载。': 'Memory settings loaded.',
  '无法加载记忆设置。': 'Could not load memory settings.',
  '正在保存记忆设置...': 'Saving memory settings...',
  '记忆设置已保存。': 'Memory settings saved.',
  '无法保存记忆设置，已恢复原有值。':
    'Could not save memory settings. The previous values were restored.',
  '正在请求记忆服务...': 'Contacting the memory service...',
  '记忆服务拒绝了该操作，数据未更改。':
    'The memory service rejected the action. Nothing was changed.',
  'BiBit 应用记忆已全部清除。': 'All BiBit memory was cleared.',
  'BiBit 对话历史已清除，长期记忆已保留。':
    'BiBit conversation history was cleared and long-term memory was kept.',
  'BiBit 记忆数据 JSON 已导出到系统「下载」目录（bianbu-agent-memory-export.json）。':
    'BiBit memory was exported to the system Downloads folder as bianbu-agent-memory-export.json.',
  'BiBit 记忆数据 JSON 已导出到你选择的位置。':
    'BiBit memory was exported where you chose.',
  '已取消导出，未写入文件。': 'Export cancelled; nothing was written.',
  '导出失败，未写入文件。': 'Export failed; nothing was written.',
  '即将永久删除 BiBit 应用记忆空间中的全部记忆（长期记忆、偏好、对话记录与摘要），此操作不可恢复。\n\n注意：仅删除 BiBit 应用自己的记忆，设备上其他智能体应用的记忆不受影响；聊天窗口中的对话原文不会被删除。':
    'This permanently deletes all BiBit memory: long-term memory, preferences, conversation records and summaries. It cannot be undone.\n\nOnly BiBit memory is affected. Other agents keep their memory, and the raw chat transcript is not deleted.',
  '即将清除 BiBit 应用记忆中的对话记录与摘要，此操作不可恢复。\n\n注意：聊天窗口中的对话原文由对话应用单独保存，不会被清除；设备上其他智能体应用的记忆也不受影响。':
    'This clears the conversation records and summaries stored in BiBit memory. It cannot be undone.\n\nThe raw chat transcript is owned by the chat app and is not cleared; other agents keep their memory.',
}

// 服务状态靠主动探测（读一次设置）来判定，而不是靠插件是否拿到 capability：
// capability 只说明授权，不说明 bianbu-agent-memory 真的活着。
export const SERVICE_POLL_MS = 15000
export const EXPORT_FILE_NAME = 'bianbu-agent-memory-export.json'

// SDK 0.3.0 的 file:transfer 只声明了 select；publish 是宿主新增的能力，
// 旧宿主仍会授予该能力但没有这个方法。这里用一次收窄把「有没有 publish」
// 的运行时探测收敛在一处；下次 SDK 交付带上 publish 后删除这段桥。
type FileTransferPublish = (input: {
  version: 1
  grantId: string
  serviceId: string
  operationId: string
  content: Uint8Array
}) => Promise<void>

const fileTransferPublish = (
  transfer: unknown
): FileTransferPublish | undefined => {
  const candidate = (transfer as { publish?: unknown } | undefined)?.publish
  return typeof candidate === 'function'
    ? (candidate as FileTransferPublish)
    : undefined
}

// 导入方向还没有宿主级读取契约（SDK 0.3.0 只声明 select），所以文件由页面
// 自己的 <input type="file"> 读取。上限与 memoryd 单帧预算一致，超限在本地
// 就报错，不把读不完的文件送进服务。
const IMPORT_MAX_BYTES = 4 * 1024 * 1024

/**
 * 读取用户选中的导入文件。优先用 Blob.text()；WebView 或旧运行时不提供时
 * 回退到 FileReader，两者都以 UTF-8 解码导出文件。
 */
function readImportFile(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('导入文件无法读取'))
    reader.readAsText(file, 'utf-8')
  })
}

type ServiceState = 'checking' | 'available' | 'unavailable' | 'unauthorized'

const SERVICE_LABELS: Record<ServiceState, string> = {
  checking: '正在检查记忆服务',
  available: '记忆服务运行中',
  unavailable: '记忆服务不可用',
  unauthorized: '记忆服务未授权',
}

const SERVICE_DETAILS: Partial<Record<ServiceState, string>> = {
  unavailable: '记忆服务（bianbu-agent-memory）未响应，设置已暂时禁用。',
  unauthorized: '当前插件未获得 service:memory 能力，设置已暂时禁用。',
}

export function memoryMessages(language?: string): Record<string, string> {
  return language && !language.toLowerCase().startsWith('zh') ? EN_MESSAGES : {}
}

// The host passes `language`, but the vendored 0.3.0 SDK types predate that
// field. Drop the intersection once the SDK is re-vendored.
type MemoryPageProps = FeatureSettingsProps & { language?: string }

function SettingRow({
  controlId,
  title,
  description,
  children,
}: {
  controlId?: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="memory-settings__row">
      <span className="memory-settings__row-text">
        {controlId ? (
          <label className="memory-settings__row-title" htmlFor={controlId}>
            {title}
          </label>
        ) : (
          <span className="memory-settings__row-title">{title}</span>
        )}
        <small className="memory-settings__row-description">{description}</small>
      </span>
      <span className="memory-settings__row-control">{children}</span>
    </div>
  )
}

/**
 * 记忆服务状态条。capability 只代表授权，服务是否真的在跑得看探测结果，
 * 所以这里显示的是探测出来的状态，不可用时旁边给一次手动重试。
 */
function MemoryServiceStatus({
  state,
  onRetry,
  t,
}: {
  state: ServiceState
  onRetry: () => void
  t: (text: string) => string
}) {
  const detail = SERVICE_DETAILS[state]
  return (
    <div className="memory-settings__service">
      <div className="memory-settings__service-row">
        <div className="memory-settings__service-chip" data-state={state} role="status" aria-live="polite">
          <span className="memory-settings__service-dot" aria-hidden="true" />
          <span className="memory-settings__service-label">{t(SERVICE_LABELS[state])}</span>
        </div>
        {state === 'unavailable' && (
          <button
            className="memory-settings__button memory-settings__button--outline memory-settings__button--compact"
            type="button"
            onClick={onRetry}
          >
            {t('重试')}
          </button>
        )}
      </div>
      {detail && <p className="memory-settings__service-detail">{t(detail)}</p>}
    </div>
  )
}

export function MemorySettingsPage({ language }: MemoryPageProps) {
  const messages = useMemo(() => memoryMessages(language), [language])
  const t = useCallback((text: string) => messages[text] ?? text, [messages])
  const memory = useFeatureCapability('service:memory')
  const transfer = useFeatureCapability('file:transfer')
  const publishExport = fileTransferPublish(transfer)
  const [settings, setSettings] = useState<MemorySettingsV1>(DEFAULT_MEMORY_SETTINGS)
  const [embeddingSection, setEmbeddingSection] = useState<Record<string, unknown> | null>(null)
  const [backupSupported, setBackupSupported] = useState(false)
  const [status, setStatus] = useState(() => (memory ? t('正在加载记忆设置...') : ''))
  const [serviceStatus, setServiceStatus] = useState<ServiceState>('checking')
  const [saving, setSaving] = useState(false)
  const requestController = useRef<AbortController | null>(null)
  const probeController = useRef<AbortController | null>(null)
  const announcedLoad = useRef(false)
  const importInput = useRef<HTMLInputElement | null>(null)

  useEffect(() => () => {
    requestController.current?.abort()
    probeController.current?.abort()
  }, [])

  // 探测＝读一次设置：成功即服务可用，顺带把最新值刷进页面；失败即不可用。
  const probe = useCallback(async () => {
    if (!memory || probeController.current) return
    const controller = new AbortController()
    probeController.current = controller
    try {
      const response = await memory.request<unknown>({
        serviceId: 'memory',
        operationId: MEMORY_OPS.getSettings,
        params: {},
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      setSettings(parseMemorySettings(response))
      setEmbeddingSection(parseEmbeddingSection(response))
      setBackupSupported(parseBackupSupported(response))
      setServiceStatus('available')
      if (!announcedLoad.current) {
        announcedLoad.current = true
        setStatus(t('记忆设置已加载。'))
      }
    } catch {
      if (controller.signal.aborted) return
      setServiceStatus('unavailable')
      // 首次探测就失败时，页脚不能一直停在“正在加载”。
      if (!announcedLoad.current) setStatus(t('无法加载记忆设置。'))
    } finally {
      if (probeController.current === controller) probeController.current = null
    }
  }, [memory, t])

  // 挂载探测一次，之后每 15 秒复查（页面不可见时跳过，重新可见时立刻补一次），
  // 让服务掉线在用户看到界面前就被反映出来。
  useEffect(() => {
    if (!memory) return
    void probe()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void probe()
    }, SERVICE_POLL_MS)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void probe()
    }
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [memory, probe])

  const ready = serviceStatus === 'available'

  const persist = useCallback(async (patch: SettingPatch, previous: MemorySettingsV1) => {
    if (!memory || serviceStatus !== 'available' || requestController.current) return
    const controller = new AbortController()
    requestController.current = controller
    setSaving(true)
    setSettings((current) => ({ ...current, ...patch }))
    setStatus(t('正在保存记忆设置...'))
    try {
      const value = await memory.request<unknown>({
        serviceId: 'memory',
        operationId: MEMORY_OPS.updateSettings,
        params: patch as Record<string, unknown>,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      setSettings(parseMemorySettings(value))
      setEmbeddingSection(parseEmbeddingSection(value))
      setBackupSupported(parseBackupSupported(value))
      setStatus(t('记忆设置已保存。'))
    } catch {
      if (!controller.signal.aborted) {
        setSettings(previous)
        setStatus(t('无法保存记忆设置，已恢复原有值。'))
        void probe()
      }
    } finally {
      if (!controller.signal.aborted) setSaving(false)
      if (requestController.current === controller) requestController.current = null
    }
  }, [memory, probe, serviceStatus, t])

  const updateSetting = useCallback((patch: SettingPatch) => {
    void persist(patch, settings)
  }, [persist, settings])

  // 后端对 embedding 是整段替换语义，必须回传完整段，只翻转 enabled。
  const updateEmbeddingEnabled = useCallback((enabled: boolean) => {
    if (!embeddingSection) return
    void persist({ embedding: { ...embeddingSection, enabled } }, settings)
  }, [embeddingSection, persist, settings])

  const runPrivacyAction = useCallback(async (
    operationId: string,
    params: Record<string, unknown>,
    confirmMessage: string,
    successMessage: string,
  ) => {
    if (!memory || !ready || saving || requestController.current) return
    if (operationId !== MEMORY_OPS.exportData) {
      const confirmed = globalThis.confirm?.(confirmMessage)
      if (confirmed !== true) return
    }
    const controller = new AbortController()
    requestController.current = controller
    setSaving(true)
    setStatus(t('正在请求记忆服务...'))
    try {
      const result = await memory.request<unknown>({
        serviceId: 'memory',
        operationId,
        params,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      if (operationId === MEMORY_OPS.exportData) {
        const json = JSON.stringify(result, null, 2)
        if (transfer && publishExport) {
          // 用户自己选保存位置；字节交给宿主原子落盘，插件始终拿不到路径。
          const grant = await transfer.select({
            version: 1,
            serviceId: 'memory',
            operationId,
            direction: 'download',
            suggestedName: EXPORT_FILE_NAME,
          })
          if (controller.signal.aborted) return
          if (!grant) {
            setStatus(t('已取消导出，未写入文件。'))
            return
          }
          try {
            await publishExport({
              version: 1,
              grantId: grant.grantId,
              serviceId: 'memory',
              operationId,
              content: new TextEncoder().encode(json),
            })
          } catch {
            if (!controller.signal.aborted) {
              setStatus(t('导出失败，未写入文件。'))
            }
            return
          }
          if (controller.signal.aborted) return
          setStatus(t('BiBit 记忆数据 JSON 已导出到你选择的位置。'))
          return
        } else if (typeof document !== 'undefined') {
          // 旧宿主未提供 file:transfer 时的回退路径，落盘位置由下载目录决定。
          const blob = new Blob([json], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = EXPORT_FILE_NAME
          link.click()
          URL.revokeObjectURL(url)
        }
      }
      setStatus(t(successMessage))
    } catch {
      if (!controller.signal.aborted) {
        setStatus(t('记忆服务拒绝了该操作，数据未更改。'))
        void probe()
      }
    } finally {
      if (!controller.signal.aborted) setSaving(false)
      if (requestController.current === controller) requestController.current = null
    }
  }, [memory, probe, publishExport, ready, saving, t, transfer])

  const importFile = useCallback(async (file: File) => {
    if (!memory || !ready || saving || requestController.current) return
    if (file.size > IMPORT_MAX_BYTES) {
      setStatus(t('导入文件过大，未读取。'))
      return
    }
    let document: Record<string, unknown>
    try {
      document = parseImportDocument(await readImportFile(file))
    } catch (error) {
      setStatus(t(error instanceof Error ? error.message : '导入文件不是记忆导出文档'))
      return
    }
    const confirmed = globalThis.confirm?.(t(
      '即将把该文件中的记忆合并到 BiBit 应用记忆空间。已存在的记录保留当前内容，导入不会删除任何记忆。\n\n注意：仅影响 BiBit 应用自己的记忆，设备上其他智能体应用的记忆不受影响。'
    ))
    if (confirmed !== true) {
      setStatus(t('已取消导入，记忆未更改。'))
      return
    }
    const controller = new AbortController()
    requestController.current = controller
    setSaving(true)
    setStatus(t('正在导入记忆数据...'))
    try {
      const result = await memory.request<{
        imported?: { session_events?: number, session_summaries?: number, long_term_memories?: number }
      }>({
        serviceId: 'memory',
        operationId: MEMORY_OPS.importData,
        params: { payload: document },
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      const imported = result?.imported ?? {}
      const total = (imported.session_events ?? 0)
        + (imported.session_summaries ?? 0)
        + (imported.long_term_memories ?? 0)
      setStatus(t(total > 0
        ? '记忆数据已导入。'
        : '导入完成，但没有新增记忆（记录都已存在）。'))
    } catch {
      if (!controller.signal.aborted) {
        setStatus(t('导入失败，记忆未更改。'))
        void probe()
      }
    } finally {
      if (!controller.signal.aborted) setSaving(false)
      if (requestController.current === controller) requestController.current = null
    }
  }, [memory, probe, ready, saving, t])

  const disabled = !ready || saving
  const serviceState: ServiceState = memory ? serviceStatus : 'unauthorized'

  return (
    <div className="memory-settings">
      <header className="memory-settings__intro">
        <h1 className="memory-settings__title">{t('记忆')}</h1>
        {/* 作用域明示：本页只管 BiBit 应用自己的记忆空间，其他 Agent 各有独立空间。 */}
        <p className="memory-settings__scope">
          {t('本页设置与操作仅作用于 BiBit 应用自己的记忆数据。设备上其他智能体应用的记忆相互独立，不受本页影响。')}
        </p>
      </header>
      <MemoryServiceStatus state={serviceState} onRetry={() => void probe()} t={t} />
<section className="memory-settings__card">
        <h2 className="memory-settings__card-title">{t('数据管理')}</h2>
        <SettingRow
          title={t('清除对话历史')}
          description={t('清除 BiBit 记忆中保存的对话记录与摘要，长期记忆（如你的偏好）会保留。')}
        >
          <button
            className="memory-settings__button memory-settings__button--outline"
            type="button"
            disabled={disabled}
            onClick={() => void runPrivacyAction(
              MEMORY_OPS.clearHistory,
              { reason_code: 'user_request' },
              t('即将清除 BiBit 应用记忆中的对话记录与摘要，此操作不可恢复。\n\n注意：聊天窗口中的对话原文由对话应用单独保存，不会被清除；设备上其他智能体应用的记忆也不受影响。'),
              'BiBit 对话历史已清除，长期记忆已保留。',
            )}
          >
            {t('清除对话历史')}
          </button>
        </SettingRow>
        <SettingRow
          title={t('清除所有记忆')}
          description={t('永久删除 BiBit 应用记忆空间中的全部数据（对话记录、摘要、长期记忆与偏好）。')}
        >
          <button
            className="memory-settings__button memory-settings__button--danger"
            type="button"
            disabled={disabled}
            onClick={() => void runPrivacyAction(
              MEMORY_OPS.clearAll,
              { reason_code: 'user_request' },
              t('即将永久删除 BiBit 应用记忆空间中的全部记忆（长期记忆、偏好、对话记录与摘要），此操作不可恢复。\n\n注意：仅删除 BiBit 应用自己的记忆，设备上其他智能体应用的记忆不受影响；聊天窗口中的对话原文不会被删除。'),
              'BiBit 应用记忆已全部清除。',
            )}
          >
            {t('清除所有记忆')}
          </button>
        </SettingRow>
        <SettingRow
          title={t('数据导出')}
          description={t('将 BiBit 应用记忆空间中的数据导出为 JSON 文件。不包含其他智能体应用的记忆，也不包含聊天对话原文。')}
        >
          <button
            className="memory-settings__button memory-settings__button--outline"
            type="button"
            disabled={disabled}
            onClick={() => void runPrivacyAction(
              MEMORY_OPS.exportData,
              { limit_per_collection: 500, include_audit: false },
              '',
              'BiBit 记忆数据 JSON 已导出到系统「下载」目录（bianbu-agent-memory-export.json）。',
            )}
          >
            {t('数据导出')}
          </button>
        </SettingRow>
        <SettingRow
          title={t('数据导入')}
          description={t('从之前导出的 JSON 文件恢复 BiBit 记忆。已存在的记忆会保留当前内容，同一文件可重复导入。')}
        >
          <button
            className="memory-settings__button memory-settings__button--outline"
            type="button"
            disabled={disabled}
            onClick={() => importInput.current?.click()}
          >
            {t('数据导入')}
          </button>
          <input
            ref={importInput}
            type="file"
            accept="application/json,.json"
            aria-label={t('选择要导入的记忆数据文件')}
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              // 允许再次选择同一个文件：清空值后 change 才会重新触发。
              event.currentTarget.value = ''
              if (file) void importFile(file)
            }}
          />
        </SettingRow>
      </section>      <section className="memory-settings__card">
        <h2 className="memory-settings__card-title">{t('记忆设置')}</h2>
        <SettingRow
          controlId="memory-enabled"
          title={t('记忆功能')}
          description={t('关闭后 BiBit 不记忆对话历史和用户偏好。')}
        >
          <input
            id="memory-enabled"
            className="memory-settings__switch"
            aria-label={t('记忆功能')}
            role="switch"
            type="checkbox"
            checked={settings.memory_enabled}
            disabled={disabled}
            onChange={(event) => updateSetting({ memory_enabled: event.target.checked })}
          />
        </SettingRow>
        {embeddingSection !== null && (
          <SettingRow
            controlId="memory-embedding"
            title={t('语义记忆')}
            description={t('开启后使用本地语义模型增强记忆检索，需要设备已安装 embedding 模型。')}
          >
            <input
              id="memory-embedding"
              className="memory-settings__switch"
              aria-label={t('语义记忆')}
              role="switch"
              type="checkbox"
              checked={settings.embedding_enabled}
              disabled={disabled}
              onChange={(event) => updateEmbeddingEnabled(event.target.checked)}
            />
          </SettingRow>
        )}
        <SettingRow
          controlId="retention-days"
          title={t('记忆保留时长')}
          description={t('可选 7天、30天、90天或永久。')}
        >
          <select
            id="retention-days"
            className="memory-settings__select"
            aria-label={t('记忆保留时长')}
            value={settings.retention_days}
            disabled={disabled}
            onChange={(event) => updateSetting({ retention_days: Number(event.target.value) as MemorySettingsV1['retention_days'] })}
          >
            <option value={7}>{t('7天')}</option>
            <option value={30}>{t('30天')}</option>
            <option value={90}>{t('90天')}</option>
            <option value={0}>{t('永久')}</option>
          </select>
        </SettingRow>
        {/* 云端备份尚未接入（无云端适配器 + 本地账户），后端信号
            backup_supported/identity.cloud_upload_allowed 双真时才显示。 */}
        {backupSupported && (
          <>
            <SettingRow
              controlId="backup-enabled"
              title={t('云端备份')}
              description={t('开启后定期将记忆加密备份到进迭时空社区云端。')}
            >
              <input
                id="backup-enabled"
                className="memory-settings__switch"
                aria-label={t('云端备份')}
                role="switch"
                type="checkbox"
                checked={settings.backup_enabled}
                disabled={disabled}
                onChange={(event) => updateSetting({ backup_enabled: event.target.checked })}
              />
            </SettingRow>
            <SettingRow
              controlId="backup-frequency"
              title={t('自动备份频率')}
              description={t('可选每天、每周、每月或手动。')}
            >
              <select
                id="backup-frequency"
                className="memory-settings__select"
                aria-label={t('自动备份频率')}
                value={settings.backup_frequency}
                disabled={disabled}
                onChange={(event) => updateSetting({ backup_frequency: event.target.value as MemorySettingsV1['backup_frequency'] })}
              >
                <option value="daily">{t('每天')}</option>
                <option value="weekly">{t('每周')}</option>
                <option value="monthly">{t('每月')}</option>
                <option value="manual">{t('手动')}</option>
              </select>
            </SettingRow>
          </>
        )}
      </section>
      <p className="memory-settings__status" role="status" aria-live="polite">{status}</p>
    </div>
  )
}
