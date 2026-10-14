import type { FeatureModuleV1 } from '@bibit/feature-sdk'
import { MemorySettingsPage } from './MemorySettingsPage'

export const featureModule: FeatureModuleV1 = {
  sdkApiVersion: 1,
  settings: { manager: MemorySettingsPage },
  locales: {
    en: { title: 'Memory', description: 'Configure and manage local Agent memory' },
    'zh-CN': { title: '记忆', description: '配置和管理本地 Agent 记忆' },
  },
}
