# Bibit Memory Plugin 开发与部署指南

面向记忆模块新同事和 Coding Agent。目标：在不编译完整 Bibit 的情况下独立开发
Memory 设置插件，通过公开 Host API 连接独立的 Agent Memory 服务，并构建签名插件。

## 1. 仓库与版本

| 项目 | 值 |
| --- | --- |
| 插件 | `memory` `0.1.6` |
| `manifestSchemaVersion` | `1` |
| `sdkApiVersion` | `1` |
| `@bibit/*` SDK | `0.3.0` |
| React / React DOM | `19.0.0` |
| 仓库 | https://github.com/spacemit-com/bibit-memory-plugin |

## 2. 必须先读的框架文档

框架源码和文档在 `bibit-gui` 仓库（内部）：

- `docs/feature-sdk/README.md`
- `docs/feature-sdk/developer-guide.md`
- `docs/feature-sdk/trusted-plugin-guide.md`
- `docs/feature-sdk/manifest-v1.md`
- `docs/feature-sdk/settings-content-contract.md`
- `docs/feature-sdk/host-capabilities.md`
- `docs/feature-sdk/compatibility-matrix.md`

本仓库的 `src/` 结构是这些文档的最小落地版本。

## 3. 插件如何工作

```text
MemorySettingsPage
  └─ useFeatureCapability('service:memory')
       └─ Bibit Host / Provider Broker
            └─ Memory Adapter
                 └─ bianbu-agent-memoryd

数据导出额外走宿主原语：
MemorySettingsPage
  └─ useFeatureCapability('file:transfer')
       └─ Bibit Host 原生保存对话框 + Grant 落盘
```

- Manifest 声明 `service:memory` 与 `file:transfer`。
- 页面调用 `service:memory` 的 `privacy.settings.get`、`privacy.settings.update`、`privacy.clear_history`、`privacy.clear_all`、`privacy.export_data` 和 `privacy.import_data`。
- 数据导出先用 `privacy.export_data` 取回 JSON，再用 `file:transfer` 让用户选择保存位置并把字节交给宿主；宿主校验长度与 SHA-256 后原子写入，插件始终拿不到绝对路径。宿主未授权该能力时保持浏览器下载回退。
- 数据导入由页面自己的文件选择框读取用户选择的 JSON（SDK 0.3.0 的 `file:transfer` 只有 download 方向），先用 `bianbu-agent-memory.export.v1` 校验格式、再弹确认框、最后调用 `privacy.import_data`。导入是合并语义：已存在的记录按原 id 跳过，不会覆盖或删除现有记忆。
- 设置页面的记忆开关和保留期采用即时保存：每次变更都直接提交给 Memory Provider，由 memoryd 持久化；不经过 Runtime，也不直接编辑 JSON/SQLite。
- 删除操作需要系统确认流程签发的一次性确认令牌。Host/Adapter 将令牌绑定到当前 Agent、operation 和有效期后注入请求；memoryd 只验证结果并执行事务。前端的确认弹窗不是安全边界。
- 命令执行预览和全量 BiBit 操作审计由 Runtime/Security 提供，不属于本插件。
- 后端协议字段见 `bianbu-agent-memory/docs/BIBIT_INTEGRATION_CONTRACT.md`。
- 插件不得使用 `fetch`、`WebSocket` 或直接 Tauri command 访问后端。

## 4. 本地开发

```bash
npm ci
npm run typecheck
npm test
npm run dev
```

`dev/main.tsx` 通过 `serviceConnections.memory` 连接 `http://<host>:5168/invoke`
（`<host>` 取 `window.location.hostname`），用于在不启动完整 Bibit 的情况下联调真实
Memory Adapter。

Memory Adapter 不对调用方做身份认证，因此只监听回环地址，不随宿主机网卡暴露到局域网：
在设备上直接访问 `http://127.0.0.1:5168/` 或 `/health` 应返回 `status=ok` 的 JSON（这两个
GET 只用于状态检查，Memory 设置页面由 Bibit/Feature Dev Host 承载）。若 Vite 跑在 PC、
Adapter 跑在设备上，请先建 SSH 隧道（`ssh -L 5168:127.0.0.1:5168 bianbu@<device>`）再联调，
不要为了联调把 Adapter 改绑 `0.0.0.0`；确需在设备上临时暴露时，必须由运维显式传
`--host 0.0.0.0 --allow-origin '<来源>'`，并在联调结束后立即回收。

自动化测试通过 `FeatureHostApiProvider` 注入受控的 Host mock，只验证页面与 DTO，不代表真实
Adapter 已接通。

## 5. 构建签名插件

```bash
npm run build:dev
npm run keygen
npm run build:plugin
```

产物（版本取自 Manifest 的 `version`，当前为 `0.1.6`）：

```text
artifacts/memory-0.1.6.bibit-plugin.tgz
```

`.bibit-keys/memory-development-private.pem` 是开发私钥，禁止提交。

## 6. 系统部署需要同时提供

生产部署不是只装一个前端 bundle，还需要平台侧注册和授权：

```text
/usr/lib/bibit/plugins/memory.bibit-plugin.tgz
/etc/bibit/feature-capability-grants.d/memory.json
/etc/bibit/external-services.d/memory.json
```

- `feature-capability-grants.d/memory.json` 精确批准 `service:memory` 和 operation。
- `external-services.d/memory.json` 登记 Memory Adapter/Provider。
- 插件 Manifest、grant、Provider Registry 三处不一致时，Host 拒绝调用。
- Host 只会把请求发给 `POST <baseUrl>/bibit/v1/invoke`（见
  `bibit-gui/docs/feature-sdk/external-service-development-and-deployment.md`）；
  Adapter 只提供 `/invoke` 时，页面会一直显示「记忆服务不可用」。`bianbu-agent-memory`
  自 adapter 支持 `/bibit/v1/invoke` 起满足该契约。

这三份文件由 `debian/rules` 从 `deploy/` 和 `npm run build:plugin` 的产物安装，
不要在设备上手工维护。Memory Adapter 由 `bianbu-agent-memory` 提供（`bibit-memory-plugin`
的 Depends 已声明）；升级插件版本时同步 `package.json`、`bibit.feature.json` 与
`debian/rules` 里的 `PLUGIN_VERSION`。

Memory Adapter 属于 Runtime/Memory 服务侧，本前端仓库只定义 operation 和 DTO。

## 7. 验收清单

- [ ] `npm ci && npm run typecheck && npm test && npm run build:dev && npm run build:plugin`
- [ ] Dev Host 只有一个设置页头和一个设置菜单
- [ ] 760px 窄窗口无内容区横向溢出
- [ ] 反复切换设置页 50 次，无残留 listener/timer/request
- [ ] 未 grant `service:memory` 时页面显示局部不可用
- [ ] 在目标 Bibit 中真实 `privacy.settings.get` 成功后才显示「已加载」
- [ ] 每次变更成功后重新进入仍能读到最新设置
- [ ] 四个数据操作分别调用 `privacy.clear_history`、`privacy.clear_all`、`privacy.export_data` 和 `privacy.import_data`
- [ ] 真实 Host/Adapter 为清除操作注入一次性确认令牌，memoryd 验证失败时数据不变

## 8. 常见错误

| 现象 | 检查 |
| --- | --- |
| 页面显示 unavailable | 是否 grant、是否注册 Provider、Adapter 是否监听 |
| PC 浏览器直连设备 `5168` 失败 | 预期行为：Adapter 只监听回环。先建隧道 `ssh -L 5168:127.0.0.1:5168 bianbu@<device>`，再在 PC 上联调 |
| 构建失败且提示 CSS selector | 移除 `:root`/`html`/`body`/裸 `*`，类名加 `memory-` 前缀 |
| 构建失败且提示 Manifest | 确认 `id=memory`、`package.json` 版本一致、locale 含 `en` |
| Dev Host 正常但 Bibit 白屏 | 检查 SDK 版本、DTO 与 Mock/Adapter 是否一致 |
