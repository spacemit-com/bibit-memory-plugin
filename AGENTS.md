# 项目开发约定

1. 只维护前端 contribution、DTO/operation 和开发 Mock；不导入 Bibit 私有源码，不直连业务后端。
2. 业务请求只能通过 `service:memory`；operation 集中定义在 `src/memory-contracts.ts`。
   宿主原语 `file:transfer` 不是业务请求：它只用于让用户选择导出位置并把导出字节交给宿主落盘，仍不得直接调用 Tauri、`fetch` 或 `WebSocket`。
3. 设置 contribution 只渲染 content-only 内容，CSS 收口到 `.memory-*`，禁止 `:root`、`html`、`body`、`#root` 和裸 `*`。
4. 异步请求在卸载时取消，保存时防止重复提交，并保持局部 loading/error 状态。
5. React、React DOM 和全部 `@bibit/feature-*` 依赖必须与目标 Bibit 发布矩阵一致。
6. 提交前执行 `npm test`、`npm run typecheck`、`npm run build:dev` 和 `npm run build:plugin`；私钥和构建产物不得提交。
7. 修改 operation 或 DTO 时，同步更新 `src/memory-contracts.ts`、`dev/main.tsx`、页面和最小契约测试。
