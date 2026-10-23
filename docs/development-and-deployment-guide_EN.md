# Bibit Memory Plugin Development and Deployment Guide

For new memory-module teammates and coding agents. Goal: develop the Memory
settings plugin independently without building all of Bibit, connect it to a
standalone Agent Memory service through public host APIs, and build a signed
plugin.

## 1. Repository and versions

| Item | Value |
| --- | --- |
| Plugin | `memory` `0.1.6` |
| `manifestSchemaVersion` | `1` |
| `sdkApiVersion` | `1` |
| `@bibit/*` SDK | `0.3.0` |
| React / React DOM | `19.0.0` |
| Repository | https://github.com/spacemit-com/bibit-memory-plugin |

## 2. Framework docs to read first

Framework source and docs live in the `bibit-gui` repository (internal):

- `docs/feature-sdk/README.md`
- `docs/feature-sdk/developer-guide.md`
- `docs/feature-sdk/trusted-plugin-guide.md`
- `docs/feature-sdk/manifest-v1.md`
- `docs/feature-sdk/settings-content-contract.md`
- `docs/feature-sdk/host-capabilities.md`
- `docs/feature-sdk/compatibility-matrix.md`

The `src/` layout here is the smallest working application of those docs.

## 3. How the plugin works

```text
MemorySettingsPage
  └─ useFeatureCapability('service:memory')
       └─ Bibit Host / Provider Broker
            └─ Memory Adapter
                 └─ bianbu-agent-memoryd

Export takes an extra host primitive:
MemorySettingsPage
  └─ useFeatureCapability('file:transfer')
       └─ Bibit Host native save dialog + grant-backed write
```

- The manifest declares `service:memory` and `file:transfer`.
- The page calls `privacy.settings.get`, `privacy.settings.update`,
  `privacy.clear_history`, `privacy.clear_all`, `privacy.export_data`, and
  `privacy.import_data` on `service:memory`.
- Export first fetches the JSON with `privacy.export_data`, then uses
  `file:transfer` so the user can choose a location and the bytes go to the
  host; the host verifies length and SHA-256 before an atomic write, and the
  plugin never sees an absolute path. When the capability is not granted, the
  browser download fallback stays available.
- Import reads the user-selected JSON in the page itself (SDK 0.3.0's
  `file:transfer` only supports download), validates
  `bianbu-agent-memory.export.v1`, asks for confirmation, and then calls
  `privacy.import_data`. Import is a merge: records that already exist are
  skipped by id, and nothing is overwritten or deleted.
- The memory switch and retention are saved immediately: every change goes
  straight to the Memory Provider and memoryd persists it. No Runtime hop, no
  hand-edited JSON or SQLite.
- Deletes need a one-time confirmation token minted by the system confirmation
  flow. The host or adapter binds it to the current agent, operation, and
  expiry; memoryd only verifies it and runs the transaction. The page's
  confirmation dialog is not a security boundary.
- Command previews and full BiBit audit belong to Runtime/Security, not this
  plugin.
- Backend protocol fields are documented in
  `bianbu-agent-memory/docs/BIBIT_INTEGRATION_CONTRACT.md`.
- The plugin must not use `fetch`, `WebSocket`, or Tauri commands to reach the
  backend.

## 4. Local development

```bash
npm ci
npm run typecheck
npm test
npm run dev
```

`dev/main.tsx` connects `serviceConnections.memory` to
`http://<host>:5168/invoke` (`<host>` comes from `window.location.hostname`),
so you can exercise a real Memory Adapter without starting all of Bibit.

The Memory Adapter does not authenticate callers, so it binds to loopback only
and is not exposed on the device's LAN interfaces. On the device,
`http://127.0.0.1:5168/` and `/health` should return JSON with `status=ok`
(those GETs are health checks only; the Memory settings page is served by
Bibit/Feature Dev Host). If Vite runs on your PC and the adapter on the device,
open an SSH tunnel (`ssh -L 5168:127.0.0.1:5168 bianbu@<device>`) instead of
rebinding the adapter to `0.0.0.0`; if temporary exposure on the device is
truly required, an operator must pass
`--host 0.0.0.0 --allow-origin '<origin>'` explicitly and shut it down as soon
as the session ends.

Automated tests inject a controlled host mock through `FeatureHostApiProvider`
and only cover the page and the DTOs; they do not prove that a real adapter is
connected.

## 5. Build a signed plugin

```bash
npm run build:dev
npm run keygen
npm run build:plugin
```

Output (the version comes from the manifest `version`, currently `0.1.6`):

```text
artifacts/memory-0.1.6.bibit-plugin.tgz
```

`.bibit-keys/memory-development-private.pem` is the development private key;
never commit it.

## 6. What a system deployment also needs

Production deployment is not just a front-end bundle; the platform must
register and grant it too:

```text
/usr/lib/bibit/plugins/memory.bibit-plugin.tgz
/etc/bibit/feature-capability-grants.d/memory.json
/etc/bibit/external-services.d/memory.json
```

- `feature-capability-grants.d/memory.json` approves `service:memory` and its
  operations precisely.
- `external-services.d/memory.json` registers the Memory Adapter/Provider.
- If the manifest, the grant, and the Provider Registry disagree, the host
  refuses the call.
- The host only sends requests to `POST <baseUrl>/bibit/v1/invoke` (see
  `bibit-gui/docs/feature-sdk/external-service-development-and-deployment.md`);
  if the adapter only serves `/invoke`, the page keeps showing "memory service
  unavailable". `bianbu-agent-memory` meets this contract from the adapter
  version that supports `/bibit/v1/invoke`.

`debian/rules` installs all three from `deploy/` and the `npm run build:plugin`
output; do not maintain them by hand on the device. The Memory Adapter is
shipped by `bianbu-agent-memory` (already declared in `bibit-memory-plugin`'s
Depends); when bumping the plugin version, update `package.json`,
`bibit.feature.json`, and `PLUGIN_VERSION` in `debian/rules` together.

The Memory Adapter belongs to Runtime/Memory; this front-end repo only defines
operations and DTOs.

## 7. Acceptance checklist

- [ ] `npm ci && npm run typecheck && npm test && npm run build:dev && npm run build:plugin`
- [ ] The dev host shows exactly one settings page header and one settings menu entry
- [ ] No horizontal overflow in the content area at 760px
- [ ] Switching the settings page 50 times leaves no listeners, timers, or requests behind
- [ ] Without the `service:memory` grant, the page reports partial unavailability
- [ ] In the target Bibit, "loaded" appears only after a real `privacy.settings.get` succeeds
- [ ] After each successful change, re-entering the page shows the latest settings
- [ ] The four data operations call `privacy.clear_history`, `privacy.clear_all`, `privacy.export_data`, and `privacy.import_data`
- [ ] A real host/adapter injects a one-time confirmation token for clear operations; if memoryd rejects it, nothing changes

## 8. Common problems

| Symptom | Check |
| --- | --- |
| Page shows unavailable | Is it granted, is the provider registered, is the adapter listening |
| PC browser cannot reach device `5168` | Expected: the adapter binds loopback only. Open `ssh -L 5168:127.0.0.1:5168 bianbu@<device>` and retry from the PC |
| Build fails on a CSS selector | Remove `:root`/`html`/`body`/bare `*`; prefix class names with `memory-` |
| Build fails on the manifest | Check `id=memory`, a matching `package.json` version, and `en` in locales |
| Dev host works but Bibit is blank | Check the SDK version and whether the DTO matches the mock/adapter |
