# 案例：Memory 设置插件

## 目标

在 Bibit 的 `设置 > 隐私` 下新增一个 `Memory` 入口，用户可以在该页开关记忆、设置
保留期、云端备份和自动备份频率，并执行清除历史、清除全部和数据导出操作。

## 交付链路

1. `bibit.feature.json` 声明 `service:memory` 和 `settings.manager`。
2. `src/feature.tsx` 把 `MemorySettingsPage` 注册为 `settings.manager`。
3. `MemorySettingsPage` 用 `useFeatureCapability('service:memory')` 获取 Host API。
4. 加载时调用 `privacy.settings.get`；设置项变更立即调用 `privacy.settings.update`，不经过 Runtime。清除历史、清除全部和导出分别调用对应的 `privacy.*` operation。
5. Host 通过四层授权后把请求转给 Memory Provider/Adapter。删除操作的确认弹窗只负责用户体验，不承担安全校验。
6. Adapter 转给 `bianbu-agent-memoryd`，并为删除请求注入由 Runtime/Security 签发、绑定 operation/Agent/有效期的一次性确认令牌；Memory 负责验证结果、审计和事务。页面不直接访问文件或数据库。

## 本仓库示例对应文件

- Manifest：`bibit.feature.json`
- 设置页：`src/MemorySettingsPage.tsx`
- operation 与 DTO：`src/memory-contracts.ts`
- 开发 Mock：`dev/main.tsx`
- 最小回归测试：`tests/MemorySettingsPage.test.tsx`

## 最小 Manifest

```json
{
  "manifestSchemaVersion": 1,
  "sdkApiVersion": 1,
  "id": "memory",
  "version": "0.1.0",
  "owner": "memory-team",
  "display": {
    "titleKey": "memory:title",
    "fallbackTitle": "Memory",
    "iconKey": "memory"
  },
  "targets": ["desktop"],
  "requiredHostCapabilities": ["service:memory"],
  "contributions": {
    "pages": [],
    "settings": [
      {
        "id": "manager",
        "path": "",
        "surfaces": ["main"],
        "navigation": { "group": "privacy", "order": 100 }
      }
    ],
    "conversation": [],
    "locales": ["en", "zh-CN"]
  }
}
```

## 关键 DTO

```ts
export const MEMORY_OPS = {
  getSettings: 'privacy.settings.get',
  updateSettings: 'privacy.settings.update',
  clearHistory: 'privacy.clear_history',
  clearAll: 'privacy.clear_all',
  exportData: 'privacy.export_data',
} as const

export interface MemorySettingsV1 {
  memory_enabled: boolean
  retention_days: 0 | 7 | 30 | 90
  backup_enabled: boolean
  backup_frequency: 'manual' | 'daily' | 'weekly' | 'monthly'
}
```

## 快速运行

```bash
npm ci
npm run dev
```

打开 Vite 地址后进入 `Settings · manager`。设置项修改后会立即调用
`privacy.settings.update`；三个数据操作分别调用 `privacy.clear_history`、
`privacy.clear_all` 和 `privacy.export_data`。该 Mock 只验证前端与 DTO，不代表真实
Memory Provider/Adapter 已接通。
