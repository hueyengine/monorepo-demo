# 第 1 周实操记录：从 0 到 1 搭建 Vue Monorepo

> 配套文档：`monorepo-vue-learning-guide.md`（理论与路线）  
> 本文档：把第 1 周“最小可用 Vue Monorepo”的完整搭建过程逐步还原，带每一步的文件内容、设计决策和验证方法。  
> 适用读者：Vue 前端工程师，刚开始接触 Monorepo。

---

## 0. 本周目标与产出

**目标**：用 `pnpm workspace` 搭出一个最小可运行的 Vue Monorepo，先**不引入 Turborepo**，专注理解 Monorepo 本身。

**最终产出物**：

- 1 个 Vue 主应用：`apps/web`
- 2 个内部包：`packages/ui`（Vue 组件库）、`packages/utils`（纯 TS 工具）
- 主应用通过 `workspace:*` 协议引用两个内部包，HMR 即时生效
- 根目录提供统一脚本：`pnpm dev`、`pnpm build`、`pnpm preview`

**有意暂不引入的内容**（留给第 2、3 周）：

- TypeScript 严格类型检查、统一 `tsconfig`
- ESLint / Prettier / Vitest
- Turborepo 任务编排与缓存
- Changesets 版本发布

---

## 1. 前置环境检查

确认本地环境满足要求：

```bash
node -v     # >= 18，建议 20 或 22
pnpm -v     # >= 8，建议 9.x
```

本次实操使用：`Node v22.22.2` + `pnpm 9.10.0`。

如未安装 pnpm：

```bash
npm i -g pnpm
```

---

## 2. 整体设计（动手前先想清楚）

在写一行代码之前，先确定这几件事：

### 2.1 目录结构

```
monorepo-demo/
├── apps/
│   └── web/              # Vue 主应用
└── packages/
    ├── ui/               # Vue 组件包
    └── utils/            # 通用工具包
```

约定：`apps/*` 是“可独立运行的产品”，`packages/*` 是“被复用的库”。这是前端 Monorepo 业界主流分法。

### 2.2 包命名

- `apps/web` → name: `web`
- `packages/ui` → name: `@repo/ui`
- `packages/utils` → name: `@repo/utils`

`@repo/*` 只是一个 npm scope 风格的命名约定，**没有实际发布**到 npm，仅作为内部包名前缀，方便区分。

### 2.3 关键技术决策

| 决策点                   | 选择                   | 理由                                         |
| ------------------------ | ---------------------- | -------------------------------------------- |
| 包管理器                 | pnpm                   | workspace 支持成熟，磁盘占用低，软链机制清晰 |
| 是否引入 Turborepo       | **否**                 | 学习期保持工具最少集，先理解 pnpm workspace  |
| 内部包是否需要构建       | **否**（直接消费源码） | 主应用 Vite 直接转译 TS/Vue，HMR 立即生效    |
| Vue 在组件包中的依赖类型 | `peerDependencies`     | 避免多 Vue 实例引发的 inject/hydration 异常  |
| TypeScript               | 用，但不严格校验       | 第 1 周聚焦“能跑通”，类型基建放第 2 周       |

---

## 3. 实操步骤

### 步骤 1：创建根目录配置

**目标**：声明 workspace、提供根脚本入口、忽略无关文件。

#### 1.1 `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**作用**：告诉 pnpm 哪些目录属于 workspace。pnpm 会把这些目录里的 `package.json` 视为本仓库内部包，可被互相引用。

#### 1.2 根 `package.json`

```json
{
  "name": "monorepo-demo",
  "version": "0.0.0",
  "private": true,
  "description": "Vue monorepo learning playground",
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm -r --filter \"./packages/*\" --filter web run build",
    "preview": "pnpm --filter web preview"
  },
  "engines": {
    "node": ">=18"
  },
  "packageManager": "pnpm@9.10.0"
}
```

**关键点**：

- `"private": true`：根包不会被发布
- `--filter web`：把命令转发给 `apps/web`
- `-r --filter "./packages/*" --filter web run build`：递归构建所有 `packages/*`，再构建 `web`；pnpm 会按依赖图自动排序
- `packageManager`：锁定 pnpm 版本，避免团队成员用不同版本导致 lockfile 漂移

#### 1.3 `.gitignore`

```gitignore
node_modules
dist
.DS_Store
*.log
.vscode/*
!.vscode/extensions.json
.env
.env.local
```

**注意**：Monorepo 里 `node_modules` 会出现在多个层级（根 + 每个包），都需要忽略。`*` 通配 `.gitignore` 会自动应用到所有子目录，无需重复声明。

---

### 步骤 2：创建 `packages/utils`（最简单，先打通流程）

**目标**：建一个最纯粹的内部包，验证 workspace 引用机制。

#### 2.1 `packages/utils/package.json`

```json
{
  "name": "@repo/utils",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "scripts": {
    "build": "echo \"(utils) source-only package, no build needed\""
  }
}
```

**这里有个非常重要的设计**：

`main` / `exports` 直接指向 `./src/index.ts`，**而不是 `./dist/index.js`**。

这意味着：内部包**不需要构建步骤**。

- 优点：写完代码立即可用，HMR 秒级生效，不存在“忘了 build”的问题
- 限制：仅适用于 Monorepo 内部消费；如果要发布到 npm，必须额外加 build 输出 ESM/CJS/d.ts

`build` 脚本写一个 `echo` 是为了让根目录的 `pnpm build` 不报“missing script”错误，并保留扩展位（以后真要加构建时改这一行即可）。

#### 2.2 `packages/utils/src/index.ts`

```ts
export function formatDate(date: Date, locale = "zh-CN"): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function classNames(
  ...args: Array<string | false | null | undefined>
): string {
  return args.filter(Boolean).join(" ");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

三个最常用的工具函数，足以让 `ui` 和 `web` 各自消费一遍，验证依赖链路。

---

### 步骤 3：创建 `packages/ui`（Vue 组件包）

**目标**：包含一个真实可用的 Vue 组件，并消费 `@repo/utils`，让我们提前看到“包之间互相依赖”的样子。

#### 3.1 `packages/ui/package.json`

```json
{
  "name": "@repo/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts"
    }
  },
  "scripts": {
    "build": "echo \"(ui) source-only package, no build needed\""
  },
  "peerDependencies": {
    "vue": "^3.5.0"
  },
  "dependencies": {
    "@repo/utils": "workspace:*"
  }
}
```

**两个关键点**：

1. `vue` 放在 `peerDependencies`：组件库不应自带 Vue，否则消费者和组件库可能各持有一份 Vue 实例，引发 `inject not found`、组件状态不同步、SSR hydration mismatch 等诡异 bug。
2. `@repo/utils` 用 `workspace:*` 协议：告诉 pnpm 去本仓库找这个包，pnpm 会用软链接方式连进 `packages/ui/node_modules`。

#### 3.2 `packages/ui/src/index.ts`

```ts
export { default as RButton } from "./Button.vue";
```

包入口只做一件事：**re-export**。  
将来加更多组件，统一从 `index.ts` 收口，对外暴露的 API 形态稳定。

#### 3.3 `packages/ui/src/Button.vue`

```vue
<script setup lang="ts">
import { computed } from "vue";
import { classNames } from "@repo/utils";

type ButtonType = "primary" | "default";

const props = withDefaults(
  defineProps<{
    type?: ButtonType;
    disabled?: boolean;
  }>(),
  {
    type: "default",
    disabled: false,
  }
);

defineEmits<{
  (event: "click", payload: MouseEvent): void;
}>();

const cls = computed(() =>
  classNames(
    "r-button",
    `r-button--${props.type}`,
    props.disabled && "r-button--disabled"
  )
);
</script>

<template>
  <button :class="cls" :disabled="disabled" @click="$emit('click', $event)">
    <slot />
  </button>
</template>

<style scoped>
/* ...样式略，详见源文件... */
</style>
```

**值得关注的点**：

- 组件代码里直接 `import { classNames } from "@repo/utils"`，这就是“跨包消费”的真实场景
- `<style scoped>`：组件样式不污染外部，主应用集成时无需担心样式冲突
- 用 TS 定义 props/emits，让消费侧获得类型提示

---

### 步骤 4：创建 `apps/web`（Vue 主应用）

**目标**：用 Vite 启动 Vue 应用，并同时消费 `@repo/ui` 与 `@repo/utils`。

#### 4.1 `apps/web/package.json`

```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview --port 4173"
  },
  "dependencies": {
    "vue": "^3.5.0",
    "@repo/ui": "workspace:*",
    "@repo/utils": "workspace:*"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.0",
    "vite": "^6.0.0"
  }
}
```

**为什么 `web` 同时直接依赖 `@repo/utils`？**  
即便 `@repo/ui` 内部已经依赖了 `utils`，主应用如果**自己也要直接用** `utils`，就应该明确声明依赖。  
原则：**用谁就显式声明谁**，否则代码可读性和长期可维护性都会变差。

#### 4.2 `apps/web/vite.config.ts`

```ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
  },
});
```

最小 Vite 配置。Vite 默认支持 TS、ESM、Workspace 内的源码消费，**无需额外路径别名**。  
这正是“包入口指向源码 + Vite”的组合优势。

#### 4.3 `apps/web/index.html`

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Monorepo Demo - Web</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

#### 4.4 `apps/web/src/main.ts`

```ts
import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");
```

#### 4.5 `apps/web/src/App.vue`

主应用展示页，同时使用了两个内部包：

```vue
<script setup lang="ts">
import { ref } from "vue";
import { RButton } from "@repo/ui";
import { formatDate } from "@repo/utils";

const count = ref(0);
const today = formatDate(new Date());

function inc() {
  count.value += 1;
}
</script>

<template>
  <main class="page">
    <h1>Vue Monorepo Demo</h1>
    <p class="meta">今天是 {{ today }}</p>

    <section class="card">
      <p>当前计数：{{ count }}</p>
      <div class="row">
        <RButton type="primary" @click="inc">+1</RButton>
        <RButton @click="count = 0">重置</RButton>
        <RButton disabled>禁用按钮</RButton>
      </div>
    </section>
  </main>
</template>
```

**这一步完成后的依赖关系**：

```
apps/web
  ├─> @repo/ui  ─┐
  └─> @repo/utils
                 ↑
       @repo/ui ─┘   (ui 也消费 utils)
```

`utils` 是叶子节点（不依赖其他内部包），`ui` 依赖 `utils`，`web` 同时依赖 `ui` 和 `utils`。  
这种**单向依赖图**是健康 Monorepo 的基础。

---

### 步骤 5：安装依赖并验证

#### 5.1 安装

```bash
pnpm install
```

预期结果：

- pnpm 自动识别 4 个 workspace 项目（root + 3 个子包）
- `workspace:*` 引用通过软链接接入，不会真的去 npm 下载
- 根目录生成单一 `pnpm-lock.yaml`（整个仓库共享）

#### 5.2 构建验证

```bash
pnpm build
```

预期：

- 先跑两个内部包的 `build`（仅打印 echo）
- 再跑 `apps/web` 的 `vite build`
- 最终在 `apps/web/dist/` 生成产物

实际输出（节选）：

```
apps/web build: vite v6.4.2 building for production...
apps/web build: ✓ 17 modules transformed.
apps/web build: dist/index.html                  0.41 kB
apps/web build: dist/assets/index-*.css          1.15 kB
apps/web build: dist/assets/index-*.js          63.47 kB
apps/web build: ✓ built in 335ms
```

#### 5.3 启动开发服务器

```bash
pnpm dev
```

浏览器打开 `http://localhost:5173/` 即可看到页面。

#### 5.4 验证 HMR 联动（必做）

这是 Monorepo 真正的开发体验所在，强烈建议你亲自试一遍：

1. 保持 dev server 运行
2. 修改 `packages/ui/src/Button.vue` 的样式（比如改主题色）
3. 浏览器**立即**看到变化，无需重启
4. 再改 `packages/utils/src/index.ts` 的 `formatDate` 实现（比如换分隔符），主应用页面上的日期同步更新

如果以上四步都通过，第 1 周目标达成。

---

## 4. 完整最终目录

```
monorepo-demo/
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml                  (pnpm install 后生成)
├── monorepo-vue-learning-guide.md  (理论文档)
├── week-1-implementation.md        (本文档)
├── apps/
│   └── web/
│       ├── package.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.ts
│           └── App.vue
└── packages/
    ├── ui/
    │   ├── package.json
    │   └── src/
    │       ├── index.ts
    │       └── Button.vue
    └── utils/
        ├── package.json
        └── src/
            └── index.ts
```

---

## 5. 本周必须吃透的 5 个核心概念

### 5.1 workspace 协议（`workspace:*`）

告诉 pnpm “这个依赖在本仓库内”，不要去 npm 找。pnpm 通过**符号链接**把它接入消费者的 `node_modules`。

### 5.2 包入口指向源码

`main` / `exports` 不指 `dist`，直接指 `src/index.ts`。让 Vite 直接消费源码，省去 build 步骤，HMR 立即生效。  
对外发布场景下不能这么做（消费者拿到的是源码，无法运行）。

### 5.3 peerDependencies 防止 Vue 实例分裂

`@repo/ui` 不直接依赖 Vue，而是声明 peer。Vue 由 `apps/web` 提供，全仓只有一份 Vue 实例。

### 5.4 单一锁文件 + 单次安装

整个 Monorepo 只有一个 `pnpm-lock.yaml`，一次 `pnpm install` 处理全部子包。版本一致性由 lockfile 保证。

### 5.5 单向依赖图

`web → ui → utils`、`web → utils` 都是单向的。一旦出现循环依赖（A → B → A），构建顺序会失败、类型推导也会出问题。**早期就要建立“分层”思维**。

---

## 6. 常见疑问与小坑

### Q1：为什么不用 `pnpm create vite` 直接生成 web？

可以这么做，但脚手架生成的 `tsconfig.json`、`env.d.ts` 等模板很容易让人“知其然不知其所以然”。手写最小骨架更利于学习。等到第 2 周做工程化时，再补齐这些文件。

### Q2：HMR 没生效？

最常见的两个原因：

1. 包入口 `main` 指向的是 `dist/...` 而不是 `src/...`，Vite 在跑构建产物
2. 消费方在 `import` 时用了相对路径（如 `../../packages/ui/src/Button.vue`），绕过了包名解析

修复方法：始终用 `@repo/xxx` 这种包名引用。

### Q3：`Cannot find module '@repo/ui'`？

检查清单：

- 是否运行过 `pnpm install`
- `packages/ui/package.json` 的 `name` 是否就是 `@repo/ui`
- `apps/web/package.json` 的 `dependencies` 里是否声明了 `"@repo/ui": "workspace:*"`

### Q4：根目录 `pnpm build` 报 `missing script: build`？

每个 workspace 包必须都有 `build` 脚本。源码型包可以用 `echo "no build"` 占位，避免根目录递归构建时报错。

---

## 7. 你可以立刻动手的 3 个小作业

加深理解，建议都做一遍：

1. **加工具函数**：在 `packages/utils` 加 `truncate(str, n)`，在 `App.vue` 里用起来
2. **加新组件**：在 `packages/ui` 新增 `RTag`，并在 `App.vue` 渲染若干个标签
3. **玩转 filter 命令**：尝试 `pnpm --filter @repo/utils ls`、`pnpm --filter ...@repo/ui build`（注意 `...` 表示“所有依赖它的包”）

完成后，你对 pnpm workspace 的核心机制就基本掌握了。

---

## 8. 下一步：第 2 周做什么

第 2 周聚焦“可协作”，围绕“**约定 + 检查**”展开：

- 统一 `tsconfig`：建立 `packages/tsconfig`，让所有包从一个基线继承
- 统一 ESLint + Prettier：建立 `packages/eslint-config`，全仓共享规则
- 引入 Vitest：在 `utils` 和 `ui` 中编写第一个单元测试
- 配置根目录 `lint` / `test` 脚本，跑通跨包检查
- （可选）引入 husky + commitlint，约束提交规范

完成第 1 周作业之后，告诉我即可开启第 2 周。
