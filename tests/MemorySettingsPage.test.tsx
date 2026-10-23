import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FeatureHostApiProvider, type FeatureHostApiV1 } from '@bibit/feature-sdk'
import { MemorySettingsPage, SERVICE_POLL_MS } from '../src/MemorySettingsPage'

function renderPage(capability?: 'service:memory') {
  const hostApi: FeatureHostApiV1 = {
    sdkApiVersion: 1,
    featureId: 'memory',
    grantedCapabilities: capability ? [capability] : [],
    getCapability: () => undefined,
  }
  render(
    <FeatureHostApiProvider value={hostApi}>
      <MemorySettingsPage featureId="memory" contributionId="manager" subpath="" search={{}} navigation={{ push() {}, replace() {}, back() {} }} />
    </FeatureHostApiProvider>
  )
}

type FileTransferStub = {
  select: (input: Record<string, unknown>) => Promise<unknown>
  publish?: (input: Record<string, unknown>) => Promise<unknown>
}

function renderWithMemoryService(
  cloudOverrides?: Record<string, unknown>,
  fileTransfer?: FileTransferStub
) {
  const failures = { value: false }
  const importedPayloads: Array<Record<string, unknown>> = []
  let settings: Record<string, unknown> = {
    memory_enabled: true,
    retention_days: 0 as const,
    backup_enabled: false,
    backup_frequency: 'weekly' as const,
    preference_auto_apply_enabled: true,
    development_habit_auto_apply_enabled: true,
    recent_turn_limit: 5,
    summary_interval_turns: 5,
    summary_retention_days: 7,
    timezone: 'Asia/Shanghai',
    local_device_id: 'k3-development',
    embedding: {
      enabled: true,
      base_url: 'http://127.0.0.1:18801/v1',
      model: 'qwen3-embedding-0.6b',
      dims: 1024,
      format: 'int8',
      batch_size: 32,
      max_latency_ms: 1500,
      index_timeout_ms: 10000,
      query_instruct: 'Instruct: retrieve relevant memories\nQuery: ',
    },
    ...(cloudOverrides ?? {}),
  }
  const request = vi.fn(async ({ operationId, params }: { operationId: string; params: Record<string, unknown> }) => {
    if (failures.value) throw new Error('memory service is down')
    if (operationId === 'privacy.settings.get') return settings
    if (operationId === 'privacy.clear_history') {
      return { cleared_at: 1, deleted: { session_events: 2, session_summaries: 1 }, long_term_preferences_retained: true }
    }
    if (operationId === 'privacy.clear_all') {
      return { cleared_at: 1, deleted: { session_events: 2, session_summaries: 1, long_term_memories: 3, instructions: 0 } }
    }
    if (operationId === 'privacy.export_data') {
      return { format: 'bianbu-agent-memory.export.v1', exported_at: 1, settings }
    }
    if (operationId === 'privacy.import_data') {
      importedPayloads.push(params)
      return {
        imported_at: 2,
        format: 'bianbu-agent-memory.export.v1',
        imported: { session_events: 1, session_summaries: 1, long_term_memories: 2 },
        skipped: { session_events: 0, session_summaries: 0, long_term_memories: 0 },
      }
    }
    settings = { ...settings, ...(params as Partial<typeof settings>) }
    return settings
  })
  const capability = { request } as never
  const hostApi: FeatureHostApiV1 = {
    sdkApiVersion: 1,
    featureId: 'memory',
    grantedCapabilities: fileTransfer
      ? ['service:memory', 'file:transfer']
      : ['service:memory'],
    getCapability: (name: string) =>
      name === 'file:transfer' ? (fileTransfer as never) : capability,
  }
  render(
    <FeatureHostApiProvider value={hostApi}>
      <MemorySettingsPage featureId="memory" contributionId="manager" subpath="" search={{}} navigation={{ push() {}, replace() {}, back() {} }} />
    </FeatureHostApiProvider>
  )
  return { request, failures, importedPayloads }
}

describe('MemorySettingsPage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })
  it('reports a missing capability as unauthorized instead of a service outage', async () => {
    renderPage()
    expect(await screen.findByText('记忆服务未授权')).toBeTruthy()
    expect(screen.getByText('当前插件未获得 service:memory 能力，设置已暂时禁用。')).toBeTruthy()
    expect((screen.getByRole('switch', { name: '记忆功能' }) as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: '重试' })).toBeNull()
  })

  it('renders the English copy when the host language is not Chinese', async () => {
    render(
      <FeatureHostApiProvider value={{
        sdkApiVersion: 1,
        featureId: 'memory',
        grantedCapabilities: [],
        getCapability: () => undefined,
      }}>
        <MemorySettingsPage
          featureId="memory"
          contributionId="manager"
          subpath=""
          search={{}}
          navigation={{ push() {}, replace() {}, back() {} }}
          language="en-US"
        />
      </FeatureHostApiProvider>
    )
    expect(await screen.findByText('Memory service not authorized')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Clear all memory' })).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Memory' })).toBeTruthy()
  })

  it('loads settings and writes a changed switch directly to service:memory', async () => {
    const { request } = renderWithMemoryService()
    const memorySwitch = await screen.findByRole('switch', { name: '记忆功能' })
    await screen.findByText('记忆设置已加载。')
    expect((memorySwitch as HTMLInputElement).checked).toBe(true)

    fireEvent.click(memorySwitch)

    await waitFor(() => {
      expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
        serviceId: 'memory',
        operationId: 'privacy.settings.update',
        params: { memory_enabled: false },
      }))
    })
    expect(await screen.findByText('记忆设置已保存。')).toBeTruthy()
  })

  it('routes clear-history, clear-all, and export actions through the Memory service', async () => {
    const { request } = renderWithMemoryService()
    const confirmMock = vi.fn(() => true)
    vi.stubGlobal('confirm', confirmMock)
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:memory-export'),
      revokeObjectURL: vi.fn(),
    })
    await screen.findByText('记忆设置已加载。')

    fireEvent.click(screen.getByRole('button', { name: '清除对话历史' }))
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      operationId: 'privacy.clear_history',
      params: { reason_code: 'user_request' },
    })))
    // 确认弹窗必须明示作用域：不含其他智能体的记忆、不删对话原文。
    expect(confirmMock).toHaveBeenLastCalledWith(expect.stringContaining('聊天窗口中的对话原文由对话应用单独保存，不会被清除'))
    expect(confirmMock).toHaveBeenLastCalledWith(expect.stringContaining('其他智能体应用的记忆也不受影响'))

    fireEvent.click(screen.getByRole('button', { name: '清除所有记忆' }))
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      operationId: 'privacy.clear_all',
      params: { reason_code: 'user_request' },
    })))
    expect(confirmMock).toHaveBeenLastCalledWith(expect.stringContaining('仅删除 BiBit 应用自己的记忆，设备上其他智能体应用的记忆不受影响'))
    expect(confirmMock).toHaveBeenLastCalledWith(expect.stringContaining('此操作不可恢复'))

    fireEvent.click(screen.getByRole('button', { name: '数据导出' }))
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      operationId: 'privacy.export_data',
      params: { limit_per_collection: 500, include_audit: false },
    })))
    expect(anchorClick).toHaveBeenCalled()
    // 成功提示必须告知保存位置与文件名，否则用户不知道导出去哪了。
    expect(await screen.findByText('BiBit 记忆数据 JSON 已导出到系统「下载」目录（bianbu-agent-memory-export.json）。')).toBeTruthy()
  })

  it('sends no destructive request when the confirmation is dismissed', async () => {
    const { request } = renderWithMemoryService()
    vi.stubGlobal('confirm', vi.fn(() => false))
    await screen.findByText('记忆设置已加载。')

    fireEvent.click(screen.getByRole('button', { name: '清除所有记忆' }))
    fireEvent.click(screen.getByRole('button', { name: '清除对话历史' }))

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1)) // 仅初始 settings.get
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ operationId: 'privacy.clear_all' }))
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ operationId: 'privacy.clear_history' }))
  })

  it('writes the export through the native save grant when file transfer is granted', async () => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    const select = vi.fn(async () => ({
      version: 1,
      grantId: 'grant-1',
      direction: 'download',
      displayName: 'bianbu-agent-memory-export.json',
      expiresAt: new Date(0).toISOString(),
    }))
    const publish = vi.fn(
      async (_input: Record<string, unknown>) => undefined
    )
    renderWithMemoryService(undefined, { select, publish })
    await screen.findByText('记忆设置已加载。')

    fireEvent.click(screen.getByRole('button', { name: '数据导出' }))

    await waitFor(() =>
      expect(select).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'download',
          serviceId: 'memory',
          operationId: 'privacy.export_data',
          suggestedName: 'bianbu-agent-memory-export.json',
        })
      )
    )
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1))
    const published = publish.mock.calls[0]?.[0] as {
      grantId: string
      serviceId: string
      operationId: string
      content: Uint8Array
    }
    expect(published).toMatchObject({
      grantId: 'grant-1',
      serviceId: 'memory',
      operationId: 'privacy.export_data',
    })
    expect(new TextDecoder().decode(published.content)).toContain(
      'bianbu-agent-memory.export.v1'
    )
    expect(anchorClick).not.toHaveBeenCalled()
    expect(await screen.findByText('BiBit 记忆数据 JSON 已导出到你选择的位置。')).toBeTruthy()
  })

  it('reports a cancelled export without an error or a success claim', async () => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    const select = vi.fn(async () => null)
    const publish = vi.fn(async () => undefined)
    renderWithMemoryService(undefined, { select, publish })
    await screen.findByText('记忆设置已加载。')

    fireEvent.click(screen.getByRole('button', { name: '数据导出' }))

    expect(await screen.findByText('已取消导出，未写入文件。')).toBeTruthy()
    expect(publish).not.toHaveBeenCalled()
    expect(anchorClick).not.toHaveBeenCalled()
    expect(screen.queryByText('BiBit 记忆数据 JSON 已导出到你选择的位置。')).toBeNull()
  })

  it('surfaces a failed export write without claiming success', async () => {
    const select = vi.fn(async () => ({
      version: 1,
      grantId: 'grant-1',
      direction: 'download',
      displayName: 'bianbu-agent-memory-export.json',
      expiresAt: new Date(0).toISOString(),
    }))
    const publish = vi.fn(async () => {
      throw new Error('grant_already_consumed')
    })
    renderWithMemoryService(undefined, { select, publish })
    await screen.findByText('记忆设置已加载。')

    fireEvent.click(screen.getByRole('button', { name: '数据导出' }))

    expect(await screen.findByText('导出失败，未写入文件。')).toBeTruthy()
    expect(screen.queryByText('BiBit 记忆数据 JSON 已导出到你选择的位置。')).toBeNull()
  })

  it('falls back to the browser download when the host grants file transfer without publish', async () => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:memory-export'),
      revokeObjectURL: vi.fn(),
    })
    const select = vi.fn(async () => ({
      version: 1,
      grantId: 'grant-1',
      direction: 'download',
      displayName: 'bianbu-agent-memory-export.json',
      expiresAt: new Date(0).toISOString(),
    }))
    renderWithMemoryService(undefined, { select })
    await screen.findByText('记忆设置已加载。')

    fireEvent.click(screen.getByRole('button', { name: '数据导出' }))

    expect(await screen.findByText('BiBit 记忆数据 JSON 已导出到系统「下载」目录（bianbu-agent-memory-export.json）。')).toBeTruthy()
    expect(anchorClick).toHaveBeenCalled()
    expect(select).not.toHaveBeenCalled()
  })

  it('shows only the required controls with the required defaults and option values', async () => {
    const { request } = renderWithMemoryService()
    await screen.findByText('记忆设置已加载。')

    // 无云端信号（backup_supported/identity.cloud_upload_allowed 缺失）
    // 时云端备份两行保持隐藏。
    expect(screen.getAllByRole('switch')).toHaveLength(2)
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    expect(screen.getAllByRole('button')).toHaveLength(4)
    expect(screen.getByRole('button', { name: '数据导入' })).toBeTruthy()
    expect(screen.getByLabelText('选择要导入的记忆数据文件')).toBeTruthy()
    // 作用域明示：顶部说明 + 三个操作各自的说明文案。
    expect(screen.getByText('本页设置与操作仅作用于 BiBit 应用自己的记忆数据。设备上其他智能体应用的记忆相互独立，不受本页影响。')).toBeTruthy()
    expect(screen.getByText('永久删除 BiBit 应用记忆空间中的全部数据（对话记录、摘要、长期记忆与偏好）。')).toBeTruthy()
    expect(screen.getByText('清除 BiBit 记忆中保存的对话记录与摘要，长期记忆（如你的偏好）会保留。')).toBeTruthy()
    expect(screen.getByText('将 BiBit 应用记忆空间中的数据导出为 JSON 文件。不包含其他智能体应用的记忆，也不包含聊天对话原文。')).toBeTruthy()
    expect(screen.getByText('从之前导出的 JSON 文件恢复 BiBit 记忆。已存在的记忆会保留当前内容，同一文件可重复导入。')).toBeTruthy()
    expect((screen.getByRole('switch', { name: '记忆功能' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('switch', { name: '语义记忆' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByRole('switch', { name: '云端备份' })).toBeNull()
    expect(screen.queryByLabelText('自动备份频率')).toBeNull()
    expect((screen.getByLabelText('记忆保留时长') as HTMLSelectElement).value).toBe('0')
    expect(Array.from(screen.getByLabelText('记忆保留时长').querySelectorAll('option')).map((option) => [option.value, option.textContent]))
      .toEqual([['7', '7天'], ['30', '30天'], ['90', '90天'], ['0', '永久']])
    expect(screen.queryByText('Control local Agent memory and how Runtime recalls saved context.')).toBeNull()
    expect(screen.queryByText('Changes are saved immediately through the Memory service; Runtime is not involved.')).toBeNull()

    fireEvent.change(screen.getByLabelText('记忆保留时长'), { target: { value: '7' } })
    await waitFor(() => expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      operationId: 'privacy.settings.update', params: { retention_days: 7 },
    })))
    expect(screen.queryByText('敏感操作确认级别')).toBeNull()
    expect(screen.queryByText('命令执行预览')).toBeNull()
    expect(screen.queryByText('审计日志')).toBeNull()
  })

  it('shows the cloud backup controls when the backend signals cloud support', async () => {
    const { request } = renderWithMemoryService({
      backup_supported: true,
      identity: { account_id: 'spacemit:test', cloud_upload_allowed: true },
    })
    await screen.findByText('记忆设置已加载。')

    expect(screen.getAllByRole('switch')).toHaveLength(3)
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
    expect((screen.getByRole('switch', { name: '云端备份' }) as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText('自动备份频率') as HTMLSelectElement).value).toBe('weekly')
    expect(Array.from(screen.getByLabelText('自动备份频率').querySelectorAll('option')).map((option) => [option.value, option.textContent]))
      .toEqual([['daily', '每天'], ['weekly', '每周'], ['monthly', '每月'], ['manual', '手动']])

    fireEvent.click(screen.getByRole('switch', { name: '云端备份' }))
    await waitFor(() => expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      operationId: 'privacy.settings.update', params: { backup_enabled: true },
    })))

    fireEvent.change(screen.getByLabelText('自动备份频率'), { target: { value: 'daily' } })
    await waitFor(() => expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
      operationId: 'privacy.settings.update', params: { backup_frequency: 'daily' },
    })))
  })

  it('keeps cloud backup controls hidden when the account may not upload', async () => {
    renderWithMemoryService({ backup_supported: true })
    await screen.findByText('记忆设置已加载。')
    expect(screen.queryByRole('switch', { name: '云端备份' })).toBeNull()
    expect(screen.queryByLabelText('自动备份频率')).toBeNull()
  })

  it('round-trips the full embedding section with only enabled flipped', async () => {
    const { request } = renderWithMemoryService()
    const embeddingSwitch = await screen.findByRole('switch', { name: '语义记忆' })
    await screen.findByText('记忆设置已加载。')
    expect((embeddingSwitch as HTMLInputElement).checked).toBe(true)

    fireEvent.click(embeddingSwitch)

    await waitFor(() => {
      expect(request).toHaveBeenLastCalledWith(expect.objectContaining({
        serviceId: 'memory',
        operationId: 'privacy.settings.update',
        params: {
          embedding: expect.objectContaining({
            enabled: false,
            base_url: 'http://127.0.0.1:18801/v1',
            model: 'qwen3-embedding-0.6b',
            dims: 1024,
            index_timeout_ms: 10000,
          }),
        },
      }))
    })
    expect(await screen.findByText('记忆设置已保存。')).toBeTruthy()
    expect((screen.getByRole('switch', { name: '语义记忆' }) as HTMLInputElement).checked).toBe(false)
  })

  it('hides the semantic memory switch when the backend has no embedding section', async () => {
    let settings = {
      memory_enabled: true,
      retention_days: 0 as const,
      backup_enabled: false,
      backup_frequency: 'weekly' as const,
    }
    const request = vi.fn(async ({ operationId, params }: { operationId: string; params: Record<string, unknown> }) => {
      if (operationId === 'privacy.settings.get') return settings
      settings = { ...settings, ...(params as Partial<typeof settings>) }
      return settings
    })
    const capability = { request } as never
    const hostApi: FeatureHostApiV1 = {
      sdkApiVersion: 1,
      featureId: 'memory',
      grantedCapabilities: ['service:memory'],
      getCapability: () => capability,
    }
    render(
      <FeatureHostApiProvider value={hostApi}>
        <MemorySettingsPage featureId="memory" contributionId="manager" subpath="" search={{}} navigation={{ push() {}, replace() {}, back() {} }} />
      </FeatureHostApiProvider>
    )
    await screen.findByText('记忆设置已加载。')
    expect(screen.queryByRole('switch', { name: '语义记忆' })).toBeNull()
    // 该 mock 同样无云端信号：只剩「记忆功能」一个开关。
    expect(screen.getAllByRole('switch')).toHaveLength(1)
  })

  it('disables every control as soon as the service fails and recovers through retry', async () => {
    const { failures } = renderWithMemoryService()
    const memorySwitch = await screen.findByRole('switch', { name: '记忆功能' })
    await screen.findByText('记忆设置已加载。')
    expect(screen.getByText('记忆服务运行中')).toBeTruthy()

    failures.value = true
    fireEvent.click(memorySwitch)

    // 保存失败会立即复检，不用等下一个轮询周期才反映服务掉线。
    expect(await screen.findByText('记忆服务不可用')).toBeTruthy()
    expect(screen.getByText('记忆服务（bianbu-agent-memory）未响应，设置已暂时禁用。')).toBeTruthy()
    expect((screen.getByRole('switch', { name: '记忆功能' }) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: '清除所有记忆' }) as HTMLButtonElement).disabled).toBe(true)

    failures.value = false
    fireEvent.click(screen.getByRole('button', { name: '重试' }))

    expect(await screen.findByText('记忆服务运行中')).toBeTruthy()
    expect((screen.getByRole('switch', { name: '记忆功能' }) as HTMLInputElement).disabled).toBe(false)
  })

  it('re-checks the service on its own so a silent outage shows up without user action', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { request, failures } = renderWithMemoryService()
    await screen.findByText('记忆设置已加载。')
    expect(screen.getByText('记忆服务运行中')).toBeTruthy()

    failures.value = true
    const callsBefore = request.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SERVICE_POLL_MS)
    })

    expect(request.mock.calls.length).toBeGreaterThan(callsBefore)
    expect(screen.getByText('记忆服务不可用')).toBeTruthy()
  })

  it('imports a chosen JSON document through privacy.import_data', async () => {
    const { request, importedPayloads } = renderWithMemoryService()
    const confirmMock = vi.fn(() => true)
    vi.stubGlobal('confirm', confirmMock)
    await screen.findByText('记忆设置已加载。')

    const input = screen.getByLabelText('选择要导入的记忆数据文件') as HTMLInputElement
    expect(input).toBeTruthy()
    const document = {
      format: 'bianbu-agent-memory.export.v1',
      scope: { account_id: 'spacemit:test', agent_id: 'bibit', memory_space_id: 'space' },
      session_events: [],
      session_summaries: [],
      long_term_memories: [{ memory_id: 'm1', kind: 'preference', text: 'likes tea' }],
    }
    const file = new File([JSON.stringify(document)], 'memory.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      operationId: 'privacy.import_data',
      params: { payload: document },
    })))
    expect(importedPayloads).toHaveLength(1)
    expect(confirmMock).toHaveBeenLastCalledWith(expect.stringContaining('导入不会删除任何记忆'))
    expect(await screen.findByText('记忆数据已导入。')).toBeTruthy()
  })

  it('rejects a file that is not a memory export without contacting the service', async () => {
    const { request } = renderWithMemoryService()
    vi.stubGlobal('confirm', vi.fn(() => true))
    await screen.findByText('记忆设置已加载。')

    const input = screen.getByLabelText('选择要导入的记忆数据文件') as HTMLInputElement
    const file = new File([JSON.stringify({ format: 'something.else.v1' })], 'other.json', { type: 'application/json' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText('导入文件格式不受支持（需要 bianbu-agent-memory.export.v1）')).toBeTruthy()
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ operationId: 'privacy.import_data' }))
  })

  it('sends no import request when the confirmation is dismissed', async () => {
    const { request } = renderWithMemoryService()
    vi.stubGlobal('confirm', vi.fn(() => false))
    await screen.findByText('记忆设置已加载。')

    const input = screen.getByLabelText('选择要导入的记忆数据文件') as HTMLInputElement
    const file = new File(
      [JSON.stringify({ format: 'bianbu-agent-memory.export.v1' })],
      'memory.json',
      { type: 'application/json' },
    )
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText('已取消导入，记忆未更改。')).toBeTruthy()
    expect(request).not.toHaveBeenCalledWith(expect.objectContaining({ operationId: 'privacy.import_data' }))
  })
})
