# Monorepo 学习与实践指南（Vue 前端工程师版）

## 1. 你要先建立的认知

Monorepo 不是“一个大仓库”这么简单，它的核心价值是：

- 多项目统一管理：应用、组件库、工具包放在同一个仓库
- 依赖与版本协同：减少重复安装和版本漂移
- 复用与协作提效：共享代码、统一规范、统一 CI
- 可维护性提升：通过工具链把复杂度收敛在规则里

对前端（尤其是 Vue 工程师）来说，Monorepo 最直接的收益通常是：

- 一个业务主应用 + 一个 UI 组件库 + 一个工具包（如请求封装、埋点）可以同步演进
- 修复组件库 bug 后，主应用可以立即联调，不再频繁发包和手动 link
- 多个项目共用 ESLint、TypeScript、测试和构建配置

---

## 2. 推荐学习路线（4 周）

## 第 1 周：概念与最小可用实践

目标：理解 Monorepo 必要概念并搭建第一个可运行仓库

- 学习关键词：workspace、package boundaries、task pipeline、affected
- 选择一个工具：`pnpm workspace` + `Turborepo`（入门成本低）
- 搭一个最小结构：
  - `apps/web`（Vue 主应用）
  - `packages/ui`（Vue 组件库）
  - `packages/utils`（通用工具）

输出物：

- 一个可以 `pnpm install` + `pnpm dev` 跑起来的仓库
- 主应用可直接引用 `@repo/ui` 与 `@repo/utils`

## 第 2 周：工程化标准化

目标：让仓库“可协作”，而不只是“能跑”

- 统一 TypeScript 基础配置（`tsconfig.base.json`）
- 统一 lint/format（ESLint + Prettier）
- 统一测试（Vitest）
- 引入变更检查（如 commitlint/husky，可选）

输出物：

- 根目录脚本可一键执行：`lint` / `test` / `build`
- 新增 package 时有模板可复用

## 第 3 周：性能与发布

目标：理解 Monorepo 的核心效率来源

- 使用 Turborepo 缓存（本地缓存先跑通）
- 了解任务依赖关系和增量构建
- 如果有对外包，学习 Changesets 管理版本与 changelog

输出物：

- 多项目构建速度有明显提升（冷启动 vs 热缓存）
- 可控的版本发布流程（至少了解并演练一次）

## 第 4 周：结合真实业务场景

目标：把“学习 demo”变成“工作方法”

- 抽离你常用业务模块到 `packages`（如权限、表单 schema、埋点）
- 设计 package 边界，避免循环依赖
- 在 CI 上按 affected 范围执行任务（降低流水线耗时）

输出物：

- 一份团队可执行的 Monorepo 使用约定文档
- 一次完整“需求开发 -> 组件改动 -> 主应用联调 -> 测试 -> 发布”演练

---

## 3. 技术选型建议（Vue 场景）

如果你是前端 Vue 开发者，建议从这组开始：

- 包管理：`pnpm`
- Monorepo 编排：`Turborepo`
- 构建工具：`Vite`
- 测试：`Vitest`
- 版本发布：`Changesets`（有对外 npm 包时再加）

为什么不一开始就上最复杂方案？

- 学习期最怕工具复杂度过高
- `pnpm + turbo + vite` 已足够覆盖 80% 前端 Monorepo 场景
- 等你掌握后再评估是否迁移到 Nx/Rush 等更重方案

---

## 4. 涉及的模块（你在实践中会真实接触到）

一个 Vue Monorepo，通常至少包含以下模块：

### 4.1 应用模块（apps）

- `apps/web`：主站或管理后台（Vue + Vite）
- `apps/mobile-web`（可选）：H5/活动页应用
- 职责：承载业务页面、路由、状态管理、接口调用编排

### 4.2 共享业务与基础能力模块（packages）

- `packages/ui`：跨项目复用的 Vue 组件库（Button、Table、Form 等）
- `packages/utils`：通用工具函数（日期、校验、格式化、埋点基础能力）
- `packages/api`（可选）：请求封装、接口类型定义、错误处理
- `packages/config`（可选）：全局常量、环境变量读取逻辑

### 4.3 工程化模块（infra）

- `packages/eslint-config`：统一 lint 规则
- `packages/tsconfig`：统一 TS 配置继承链
- `packages/stylelint-config`（可选）：统一样式规范
- 职责：把“团队规范”变成可执行配置

### 4.4 测试与质量模块（quality）

- 单元测试：Vitest
- 组件测试：Vue Test Utils（可按需）
- E2E 测试（可选）：Playwright/Cypress
- 职责：保证跨 package 复用后的稳定性

### 4.5 CI/CD 与发布模块（delivery）

- CI：按变更范围执行 lint/test/build
- 发布：Changesets（对外发包时）
- 制品管理：npm registry（私有或公共）
- 职责：让“多人协作 + 多包发布”可控

---

## 5. 核心思想（比工具更重要）

### 5.1 先边界，后实现

Monorepo 的第一原则是定义 package 边界，而不是先写很多共享代码。  
边界清晰，协作成本才会下降；边界混乱，Monorepo 会比多仓更难维护。

### 5.2 高内聚、低耦合

- 高内聚：一个 package 只做一类事（例如只做 UI 或只做请求）
- 低耦合：package 之间依赖尽量单向，避免循环依赖

### 5.3 约定优于随意

- 统一目录约定（apps/packages）
- 统一脚本入口（根目录 `dev/lint/test/build`）
- 统一代码规范（eslint/tsconfig/commit 规范）

目的是让新人和协作者“无须猜测项目规则”。

### 5.4 增量优于全量

Monorepo 的效率来源之一是增量执行：

- 只构建受影响项目（affected）
- 利用任务缓存减少重复执行
- CI 只跑必要任务而不是全仓全量跑

### 5.5 先跑通，再优化

不要一开始追求大而全体系。  
你应先落地最小可用骨架，再逐步引入测试、发布、缓存、权限治理等能力。

---

## 6. 技术方案选型（对比 + 推荐结论）

### 6.1 Monorepo 编排工具对比

| 方案 | 优点 | 成本 | 适用阶段 |
| --- | --- | --- | --- |
| `pnpm workspace` | 轻量、上手快、依赖管理强 | 低 | 入门与中小团队 |
| `Turborepo` | 任务编排和缓存优秀，前端体验好 | 低到中 | Vue 工程首选 |
| `Nx` | 生态完善、治理能力强、插件多 | 中到高 | 多团队大型工程 |
| `Rush` | 发布流程和大规模治理能力强 | 高 | 超大规模多包体系 |

推荐结论（你的当前阶段）：

- 第一阶段：`pnpm workspace + Turborepo`
- 第二阶段：补 `Changesets`（有发包需求时）
- 第三阶段：团队复杂度上升后，再评估 `Nx/Rush`

### 6.2 Vue 相关技术选型建议

| 维度 | 推荐 | 说明 |
| --- | --- | --- |
| 应用构建 | `Vite` | Vue 生态成熟，开发体验和速度好 |
| 组件开发 | Vue SFC + TS | 与业务代码一致，迁移成本低 |
| 测试 | `Vitest` | 与 Vite 集成自然，速度快 |
| 代码规范 | ESLint + Prettier | 团队协作基础能力 |
| 包发布 | `Changesets` | 多 package 版本管理清晰 |

### 6.3 选型决策原则（你可以直接套用）

按下面优先级决策，不容易选偏：

1. 先满足当前团队规模和复杂度，不做过度设计
2. 优先选择与你现有 Vue 技术栈兼容的工具
3. 优先“可迁移方案”（未来能平滑升级到更重治理方案）
4. 工具数量控制在最少可行集，避免认知负担过高

---

## 7. 推荐目录结构（可直接照抄）

```txt
monorepo-demo/
  apps/
    web/                    # Vue 主应用
  packages/
    ui/                     # Vue 组件库
    utils/                  # 通用工具函数
    eslint-config/          # 共享 ESLint 配置（可选）
    tsconfig/               # 共享 tsconfig（可选）
  package.json
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
```

---

## 8. 从 0 到 1 的实操步骤（命令级）

> 下面是一个“最小可用”流程，你可以先跑通再慢慢增强。

1. 初始化仓库

```bash
mkdir monorepo-demo && cd monorepo-demo
pnpm init
```

2. 配置 workspace

新建 `pnpm-workspace.yaml`：

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

3. 创建 Vue 应用与两个 package

```bash
mkdir -p apps packages
cd apps && pnpm create vite web --template vue-ts
cd ../packages
mkdir ui utils
```

4. 配置 package 命名（示例）

- `packages/ui/package.json` -> `"name": "@repo/ui"`
- `packages/utils/package.json` -> `"name": "@repo/utils"`

5. 在 `apps/web` 中安装内部依赖

```bash
pnpm --filter web add @repo/ui @repo/utils
```

6. 添加 Turborepo

```bash
pnpm add -D turbo -w
```

根目录 `turbo.json`（最小配置）：

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false
    },
    "lint": {},
    "test": {}
  }
}
```

7. 在根目录统一脚本

`package.json` 示例脚本：

```json
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test"
  }
}
```

---

## 9. 你最需要避免的坑（前端常见）

- 包边界混乱：`apps` 里直接引用其他 app 代码
- 路径别名不一致：Vite、TS、测试工具配置各写一套且不统一
- 把所有东西都塞进一个 `shared` 包：后期会变“垃圾场”
- 无测试就抽包：跨项目复用后，回归成本暴涨
- 一上来追求“最完美架构”：导致迟迟不能落地

建议原则：

- 先可用，再优雅
- 先稳定边界，再优化目录
- 先约定脚手架，再推动团队

---

## 10. 学习验收清单（Checklist）

当你能完成以下事项，说明你已具备 Monorepo 实战能力：

- [ ] 独立搭建 Vue Monorepo 并解释关键配置
- [ ] 新增一个 package 并被主应用消费
- [ ] 跑通统一 lint/test/build
- [ ] 理解并演示缓存与增量构建收益
- [ ] 能描述 package 边界和依赖方向
- [ ] 能设计一版团队协作规范（分支、发布、CI）

---

## 11. 下一步建议（按优先级）

1. 用这份文档在本地搭一个最小仓库（今天就做）
2. 从你熟悉的 Vue 业务里抽一个真实模块到 `packages`
3. 接入 Turborepo 缓存并记录构建耗时对比
4. 如果需要对外发布组件库，再加入 Changesets

如果你愿意，我可以下一步直接帮你把这个仓库初始化成一个可运行的 Vue Monorepo 骨架（包括基础目录、`pnpm-workspace.yaml`、`turbo.json`、根脚本和一个简单 `ui` 包示例）。
