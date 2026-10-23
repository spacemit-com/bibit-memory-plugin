# Bibit 记忆插件

**给“智能体记住了什么”配一块看得见、管得住的操作面板。**

[English](README.md) | [简体中文](README_CN.md)

你好，这里是 BiBit 的「记忆」插件。它在设置里加了一页「记忆」——用户在这里
打开或关闭记忆、选择记忆保留多久、清掉一段对话、抹掉全部记忆，以及把数据
导出成 JSON 或从 JSON 导回来。

它同时也是一份能跑起来的最小参考：一个设置页贡献、一个宿主能力，不改宿主
一行代码，就能把可信插件怎么写讲清楚。

## 这一页能做什么

| 用户在页面上看到的 | 插件调用什么 |
| --- | --- |
| 记忆功能开关 | `privacy.settings.update` |
| 记忆保留时长 | `privacy.settings.update` |
| 清除对话历史 | `privacy.clear_history` |
| 清除所有记忆 | `privacy.clear_all` |
| 数据导出 | `privacy.export_data` |
| 数据导入 | `privacy.import_data` |

改完即生效：页面把变更交给 `service:memory`，由记忆服务落盘。不绕 Runtime，
也不需要谁去手改 JSON。

删除是“两次确认”的动作：页面先问，可信宿主或适配器签发一次性确认令牌，
操作拿到令牌才执行。页面自己造不出令牌。

## 它站在哪儿

```text
BiBit 设置
  └─ 记忆页（本插件）
       └─ service:memory（宿主能力，安装时授权）
            └─ bianbu-agent-memoryd（真正存记忆、管权限的服务）
```

插件不直接访问任何后端 URL。它向宿主申请 `service:memory` 能力，再在这条
能力上调用 operation。页面因此可以搬家，凭据也不会跑到前端来。

## 跑起来

```bash
npm ci
npm run typecheck
npm test
npm run dev
```

浏览器打开 Vite 给出的地址（默认 `http://127.0.0.1:5169/`）。Dev Host 会渲染
设置外壳，并把 `service:memory` 接到 `http://<host>:5168/invoke` 的 Memory
Adapter；没有 Adapter 时页面会直说“不可用”，不会假装成功。

Adapter 默认只听回环地址。远程设备联调请用你自己的 SSH 端口转发，别把真实
主机名、用户名、密码写进配置或文档。`http://127.0.0.1:5168/health` 可以看
Adapter 是否活着。

## 打一个签名插件

```bash
npm run build:dev      # 开发构建
npm run keygen         # 首次生成本地开发密钥
npm run build:plugin   # 签名打包
```

签名产物在 `artifacts/`，文件名形如 `memory-<version>.bibit-plugin.tgz`。
`.bibit-keys/` 里的私钥不要提交。

## 目录速览

```text
├── bibit.feature.json        # Manifest：一个 settings 贡献
├── package.json
├── dev/main.tsx              # Feature Dev Host 与真实 service 连接
├── src/
│   ├── feature.tsx           # FeatureModuleV1 装配
│   ├── plugin.tsx            # registerFeaturePlugin 入口
│   ├── MemorySettingsPage.tsx
│   ├── memory-contracts.ts   # operation 与 DTO
│   └── memory.css            # .memory-* 命名空间
├── tests/                    # 小而准的回归测试
└── docs/                     # 开发部署指南与案例
```

## 想再深入一点

- [开发与部署指南](./docs/development-and-deployment-guide.md)
- [案例说明](./docs/memory-settings-case.md)

## 边界

- 前端只调用 `useFeatureCapability('service:memory')`，不持有后端地址和凭据。
- 插件加载成功 ≠ 后端接通。真实验收要把 Registry、Adapter 和 operation 逐层
  跑通。
- 记忆的业务逻辑、持久化、权限和确认都在 `bianbu-agent-memory`。本仓库只负责
  页面和 DTO 契约。

## 发布前检查

先跑 `git ls-files`，确认没有 `.env`、私钥、数据库、导出的记忆、构建产物或设备
日志；把内部仓库地址、内网 IP、绝对路径和真实凭据换成占位符。再执行
`npm ci && npm run typecheck && npm test && npm run build:dev`，然后打包发布。
