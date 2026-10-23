# Bibit Memory Plugin

**The control panel for what your agent remembers.**

[English](README.md) | [简体中文](README_CN.md)

Hi, this is the Memory plugin for BiBit. It adds one page under Settings →
Memory, and that page is where a person turns memory on, decides how long to
keep it, clears a conversation, wipes everything, and moves their data in or
out as JSON.

It doubles as a working reference for trusted BiBit plugin development: one
settings contribution, one host capability, and no changes to the host.

## What the page can do

| In the UI | What the plugin calls |
| --- | --- |
| Memory on/off | `privacy.settings.update` |
| How long to keep memory | `privacy.settings.update` |
| Clear conversation history | `privacy.clear_history` |
| Clear all memory | `privacy.clear_all` |
| Export to JSON | `privacy.export_data` |
| Import from JSON | `privacy.import_data` |

Every change is saved immediately: the page sends it through `service:memory`
and the Memory service writes it down. No Runtime hop, no hand-edited JSON.

Deletes are a two-step dance. The page asks, the trusted host or adapter mints
a one-time confirmation token, and the operation only runs with that token.
The page itself cannot mint one.

## How it fits

```text
BiBit Settings
  └─ Memory page  (this plugin)
       └─ service:memory  (host capability, granted at install)
            └─ bianbu-agent-memoryd  (stores and guards the actual memory)
```

The plugin never talks to a backend URL. It asks the host for the
`service:memory` capability and calls operations on it. That keeps the page
portable and the credentials out of the front end.

## Quick start

```bash
npm ci
npm run typecheck
npm test
npm run dev
```

Then open the Vite URL (default `http://127.0.0.1:5169/`). The dev host renders
the settings shell and wires `service:memory` to a Memory Adapter at
`http://<host>:5168/invoke`. If no adapter is running, the page says so
instead of pretending.

The adapter listens on loopback only. For a remote device, use your own SSH
port forwarding; keep real host names, users, and passwords out of config files
and docs. `http://127.0.0.1:5168/health` tells you whether the adapter is up.

## Build a signed plugin

```bash
npm run build:dev      # plain dev bundle
npm run keygen         # first time only: local development key
npm run build:plugin   # signed package
```

The signed artifact lands in `artifacts/` as
`memory-<version>.bibit-plugin.tgz`. Keep `.bibit-keys/` out of git.

## What is in the box

```text
├── bibit.feature.json        # manifest: one settings contribution
├── package.json
├── dev/main.tsx              # Feature Dev Host + real service connection
├── src/
│   ├── feature.tsx           # FeatureModuleV1 wiring
│   ├── plugin.tsx            # registerFeaturePlugin entry
│   ├── MemorySettingsPage.tsx
│   ├── memory-contracts.ts   # operations and DTOs
│   └── memory.css            # .memory-* namespace
├── tests/                    # focused regression tests
└── docs/                     # dev/deploy guide and a worked case
```

## More reading

- [Development and deployment guide](./docs/development-and-deployment-guide_EN.md)
- [Memory settings case study](./docs/memory-settings-case_EN.md)

## Where the line is

- The front end only calls `useFeatureCapability('service:memory')`. It never
  holds a backend URL or a credential.
- Loading the plugin is not the same as a working backend. A real acceptance
  run needs the registry, the adapter, and the operations to line up.
- Memory logic, persistence, permissions, and confirmation live in
  `bianbu-agent-memory`. This repo owns the UI and the DTO contract.

## Before you publish

Run `git ls-files` and make sure there is no `.env`, private key, database,
exported memory, build artifact, or device log. Replace internal repository
addresses, private IPs, absolute paths, and real credentials with placeholders.
Then run `npm ci && npm run typecheck && npm test && npm run build:dev` before
cutting a release.
