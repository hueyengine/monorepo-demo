# @repo/ui

## 0.1.1

### Patch Changes

- 为 `formatDate` 增加 monorepo 缓存验证用注释；同步触发 `@repo/ui` 的 patch 版本更新（因为它通过 `workspace:*` 依赖 `@repo/utils`）。
  - `@repo/utils`: 演示 minor 升级
  - `@repo/ui`: 由 changesets `updateInternalDependencies: "patch"` 配置自动跟随 patch 升级

- Updated dependencies
  - @repo/utils@0.2.0
