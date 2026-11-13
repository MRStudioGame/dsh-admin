# DSH Move 管理后台

DeepSeek Harness Move 移动端配套的 Web 管理后台（B/S 架构），部署于 GitHub Pages。

## 技术栈

- **Vue 3** + **TypeScript** + **Vite**
- **Element Plus**（大厂中后台 UI 组件库）
- **ECharts**（可视化图表）
- **Pinia**（状态管理）+ **Vue Router**（hash 路由）
- **axios**（HTTP 客户端）

## 功能模块

| 模块 | 说明 |
| --- | --- |
| 登录 / RBAC | 管理员账号密码登录，JWT 会话 + 超时销毁；超级管理员 / 运营管理员 / 只读观察员三角色，菜单级 + 按钮级权限，路由守卫 |
| 实时监控看板 | KPI 卡片（同比/环比）、ECharts 图表集（折线/柱状/饼图/漏斗/仪表盘）、实时告警流、在线用户清单（强制下线）、时间维度筛选、图表导出 PNG/CSV |
| 用户账号管理 | 分页列表、多条件筛选、详情、冻结/解封、重置密码、批量操作、导出 |
| 设备绑定管理 | DeviceId 与账号映射查询、手动解绑 |
| 任务日志管理 | 分页检索、详情、Excel/CSV 批量导出、状态/类型筛选 |
| 操作审计日志 | 只读不可删除，溯源审计 |
| 系统全局配置 | 限流阈值、看板刷新周期、告警规则等参数 |

## 数据来源（Mock / 真实后端切换）

默认走 **Mock 数据引擎**（`src/mock/`），提供与真实后端一致的数据结构与行为（模拟实时推送 + 短轮询降级）。

切换真实后端只需修改环境变量：

```bash
# .env.local
VITE_API_BASE=https://your-backend.example.com
```

`src/api/index.ts` 已按 REST 约定封装好所有接口，切换后上层组件零改动。

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build   # 产物输出到 dist/
```

## 部署

详见 [docs/部署说明.md](docs/部署说明.md)。
