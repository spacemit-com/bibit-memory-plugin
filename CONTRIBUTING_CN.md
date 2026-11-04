# 贡献指南

[English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING_CN.md)

请在 Pull Request 中说明问题、预期行为和验证结果。一次修改聚焦一个目标；行为变化时，同步更新文档和回归测试。

## 反馈问题

请提供源码提交号、软件包版本、操作系统、复现步骤、预期结果和实际结果。使用虚构的示例数据，不要在公开 Issue 中上传真实记忆导出文件、用户数据库、凭据、签名私钥或未经脱敏的对话日志。

## 版本说明

源码元数据版本与 Debian 软件包版本的关系见[版本说明](VERSIONING_CN.md)。

## 开发检查

使用 package.json 指定的宿主 SDK 和 React 版本。按照[中文 README](README_CN.md) 配置开发适配器，然后执行：

```bash
npm ci
npm test
npm run typecheck
npm run build:dev
npm run keygen  # 首次执行，生成本地开发签名密钥
npm run build:plugin
```

不要提交 `.bibit-keys/`、生成的构建包或生产签名私钥。本地开发密钥签名的插件包不等于官方受信任的发布包。

业务操作必须通过 `service:memory`，文件导出使用宿主的 `file:transfer` 能力。前端不得依赖宿主私有源码或持有后端凭据。修改 operation 或 DTO 时，同步更新契约、页面行为、开发集成和测试。

界面测试使用可控的宿主 Mock。开发页面连接真实适配器属于单独的集成验证，不要为此改动正在压测的设备。
