# 第 2 周实操记录：从“能跑”到“好协作”

> 配套文档：`week-1-implementation.md`（最小可用骨架）  
> 本文档：把第 2 周“工程化标准化”的完整搭建过程逐步还原。  
> 目标读者：完成第 1 周作业、想进入团队级协作能力建设的开发者。

---

## 0. 本周目标与产出

第 1 周我们解决了“**能跑**”——一个最小可用的 Vue Monorepo。  
第 2 周要解决“**好协作**”——让多人/多包开发在同一套规则下进行，且把这些规则**沉淀成可复用的 package**。

### 本周交付物

新增 3 个内部基础包：

- `@repo/tsconfig`：所有包的 TS 配置基线
- `@repo/eslint-config`：所有包的 ESLint 规则基线（flat config）
- `@repo/vitest-preset`：所有包的 Vitest 预设工厂

为现有 3 个包接入这套基础设施：

- `apps/web`、`packages/ui`、`packages/utils` 都从共享包继承配置
- `packages/utils` 和 `packages/ui` 各自补上单元测试
- 一键脚本：`pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm format`

根目录补充提交侧守护：

- Prettier + EditorConfig：格式统一
- husky + lint-staged：commit 前自动 lint 改动文件
- commitlint：约束提交信息风格

### 一句话总结本周做的事

> **把 ESLint、TypeScript、Vitest 这三类配置从"在每个包各拷一份"，改成"通过依赖一份共享包来继承"。**

---

## 1. 总体设计：为什么把配置做成"package"

第 1 周我们在 [2.4 工程化规范守不住] 里讨论过：**配置一旦被复制成 N 份，就不再是规范，而是 N 份独立演化的副本**。

Monorepo 给了我们一条更优雅的路径：把配置本身当成 npm 包发布到 workspace 内部，其他包通过：

- TypeScript 的 `extends`
- ESLint 的 `import` flat config
- 函数工厂（vitest 预设）

**继承**这些配置。升级配置只改一个地方，所有包同步生效。

这是 Monorepo 真正的杠杆所在——不是更快地构建，而是**更便宜地维护规范**。

---

## 2. 实操步骤

### 步骤 1：共享 TypeScript 配置（`@repo/tsconfig`）

#### 1.1 包结构

```
packages/tsconfig/
├── package.json
├── base.json       # 通用基线
├── vue.json        # Vue 项目变体
└── node.json       # Node 项目变体
```

#### 1.2 `package.json`

```json
{
  "name": "@repo/tsconfig",
  "version": "0.0.0",
  "private": true,
  "files": ["base.json", "vue.json", "node.json"]
}
```

注意：这个包**没有任何代码入口**，只是一组 JSON 文件的集合。pnpm 通过 workspace 链接将它放进消费者的 `node_modules`，TypeScript 的 `extends` 通过 Node resolution 找到。

#### 1.3 `base.json`（通用基线）

```jsonc
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "forceConsistentCasingInFileNames": true,
    "useDefineForClassFields": true,
  },
}
```

几个有意为之的选择：

- `strict: true` + `noUncheckedIndexedAccess`：进一步收紧类型安全
- `moduleResolution: "Bundler"`：现代打包器（Vite/esbuild）通用方案
- `verbatimModuleSyntax: true`：强制 import/export 语法精确，配合 ESLint 可以发现混用 type/value 的问题
- `isolatedModules: true`：保证每个文件可被独立转译，是 esbuild/SWC 的前置条件

#### 1.4 `vue.json` 和 `node.json`

`vue.json`：在 base 基础上加 DOM 相关 lib。

```jsonc
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
  },
}
```

`node.json`：在 base 基础上加 Node 类型。

```jsonc
{
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["node"],
  },
}
```

#### 1.5 关键决策：vite/client 类型放在哪里

第一版我把 `"types": ["vite/client"]` 放在了共享的 `vue.json` 里。但实际跑 `vue-tsc` 时，**组件库 `@repo/ui` 没有依赖 vite，自然找不到这个类型**。

修正：`vite/client` 是**应用层（消费 Vite）**特有的类型，不是 Vue 通用的。最终方案：

- `vue.json` 不引入 vite/client
- `apps/web/tsconfig.json` 在自己这层加上：`"types": ["vite/client"]`

这是一个非常典型的"**共享配置应该共享什么**"的判断：放在共享配置里的内容，必须对所有消费者都成立。

---

### 步骤 2：共享 ESLint 配置（`@repo/eslint-config`）

ESLint 9 已经全面切到 flat config，这是当前主流，新建项目应直接用 flat。

#### 2.1 包结构

```
packages/eslint-config/
├── package.json
├── base.js        # 通用 TS / JS 规则
└── vue.js         # 在 base 之上叠加 Vue 规则
```

#### 2.2 `package.json` 关键设计

```json
{
  "name": "@repo/eslint-config",
  "type": "module",
  "exports": {
    "./base": "./base.js",
    "./vue": "./vue.js"
  },
  "dependencies": {
    "@eslint/js": "^9.13.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-vue": "^9.30.0",
    "globals": "^15.11.0",
    "typescript-eslint": "^8.12.0",
    "vue-eslint-parser": "^9.4.3"
  },
  "peerDependencies": {
    "eslint": "^9.0.0"
  }
}
```

**关键点**：

- 把 ESLint 插件作为这个包的 **dependencies**：消费包不必各自安装一堆插件，只需依赖 `@repo/eslint-config` 即可
- ESLint 本身放 **peerDependencies**：让消费方决定 ESLint 版本，避免多版本共存

这是“配置即依赖”的核心模式：**配置包负责规则版本管理，消费包只关心继承**。

#### 2.3 `base.js`

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, ...globals.es2022 },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  prettier, // 必须在最后，关闭和 Prettier 冲突的格式规则
];
```

`prettier`（即 `eslint-config-prettier`）放在最后是 flat config 的标准做法：它会把所有可能与 Prettier 冲突的规则关掉。

#### 2.4 `vue.js`

```js
import vue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";
import tseslint from "typescript-eslint";
import base from "./base.js";

export default [
  ...base,
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        ecmaVersion: "latest",
        sourceType: "module",
        extraFileExtensions: [".vue"],
      },
    },
    rules: {
      "vue/multi-word-component-names": "off",
      "vue/component-api-style": ["error", ["script-setup"]],
      "vue/component-name-in-template-casing": ["error", "PascalCase"],
      // 关闭与 Prettier 冲突的格式规则（关键！）
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/multiline-html-element-content-newline": "off",
      "vue/html-self-closing": "off",
      "vue/html-indent": "off",
      "vue/html-closing-bracket-newline": "off",
      "vue/html-closing-bracket-spacing": "off",
      "vue/first-attribute-linebreak": "off",
      "vue/attributes-order": "off",
    },
  },
];
```

#### 2.5 我踩到的坑（必须告诉你的）

第一版我没关闭 vue 的格式规则，跑 `pnpm lint` 看到一堆 warning，跑 `--fix` 后 ESLint 把单行 `<RButton>foo</RButton>` 拆成多行。然后 Prettier 又把它合回单行。**两个工具在互掐。**

这是 ESLint + Prettier 集成里非常经典的一个坑。修复原则：

> **格式让 Prettier 管，质量让 ESLint 管。所有 ESLint 的"格式类规则"都该关。**

`eslint-config-prettier` 已经关掉了大部分通用规则，但 `eslint-plugin-vue` 的 Vue 模板格式规则它管不到，需要手动关。

---

### 步骤 3：共享 Vitest 预设（`@repo/vitest-preset`）

#### 3.1 包结构

```
packages/vitest-preset/
├── package.json
├── node.js        # Node 环境工厂
└── vue.js         # Vue + jsdom 工厂
```

#### 3.2 `node.js`

```js
import { defineConfig, mergeConfig } from "vitest/config";

const baseConfig = defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});

/**
 * @param {import("vitest/config").UserConfig} [overrides]
 * @returns {import("vitest/config").UserConfig}
 */
export function createNodeVitestConfig(overrides = {}) {
  return mergeConfig(baseConfig, overrides);
}
```

#### 3.3 我踩到的关键坑：为什么用 `.js` 而不是 `.ts`

第一版我把这两个文件写成 `.ts`。结果跑 `pnpm test` 报：

```
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"
for /.../packages/vitest-preset/vue.ts
```

**根因**：vitest 加载 `vitest.config.ts` 时，会顺着导入链去解析 `@repo/vitest-preset/vue`。包入口指向 `.ts` 文件时，Node 的原生 ESM loader（不是 Vite/esbuild）无法识别 `.ts`。

**修复方案**：

- 把工厂代码改成 `.js`，类型靠 JSDoc 注解保留（`@param`/`@returns`）
- `package.json` 的 `exports` 指向 `.js`

更深的启示：**Monorepo 中"配置层代码"和"业务层代码"的加载机制是不同的**。业务代码由 Vite/Vitest 处理，能吃 TS；但配置文件本身在被加载时，可能走 Node 原生 loader。同样写源码型包，配置类要更保守。

#### 3.4 `vue.js`

```js
import { defineConfig, mergeConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

const baseConfig = defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: { provider: "v8", reporter: ["text", "html"] },
  },
});

export function createVueVitestConfig(overrides = {}) {
  return mergeConfig(baseConfig, overrides);
}
```

#### 3.5 `package.json`：peerDependencies 的精细使用

```json
{
  "name": "@repo/vitest-preset",
  "type": "module",
  "exports": {
    "./node": "./node.js",
    "./vue": "./vue.js"
  },
  "peerDependencies": {
    "vitest": "^2.1.0",
    "@vitejs/plugin-vue": "^5.2.0",
    "jsdom": "^25.0.0"
  },
  "peerDependenciesMeta": {
    "@vitejs/plugin-vue": { "optional": true },
    "jsdom": { "optional": true }
  }
}
```

`peerDependenciesMeta` 的 `optional: true` 意思是：**这些 peer 是可选的**——只在用 `./vue` 入口时才需要。`utils` 这种 Node 测试包就不必装 `@vitejs/plugin-vue` 和 `jsdom`。

---

### 步骤 4：把共享配置接入到 utils / ui / web

每个包接入"三件套"的固定模板：

#### 4.1 `tsconfig.json`

```jsonc
// packages/utils/tsconfig.json
{
  "extends": "@repo/tsconfig/node.json",
  "compilerOptions": { "rootDir": "./src", "noEmit": true },
  "include": ["src"],
}
```

```jsonc
// packages/ui/tsconfig.json
{
  "extends": "@repo/tsconfig/vue.json",
  "compilerOptions": { "rootDir": "./src", "noEmit": true },
  "include": ["src/**/*.ts", "src/**/*.vue"],
}
```

```jsonc
// apps/web/tsconfig.json
{
  "extends": "@repo/tsconfig/vue.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "types": ["vite/client"],
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "src/**/*.d.ts", "vite.config.ts"],
}
```

注意 `apps/web` 自己引入了 `vite/client`，这正是上文讨论过的"共享配置不该耦合应用层细节"。

#### 4.2 `eslint.config.js`（每个包都是 2 行）

```js
// packages/utils/eslint.config.js
import base from "@repo/eslint-config/base";
export default base;
```

```js
// packages/ui/eslint.config.js  和  apps/web/eslint.config.js
import vueConfig from "@repo/eslint-config/vue";
export default vueConfig;
```

**这就是"配置即依赖"的最终效果**：配置文件被压缩到 2 行。

#### 4.3 `vitest.config.ts`

```ts
// packages/utils/vitest.config.ts
import { createNodeVitestConfig } from "@repo/vitest-preset/node";
export default createNodeVitestConfig();
```

```ts
// packages/ui/vitest.config.ts
import { createVueVitestConfig } from "@repo/vitest-preset/vue";
export default createVueVitestConfig();
```

#### 4.4 各包的 `package.json` 脚本

每个被 lint / 测试的包，需要补三个标准脚本：

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

**注意**：

- Vue 包的 `typecheck` 用 `vue-tsc --noEmit` 而不是 `tsc`
- `lint:fix` 必须作为单独脚本，下文解释为什么

---

### 步骤 5：写第一批单元测试

#### 5.1 `packages/utils/src/index.test.ts`（6 个用例）

```ts
import { describe, expect, it } from "vitest";
import { classNames, formatDate, sleep } from "./index";

describe("formatDate", () => {
  it("formats a date in zh-CN by default", () => {
    const date = new Date("2026-04-26T00:00:00Z");
    expect(formatDate(date)).toMatch(/2026/);
  });
  // ...
});

describe("classNames", () => {
  it("joins truthy values with spaces", () => {
    expect(classNames("a", "b", "c")).toBe("a b c");
  });
  // ...
});

describe("sleep", () => {
  it("resolves after the given duration", async () => {
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });
});
```

#### 5.2 `packages/ui/src/Button.test.ts`（4 个用例）

```ts
import { mount } from "@vue/test-utils";
import Button from "./Button.vue";

describe("Button", () => {
  it("emits click event on click", async () => {
    const wrapper = mount(Button, { slots: { default: "ok" } });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
  });

  it("does not emit click when disabled", async () => {
    const wrapper = mount(Button, {
      props: { disabled: true },
      slots: { default: "ok" },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeUndefined();
  });
});
```

#### 5.3 顺手补上的健壮性改进

为了让"禁用按钮不触发 click"这个测试稳定，我给 Button 加了一道防御逻辑：

```vue
<script setup lang="ts">
const emit = defineEmits<{ (event: "click", payload: MouseEvent): void }>();
function onClick(event: MouseEvent) {
  if (props.disabled) return;
  emit("click", event);
}
</script>
<template>
  <button :class="cls" :disabled="disabled" @click="onClick">
    <slot />
  </button>
</template>
```

这是"**有了测试以后，代码自然变得更健壮**"的典型场景。原本 `disabled` 属性靠浏览器原生行为阻止 click，但**程序化触发**（模拟测试、键盘合成事件等）可能绕过它。加一行防御让组件在所有路径都正确。

---

### 步骤 6：根目录工程化（Prettier、EditorConfig、统一脚本）

#### 6.1 `.prettierrc.json`

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5",
  "printWidth": 80,
  "tabWidth": 2,
  "endOfLine": "lf"
}
```

#### 6.2 `.prettierignore`

```
node_modules
dist
coverage
pnpm-lock.yaml
```

#### 6.3 `.editorconfig`

跨编辑器的最低共识，避免不同人用不同 IDE 引入隐形格式差异：

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

#### 6.4 根 `package.json` 的统一脚本（最终版）

```json
{
  "scripts": {
    "dev": "pnpm --filter web dev",
    "build": "pnpm -r --filter \"./packages/*\" --filter web run build",
    "preview": "pnpm --filter web preview",
    "lint": "pnpm -r --parallel run lint",
    "lint:fix": "pnpm -r --parallel run lint:fix",
    "typecheck": "pnpm -r --parallel run typecheck",
    "test": "pnpm -r --parallel run test",
    "format": "prettier --write \"**/*.{ts,tsx,vue,js,json,md,yml,yaml}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,vue,js,json,md,yml,yaml}\"",
    "prepare": "husky"
  }
}
```

#### 6.5 一个细节坑：`lint:fix` 为什么不用 `exec`

第一版我写的是：

```bash
pnpm -r --parallel exec eslint . --fix
```

它会在**每个 workspace 包**里跑 `eslint . --fix`，包括 `@repo/tsconfig`、`@repo/eslint-config` 这些**没有 ESLint 配置**的包，于是报错。

修复方案：让每个需要 lint 的包自己定义 `lint:fix` 脚本，根目录用 `pnpm -r --parallel run lint:fix`。`run` 会**自动跳过没有该脚本的包**。

**经验**：在 Monorepo 里写跨包脚本，**优先用 `run` 而不是 `exec`**，因为 `run` 的"按脚本筛选"能力让脚本边界更清晰。

---

### 步骤 7：commit 时刻的守护（husky + lint-staged + commitlint）

#### 7.1 安装与初始化

根目录依赖：

```json
{
  "devDependencies": {
    "@commitlint/cli": "^19.5.0",
    "@commitlint/config-conventional": "^19.5.0",
    "husky": "^9.1.6",
    "lint-staged": "^15.2.10",
    "prettier": "^3.3.3"
  },
  "scripts": { "prepare": "husky" }
}
```

`prepare` 是 npm 生命周期钩子，会在 `pnpm install` 后自动执行，**husky 借此自动初始化 `.husky/` 目录**——团队成员 clone 后跑 install，hook 就装好了，不需要额外指令。

#### 7.2 lint-staged 配置（写在根 package.json）

```json
{
  "lint-staged": {
    "*.{ts,tsx,vue,js}": ["prettier --write", "eslint --fix"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

**核心思想**：commit 前只检查**改动的文件**，不全仓扫描。这是大型 Monorepo 保持 commit 体感的关键。

#### 7.3 husky hooks

`.husky/pre-commit`：

```bash
pnpm exec lint-staged
```

`.husky/commit-msg`：

```bash
pnpm exec commitlint --edit "$1"
```

记得 `chmod +x` 让它们可执行。

#### 7.4 `commitlint.config.js`

```js
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "subject-case": [0],
  },
};
```

约束 commit 信息为 Conventional Commits 风格（`feat:` / `fix:` / `chore:` 等），但允许中文 subject（关掉了 case 检查）。

---

### 步骤 8：本周验收（一键全跑）

预期所有命令 0 错误：

```bash
pnpm lint        # 0 errors, 0 warnings
pnpm typecheck   # 全部包通过
pnpm test        # utils 6/6, ui 4/4
pnpm build       # 构建产物正常
```

实际执行结果（节选）：

```
=== TEST ===
packages/utils test:  ✓ src/index.test.ts (6 tests) 33ms
packages/ui    test:  ✓ src/Button.test.ts (4 tests) 17ms

=== BUILD ===
apps/web build: ✓ 17 modules transformed.
apps/web build: dist/assets/index-*.js   63.49 kB │ gzip: 25.57 kB
apps/web build: ✓ built in 302ms
```

---

## 3. 完整最终目录

```
monorepo-demo/
├── .editorconfig
├── .gitignore
├── .husky/
│   ├── pre-commit
│   └── commit-msg
├── .prettierrc.json
├── .prettierignore
├── commitlint.config.js
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── apps/
│   └── web/
│       ├── eslint.config.js
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│           ├── App.vue
│           ├── env.d.ts
│           └── main.ts
└── packages/
    ├── eslint-config/
    │   ├── base.js
    │   ├── package.json
    │   └── vue.js
    ├── tsconfig/
    │   ├── base.json
    │   ├── node.json
    │   ├── package.json
    │   └── vue.json
    ├── vitest-preset/
    │   ├── node.js
    │   ├── package.json
    │   └── vue.js
    ├── ui/
    │   ├── eslint.config.js
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vitest.config.ts
    │   └── src/
    │       ├── Button.test.ts
    │       ├── Button.vue
    │       └── index.ts
    └── utils/
        ├── eslint.config.js
        ├── package.json
        ├── tsconfig.json
        ├── vitest.config.ts
        └── src/
            ├── index.test.ts
            └── index.ts
```

---

## 4. 本周必须吃透的 5 个核心理念

### 4.1 配置即依赖

把 tsconfig / eslint / vitest 配置做成 package，让消费方通过依赖关系继承。**升级一处，全仓生效**。

### 4.2 共享配置只该共享"普适"内容

`vue/client` 类型是应用层细节，不该放在共享 `vue.json` 里。**判断一段配置是否应该共享，标准是"它对所有消费者都成立吗"**。

### 4.3 ESLint 与 Prettier 严格分工

- ESLint 管"代码质量"（未使用变量、类型错用、潜在 bug）
- Prettier 管"代码格式"（缩进、引号、行宽）
- 在 ESLint 配置最后一项放 `eslint-config-prettier` 关掉冲突
- 对 `eslint-plugin-vue` 的格式规则要**手动**关（它绕过了 prettier 的关闭机制）

### 4.4 配置层代码要更保守

业务代码可以用 TS 源码 + bundler 处理；但配置文件可能由 Node 原生 loader 加载，**这时候 `.ts` 入口会爆**。配置工厂用 `.js` + JSDoc 类型注解最稳。

### 4.5 commit 守护应只检查改动的文件

lint-staged 的核心价值不是"跑 lint"，而是"**只跑改动文件的 lint**"。commit 体感保持秒级，团队才会真正坚持使用。

---

## 5. 常见坑与排查清单

| 现象                                                 | 根因                                           | 修复                               |
| ---------------------------------------------------- | ---------------------------------------------- | ---------------------------------- |
| `Cannot find type definition file for 'node'`        | 引用了 `node.json` 但没装 `@types/node`        | 给消费包装 `@types/node`           |
| `Cannot find type definition file for 'vite/client'` | 共享配置过早引入 vite 类型                     | 把 vite/client 移到应用层 tsconfig |
| `ERR_UNKNOWN_FILE_EXTENSION ".ts"`                   | 配置工厂包入口是 `.ts`，被 Node 原生加载       | 改成 `.js`，用 JSDoc 类型          |
| ESLint --fix 后 Prettier 又改回去                    | `eslint-plugin-vue` 的格式规则与 Prettier 冲突 | 在 vue.js 中显式关掉相关规则       |
| `pnpm -r exec` 在某些包上失败                        | exec 会在所有包跑，没有的报错                  | 改用 `pnpm -r run <script>`        |

---

## 6. 你可以立刻验证的事

1. `pnpm test`：看到 utils 6/6、ui 4/4 全部通过
2. `pnpm typecheck`：所有包 type 干净
3. `pnpm lint`：0 errors, 0 warnings
4. 故意改个 `Button.vue` 的代码不通过 lint，再 `git add . && git commit -m "test"`，看 husky 是否拦住
5. 用一个不规范的 commit message（如 `xxx` 而不是 `feat: xxx`），看 commitlint 是否拦住

---

## 7. 第 3 周预告

第 2 周我们让仓库"协作得起来"。第 3 周聚焦"**跑得起来 + 发得出去**"：

- 引入 Turborepo：任务编排 + 缓存（亲眼看到缓存收益）
- 学习 affected：CI 上只跑必要任务
- 引入 Changesets：模拟一次完整的版本发布流程
- （可选）研究 turbo 的远端缓存

完成本周作业（如果有）后，告诉我即可开启第 3 周。
