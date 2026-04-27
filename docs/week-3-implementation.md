# 第 3 周实操记录：从"好协作"到"好规模"

> 目标：在第 1、2 周搭好的"能跑、好协作"骨架上，把 Monorepo 推到"**规模化可控**"——
>
> - 引入 **Turborepo**，让 build / test / lint / typecheck **可缓存、可增量、可过滤**
> - 引入 **Changesets**，让多包**版本号 / changelog / 发布**有完整、可审计的工作流
>
> 一句话总结这一周做的事：**让"无变化的活儿"不再做第二次，让"有变化的发布"被显式记录。**

---

## 0. 本周目标与产出

| 维度       | 第 2 周末状态                | 第 3 周末状态                                                    |
| ---------- | ---------------------------- | ---------------------------------------------------------------- |
| 任务编排   | `pnpm -r --parallel run xxx` | `turbo run xxx`，自动构建任务图、并行调度                        |
| 缓存       | 没有，每次都重跑             | 本地内容哈希缓存：build/test/lint/typecheck，**最快 14ms**       |
| 影响范围   | 全量跑                       | `--filter=...@repo/utils` / `--filter='[HEAD^1]'`，只跑 affected |
| 多包版本号 | 手动改 `package.json`        | `changeset add` → `changeset version` 自动 bump + 生成 CHANGELOG |
| 内部依赖   | 升级时容易漏改下游 `^x.y.z`  | `updateInternalDependencies: "patch"` 自动同步                   |
| 发布       | 概念上知道要发，但没流程     | `changeset publish` + private 自动跳过；接入 CI 即可托管化       |

最终产物（新增/改动的文件）：

```
monorepo-demo/
├── turbo.json                                # ✨ 新增：任务图 + 缓存策略
├── package.json                              # ⬆️ 改：脚本切到 turbo；新增 changeset 相关脚本
├── .gitignore                                # ⬆️ 改：忽略 .turbo
├── .changeset/
│   ├── README.md                             # ✨ 新增（changeset init 生成）
│   ├── config.json                           # ✨ 新增（changeset init 生成）
│   └── swift-fox-introduces-cache.md         # ✨ 新增：本周演示用 changeset
└── packages/
    ├── utils/
    │   ├── package.json                      # ⬆️ 改：0.1.0 → 0.2.0
    │   └── CHANGELOG.md                      # ✨ 新增（changeset version 生成）
    └── ui/
        ├── package.json                      # ⬆️ 改：0.1.0 → 0.1.1（跟随依赖）
        └── CHANGELOG.md                      # ✨ 新增（changeset version 生成）
```

---

## 1. 总体设计：为什么是 Turbo + Changesets

### 1.1 第 2 周的真实痛点

第 2 周末我们已经能这样跑：

```bash
pnpm lint          # = pnpm -r --parallel run lint
pnpm typecheck     # = pnpm -r --parallel run typecheck
pnpm test          # = pnpm -r --parallel run test
pnpm build         # = pnpm -r --filter "./packages/*" --filter web run build
```

但每次都是**全量重跑**。一个只改了 `apps/web` 文档注释的提交，本地和 CI 上都会：

- 跑 `@repo/utils` 的 lint
- 跑 `@repo/utils` 的 test
- 跑 `@repo/ui` 的 lint
- 跑 `@repo/ui` 的 test
- 跑 `@repo/ui` 的 typecheck
- 跑 `apps/web` 的 build
- ...

3 个包的项目还能忍。30 个包的项目，CI 时长会从分钟级走到 10 分钟级。**这是规模化的第一道墙。**

### 1.2 我们要的两件事

1. **任务编排器（Task Runner）**：基于"内容哈希"做缓存，决定哪些任务可以跳过。
2. **版本/发布编排器（Release Tool）**：在多包仓库里做"原子化版本变更 + 自动 changelog"。

这两件事是正交的，但**都解决"协作放大"的成本问题**：

- Turbo 解决"机器协作"（CI、本地、跨设备）的浪费
- Changesets 解决"人协作"（发版、跨包改动追溯）的混乱

### 1.3 选型确认

| 角色        | 选择           | 为什么不是别的                                                                  |
| ----------- | -------------- | ------------------------------------------------------------------------------- |
| Task Runner | **Turborepo**  | Nx 更强但学习成本高；Rush 偏中后台。Turbo 最贴近"pnpm workspace + 配置即可"心智 |
| Release     | **Changesets** | npm 公开发布的事实标准，跟 Turbo / pnpm 配合无摩擦                              |

---

## 2. 实操步骤

### 步骤 1：安装 Turborepo

```bash
pnpm add -Dw turbo
```

`-Dw` 表示装到根 workspace（root）的 devDependencies，**不要装到子包里**——它是仓库级工具。

### 步骤 2：编写 `turbo.json`

这是第 3 周最关键的文件。它定义了：

- 哪些任务存在
- 任务之间有什么依赖关系（task graph）
- 每个任务的输入文件是什么（决定缓存哈希）
- 每个任务的输出文件是什么（被缓存的内容）

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "ui": "tui",
  "globalDependencies": [
    "tsconfig.base.json",
    ".prettierrc.json",
    ".editorconfig"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "inputs": [
        "src/**",
        "index.html",
        "package.json",
        "tsconfig.json",
        "vite.config.ts"
      ]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "inputs": ["src/**", "package.json", "vitest.config.ts", "tsconfig.json"]
    },
    "lint": {
      "dependsOn": [],
      "outputs": [],
      "inputs": [
        "src/**",
        "*.vue",
        "*.ts",
        "*.js",
        "eslint.config.js",
        "package.json"
      ]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "outputs": [],
      "inputs": ["src/**", "*.vue", "tsconfig.json", "package.json"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

#### 关键概念解释

| 概念                    | 含义                                                                       | 例子                                          |
| ----------------------- | -------------------------------------------------------------------------- | --------------------------------------------- |
| `dependsOn: ["^build"]` | "上游所有 workspace 依赖的 build 必须先跑"。`^` 前缀 = upstream 的同名任务 | `web` 依赖 `@repo/ui`，构建 web 前先 build ui |
| `dependsOn: ["lint"]`   | 不带 `^`，就是同包内别的 task 先跑                                         | `build` 前先 lint 当前包                      |
| `inputs`                | 内容变化才会让缓存失效；**不在列表里的文件改了也不会失效**                 | `README.md` 改了不会失效 build 缓存           |
| `outputs`               | 任务成功后会被缓存的产物；下次命中后会从缓存中**还原这些文件**             | `dist/**`                                     |
| `cache: false`          | 永远不缓存（dev / start 这种长进程）                                       | dev                                           |
| `persistent: true`      | 长驻进程；turbo 知道不要等它"退出"才算结束                                 | dev                                           |
| `globalDependencies`    | 仓库级别的"全局输入"，一旦改动会让**所有任务**缓存失效                     | `.prettierrc.json` 改了，所有 lint 重跑       |

#### 我们项目的 task graph 长这样

```
                    ┌────────────┐
                    │ web:build  │
                    └─────┬──────┘
                          │ ^build
                ┌─────────┴─────────┐
                ▼                   ▼
         ┌──────────────┐    ┌──────────────┐
         │ @repo/ui     │    │ @repo/utils  │
         │ build        │    │ build        │
         └──────┬───────┘    └──────────────┘
                │ ^build
                ▼
         ┌──────────────┐
         │ @repo/utils  │
         │ build        │
         └──────────────┘
```

> Turbo 自己从 `package.json` 的 `dependencies` / `devDependencies` 推断这张图，**我们不用手写**。

### 步骤 3：根脚本切到 Turbo

```jsonc
// package.json
{
  "scripts": {
    "dev": "turbo run dev --filter=web",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",

    "lint:fix": "pnpm -r --parallel run lint:fix",
    "preview": "pnpm --filter web preview",
    "format": "prettier --write \"**/*.{ts,tsx,vue,js,json,md,yml,yaml}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,vue,js,json,md,yml,yaml}\"",
    "clean": "rm -rf .turbo apps/*/.turbo packages/*/.turbo apps/*/dist packages/*/dist",

    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "turbo run build --filter='./packages/*' && changeset publish",

    "prepare": "husky",
  },
}
```

注意几个细节：

- **`lint:fix` 没切到 turbo**：因为 `lint:fix` 会**修改文件**，跟 turbo 缓存语义不一致（缓存假设任务幂等）。继续用 pnpm 即可。
- **`release` 是组合命令**：先用 turbo 把所有需要发布的 packages 构建完，再 publish。turbo 的过滤器保证只构建 `packages/*`，不会去 build 内部 app。

### 步骤 4：忽略 `.turbo` 目录

```gitignore
node_modules
dist
.turbo
.DS_Store
...
```

`.turbo` 是 turbo 在每个包下面创建的本地缓存元数据目录，**绝对不要进 git**。

---

## 3. 实测：缓存到底有多快

下面这组数字是在我本机直接跑出来的。

### 3.1 Build：冷启动 vs 热缓存

```bash
# 1) 清掉所有缓存和构建产物
$ pnpm clean

# 2) 第一次：冷启动
$ time pnpm build
...
 Tasks:    3 successful, 3 total
Cached:    0 cached, 3 total
  Time:    1.201s
real    0m3.72s

# 3) 第二次：什么都没改，再跑一次
$ time pnpm build
...
 Tasks:    3 successful, 3 total
Cached:    3 cached, 3 total
  Time:    14ms >>> FULL TURBO
real    0m0.39s
```

**85× 提速。**`>>> FULL TURBO` 是 turbo 全部命中缓存时的彩蛋——在 CI 上看到这个就说明你今天没欠多余的活儿。

### 3.2 Test / Lint 同样的曲线

| 任务  | 冷启动  | 热缓存 | 提速  |
| ----- | ------- | ------ | ----- |
| build | 1201 ms | 14 ms  | ~85×  |
| test  | 1499 ms | 14 ms  | ~107× |
| lint  | 1209 ms | 14 ms  | ~86×  |

> 这是 3 个 package 的小项目。**包数越多、单任务越慢，加速比越离谱**——这是为什么 Turbo 在中大型仓库里几乎是必选项。

### 3.3 改动一个内容，验证"精准失效"

给 `packages/utils/src/index.ts` 加一行注释（**真实内容变化**，而不是 `touch`），再跑：

```bash
$ pnpm test
 Tasks:    4 successful, 4 total
Cached:    0 cached, 4 total
  Time:    1.348s
```

→ utils 改了 → utils:build / utils:test / ui:build / ui:test 全部失效。
（注意：`ui:test` 的 `dependsOn: ["^build"]` 把 utils:build 拉进自己的缓存键，所以 utils 改动会自动让 ui 的测试缓存失效。**这就是"自动追踪跨包依赖"的价值。**）

立刻再跑一次：

```bash
$ pnpm test
 Tasks:    4 successful, 4 total
Cached:    4 cached, 4 total
  Time:    25ms >>> FULL TURBO
```

→ 又满了。

### 3.4 一个反直觉但很重要的细节

> `touch` 一个文件**不会**让缓存失效。

Turbo 用的是**内容哈希**，不是 mtime。这意味着：

- 切分支、stash 来回切，缓存不会瞎动
- CI 上 clean checkout 后，只要内容没变就能复用远端缓存
- 但格式化工具改了一个空格也会失效——这是预期行为

---

## 4. Affected：CI 真正省钱的钥匙

`turbo run xxx` 默认会把仓库里所有有 `xxx` 脚本的包都纳入。但在 CI 上，我们通常只想跑 **"被这次改动影响到的包"**。

Turbo 提供了三种过滤器，足够覆盖 90% 场景：

### 4.1 `--filter=<package>`：只跑某一个

```bash
$ pnpm exec turbo run test --filter=@repo/utils
 Tasks:    1 successful, 1 total
```

只测了 utils，不碰 ui。

### 4.2 `--filter=...<package>`：包含所有下游

```bash
$ pnpm exec turbo run lint --filter=...@repo/utils
 Tasks:    3 successful, 3 total
```

`...` 前缀 = "this and everything that depends on it"。utils 是底层，所以 ui + web 都会被拉进来——这就是发布后的"影响半径"。

### 4.3 `--filter='[HEAD^1]'`：相对 git 引用的差异

```bash
$ pnpm exec turbo run lint --filter='[HEAD^1]'
```

含义：跟上一次提交相比，**改动了的包及其下游**。这是 CI 里最常用的写法：

```yaml
# CI 例子（仅示意）
- run: pnpm exec turbo run lint test typecheck --filter="[origin/main]"
```

> 关键点：第一次配置 `--filter='[HEAD^1]'` 的时候很容易踩坑——CI 上一定要先 `git fetch origin main` 才能拿到引用。

### 4.4 过滤器还能组合

```bash
# 改动相关的、并且名字以 @repo/ 开头的
pnpm exec turbo run test --filter='[HEAD^1]' --filter='@repo/*'

# 排除某个包
pnpm exec turbo run lint --filter='!web'
```

---

## 5. Changesets：多包发布的"提交-审计-发布"流水线

### 5.1 为什么需要它

只要 monorepo 里有**两个及以上的可发布包**，你立刻会撞上一系列经典问题：

1. utils 提了一个能力，ui 跟着用了。utils 该升 minor 还是 major？
2. ui 用了 utils 的新能力，但发布时漏改了 ui 自己的依赖范围 `^0.1.0`，线上崩。
3. 发了一周才想起来要写 CHANGELOG，已经记不清这周到底改了什么。
4. 多人同时往 main 合，每个人都改 `package.json` 的 version，merge 冲突满天飞。

**Changesets 的核心思想是：把"我这次提交需要触发哪些包的什么级别版本变更"作为一份小文件提交进 PR，等版本号真正要 bump 时，再统一合并。**

### 5.2 安装 + 初始化

```bash
pnpm add -Dw @changesets/cli
pnpm exec changeset init
```

会生成：

```
.changeset/
├── README.md
└── config.json
```

`config.json` 默认值我们直接用：

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.4/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

几个关键字段：

| 字段                         | 含义                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `commit: false`              | `changeset version` 之后不自动 commit；交给我们走自己的提交规范                           |
| `access: "restricted"`       | npm 私有；要发公网就改 `"public"`                                                         |
| `baseBranch: "main"`         | 计算 status 时和谁比                                                                      |
| `updateInternalDependencies` | `@repo/ui` 依赖 `@repo/utils`，utils 升级时 ui 自动 patch                                 |
| `linked` / `fixed`           | 一组包"绑定"或"完全同步"升级——典型场景：`@repo/ui` 和 `@repo/ui-icons` 始终保持一致版本号 |

### 5.3 完整的发布工作流

```
开发者 ─── (写代码) ──► 写一个 changeset ──► 提 PR
                                              │
                                       merge 后进 main
                                              │
                                              ▼
                              定期跑 `changeset version`
                              （bump version + 生成 CHANGELOG + 删除 changeset 文件）
                                              │
                                              ▼
                                          提"version PR"
                                              │
                                       merge 后进 main
                                              │
                                              ▼
                              CI 自动 `changeset publish`（发 npm + 打 tag）
```

很多团队会用 **changesets/action** 这个 GitHub Action 把后两步全自动化——开发者只管写 changeset，剩下的机器全包了。

### 5.4 实操：模拟一次完整发布

#### a. 初始版本

把演示包从 `0.0.0` 提到 `0.1.0`，方便看 bump：

```jsonc
// packages/utils/package.json
"version": "0.1.0"

// packages/ui/package.json
"version": "0.1.0"
```

#### b. 写一个 changeset

可以交互式：`pnpm changeset`，也可以直接写文件（更适合脚本化）。本项目里用文件方式：

```markdown
## <!-- .changeset/swift-fox-introduces-cache.md -->

"@repo/utils": minor
"@repo/ui": patch

---

为 `formatDate` 增加 monorepo 缓存验证用注释；同步触发 `@repo/ui` 的 patch 版本更新（因为它通过 `workspace:*` 依赖 `@repo/utils`）。
```

> 注意 frontmatter 里的 key 是包名，value 是 `major` / `minor` / `patch`。**不要把不需要 bump 的包写进去**——changesets 不会自动猜你想要什么级别。

#### c. 看待发布状态

```bash
$ pnpm exec changeset status
🦋  info Packages to be bumped at patch:
🦋  - @repo/ui
🦋  - web
🦋  ---
🦋  info Packages to be bumped at minor:
🦋  - @repo/utils
```

注意到 `web` 也被自动 patch 了——因为它依赖 `@repo/utils`，`updateInternalDependencies: "patch"` 起了作用。

#### d. 执行 version

```bash
$ pnpm exec changeset version
🦋  All files have been updated. Review them and commit at your leisure
```

发生了什么：

```
@repo/utils: 0.1.0 → 0.2.0   (minor)
@repo/ui:    0.1.0 → 0.1.1   (patch)
+ packages/utils/CHANGELOG.md
+ packages/ui/CHANGELOG.md
- .changeset/swift-fox-introduces-cache.md  ← 已被消费，自动删除
```

CHANGELOG 内容自动生成：

```markdown
# @repo/ui

## 0.1.1

### Patch Changes

- 为 `formatDate` 增加 monorepo 缓存验证用注释……

- Updated dependencies
  - @repo/utils@0.2.0
```

> 这就是 changesets 最甜的地方——**ui 的 changelog 里自动记录了 "我这次升级是因为 utils 升到 0.2.0"**。这种依赖追溯靠人写永远写不全。

#### e. 发布

```bash
$ pnpm exec changeset publish
🦋  warn No unpublished projects to publish
```

我们项目里所有包都是 `private: true`，所以 changesets **安全地跳过了**它们——这是想要的行为：私有包参与版本号管理，但绝不会被意外推到 npm。

> 如果想真正发到 npm：把对应包的 `private: true` 移掉，把 `.changeset/config.json` 的 `access` 改成 `"public"`。

---

## 6. 把这一周融进 CI 的最小思路

只是写给未来的自己——**不在本周实操，留作伏笔**：

```yaml
# .github/workflows/ci.yml（示意）
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 } # 拿到完整历史，turbo --filter=[origin/main] 才能算 diff

      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }

      - run: pnpm install --frozen-lockfile

      # affected：只跑 main 分支以来变化的包
      - run: pnpm exec turbo run lint test typecheck --filter='[origin/main]'

  release:
    needs: ci
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: changesets/action@v1
        with:
          version: pnpm version-packages
          publish: pnpm release
```

到这一步就实现了：

- PR：只跑被影响的包；命中缓存秒过
- main：自动 open"Version PR"，合并即发布

---

## 7. 我踩过的几个坑（先记下来）

### 7.1 `outputs` 配错，缓存"假命中"

最早我把 `web:build` 的 `outputs` 写成 `["build/**"]`（拼错了，应该是 `dist/**`）。结果：

- 任务**显示**缓存命中 ✅
- 但实际 `dist/` 不存在 ❌

部署的时候才发现。从此规则：**`outputs` 写完后必须 `pnpm clean && pnpm build && ls dist/` 验证一次。**

### 7.2 `inputs` 漏了配置文件，改 ESLint 规则不失效

第一版 `lint` 任务的 `inputs` 没写 `eslint.config.js`，结果改了规则后：

- turbo 觉得"输入没变" → 跳过
- 实际上规则全变了

→ 一定要把"会影响任务行为的所有文件"放进 `inputs`，包括各种 `*.config.js` / `*.config.ts`。

### 7.3 `^build` 用错位置

第一版 `lint` 也写了 `dependsOn: ["^build"]`。这是错的——lint 不需要等上游 build 完成，浪费时间。

→ **只有真正读取上游产物的任务才用 `^build`**。lint / typecheck / test 大多数情况下读的是源码，用 `^typecheck` 或者干脆不写依赖。

### 7.4 `pnpm dlx changeset` 不如 `pnpm add -Dw`

用 `dlx` 跑 changeset，每次都要重新下，CI 慢且不可重现。装到 root devDependencies + lockfile，**版本固定才稳定**。

### 7.5 改了 changeset 配置不生效？

`changeset/config.json` 里改了 `updateInternalDependencies` 之后，**对已经写好但还没 version 的 changeset 文件不会立刻生效**——只有下一个 `changeset version` 才按新规则计算。所以最好开新 PR 时改、先空跑一次确认。

---

## 8. 第 3 周回顾

第 2 周让代码"**跑起来 + 像样地协作**"。
第 3 周让代码"**跑得快 + 发得稳**"。

| 之前的问题                     | 这周怎么解决                                                             |
| ------------------------------ | ------------------------------------------------------------------------ |
| 每次都全量 lint / test / build | turbo 内容哈希缓存，未变化的任务直接跳过                                 |
| 改了 utils 不知道影响哪些下游  | turbo 自动从 `package.json` 推导 task graph，`...@repo/utils` 一句话搞定 |
| CI 跑全量，PR 等 10 分钟       | `--filter='[origin/main]'` 只跑变化的包                                  |
| 多包升级靠人手改 version       | `changeset add` 把"我要 bump 什么"作为提交物                             |
| CHANGELOG 难维护               | `changeset version` 自动生成，依赖更新自动记录                           |
| ui 依赖 utils，发版漏改        | `updateInternalDependencies: "patch"` 自动同步                           |

如果说第 1、2 周是"**让一个人能把活儿做完**"，第 3 周就是"**让一群人持续往里加东西也不会失控**"——这才是 Monorepo 真正的价值。

下一周的方向（暂列）：

- 接 GitHub Actions，把 affected + changesets/action 全自动化
- 远端缓存（Vercel Remote Cache 或自建 S3）：让 CI 和本地共享缓存
- 引入一个小型组件预览站（Histoire / Storybook for Vue），完整跑通"组件库 → 预览站 → app 消费"的链路
