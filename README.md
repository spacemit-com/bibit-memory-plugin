# Bibit Memory Plugin

Bibit 的「记忆」前端插件。它在 Bibit 设置区提供本地 Agent Memory 的控制台，通过
`service:memory` 这个 Host capability 连接独立的 Agent Memory 后端。本仓库是给新
同事学习可信插件开发的最小、可运行参考实现。

## 项目定位

这是一个可独立开发和测试的 Bibit Agent Memory 设置插件示例。它只负责设置页、
Host capability 调用和 DTO 契约；记忆的持久化、权限校验和删除确认由外部
`service:memory` Provider 负责。仓库不包含生产服务地址、账号、密钥或用户记忆数据。

## 当前交付范围

- 一个 `settings` contribution：`/settings/features/memory/`
- 使用 `service:memory` 调用 `privacy.settings.get` / `privacy.settings.update`、
  `privacy.clear_history`、`privacy.clear_all` 和 `privacy.export_data`
- content-only 设置页，遵守 Bibit 设置内容契约
- 页面上的记忆功能、保留期、云端备份和备份频率修改后立即通过 `service:memory` 持久化，不经过 Runtime；Memory Provider 负责写入 `memory.config.json`/对应命名空间配置
- “清除对话历史”“清除所有记忆”和“数据导出”由页面调用对应 `privacy.*` operation；删除操作必须由可信 Host/Adapter 注入已验证的一次性确认令牌，页面不能自行生成令牌
- `.memory-*` CSS 命名空间，不污染宿主和其他插件
- 独立 Feature Dev Host；通过 `serviceConnections` 连接真实 Memory Adapter，不启动完整 Bibit 也能联调
- 签名插件构建入口

## 快速开始

```bash
npm ci
npm run typecheck
npm run dev
```

浏览器打开 Vite 输出的地址（默认是 `http://127.0.0.1:5169/`）。Dev Host 会在设置
Shell 中显示 `Settings · manager` 入口，并把 `service:memory` 连接到
`http://<host>:5168/invoke` 的 Memory Adapter。没有 Adapter 时页面会明确显示不可用。

Adapter 默认只监听回环地址（`127.0.0.1:5168`），不暴露到局域网。远程设备联调时，
请使用你自己的 SSH 主机和端口转发；不要把真实主机名、用户名或密码写入配置或文档。在设备上
可直接打开 `http://127.0.0.1:5168/` 或 `http://127.0.0.1:5168/health` 检查 Adapter 状态；
两者返回状态 JSON，不承载 Memory 设置页面。业务调用仍使用
`POST <baseUrl>/bibit/v1/invoke`（兼容旧路径 `/invoke`）。

## 构建与验证

```bash
npm run typecheck
npm test
npm run build:dev

# 首次生成本地开发签名密钥
npm run keygen

# 构建签名插件
npm run build:plugin
```

产物位于 `artifacts/memory-0.1.0.bibit-plugin.tgz`。`.bibit-keys/` 中的私钥禁止提交。

## 项目结构

```text
├── bibit.feature.json        # Manifest
├── package.json              # 独立插件构建配置
├── dev/main.tsx              # Feature Dev Host 与真实 service connection
├── src/
│   ├── feature.tsx           # FeatureModuleV1 装配
│   ├── plugin.tsx            # registerFeaturePlugin 入口
│   ├── MemorySettingsPage.tsx
│   ├── memory-contracts.ts   # operation 与 DTO
│   └── memory.css
├── tests/                    # 最小回归测试
└── docs/                     # 开发、部署与案例说明
```

## 文档

- [开发与部署指南](./docs/development-and-deployment-guide.md)
- [案例说明](./docs/memory-settings-case.md)

## 边界

- 前端只调用 `useFeatureCapability('service:memory')`，不直接请求后端 URL。
- 插件加载成功 ≠ 后端接通；真实验收需要 Registry、Adapter 和 `service:memory`
  operation 逐层验证。
- 命令执行预览、全量 BiBit 审计和跨系统敏感操作门禁属于 Runtime/Security；本插件不声明也不实现这些系统能力。
- 记忆的业务逻辑、持久化和权限由 `bianbu-agent-memory` 服务负责，本仓库只维护
  UI 和 DTO/operation 契约。

## 发布前检查

公开发布前请确认 `git ls-files` 中没有 `.env`、私钥、数据库、导出记忆、构建产物或
设备日志；用占位符替换内部仓库地址、内网 IP、绝对路径和真实服务凭据。执行
`npm ci && npm run typecheck && npm test && npm run build:dev` 后再生成发布包。
