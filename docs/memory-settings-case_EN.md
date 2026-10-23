# Case study: the Memory settings plugin

## Goal

Add a `Memory` entry under `Settings > Privacy` in Bibit, where the user can
switch memory on or off, set retention, and run clear-history, clear-all,
export, and import.

## Delivery path

1. `bibit.feature.json` declares `service:memory` and `settings.manager`.
2. `src/feature.tsx` registers `MemorySettingsPage` as `settings.manager`.
3. `MemorySettingsPage` calls `useFeatureCapability('service:memory')` to get
   the host API.
4. On load it calls `privacy.settings.get`; setting changes call
   `privacy.settings.update` immediately, without going through Runtime.
   Clear-history, clear-all, export, and import each call their `privacy.*`
   operation.
5. After four layers of authorization, the host forwards the request to the
   Memory Provider/Adapter. The confirmation dialog for deletes is user
   experience only; it is not a security check.
6. The adapter forwards to `bianbu-agent-memoryd` and injects a one-time
   confirmation token issued by Runtime/Security, bound to the operation,
   agent, and expiry. Memory verifies it, audits, and runs the transaction. The
   page never touches files or the database.

## Files in this repo

- Manifest: `bibit.feature.json`
- Settings page: `src/MemorySettingsPage.tsx`
- Operations and DTOs: `src/memory-contracts.ts`
- Development mock: `dev/main.tsx`
- Focused regression tests: `tests/MemorySettingsPage.test.tsx`

## Minimal manifest

```json
{
  "manifestSchemaVersion": 1,
  "sdkApiVersion": 1,
  "id": "memory",
  "version": "0.1.6",
  "owner": "memory-team",
  "display": {
    "titleKey": "memory:title",
    "fallbackTitle": "Memory",
    "iconKey": "memory"
  },
  "targets": ["desktop"],
  "requiredHostCapabilities": ["service:memory", "file:transfer"],
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

## Key DTOs

```ts
export const MEMORY_OPS = {
  getSettings: 'privacy.settings.get',
  updateSettings: 'privacy.settings.update',
  clearHistory: 'privacy.clear_history',
  clearAll: 'privacy.clear_all',
  exportData: 'privacy.export_data',
  importData: 'privacy.import_data',
} as const

export interface MemorySettingsV1 {
  memory_enabled: boolean
  retention_days: 0 | 7 | 30 | 90
}
```

## Quick run

```bash
npm ci
npm run dev
```

Open the Vite URL and go to `Settings · manager`. Setting changes call
`privacy.settings.update` immediately; the four data operations call
`privacy.clear_history`, `privacy.clear_all`, `privacy.export_data`, and
`privacy.import_data`. Import first validates that `format` is
`bianbu-agent-memory.export.v1` and then asks for confirmation; merge semantics
and idempotency are guaranteed by the memory side. This mock only verifies the
front end and the DTOs; it does not mean a real Memory Provider/Adapter is
connected.
