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

    <p class="hint">
      上面的按钮来自 <code>@repo/ui</code>，日期格式化来自
      <code>@repo/utils</code>。修改这两个包的源码，主应用会立即热更新。
    </p>
  </main>
</template>

<style scoped>
.page {
  max-width: 720px;
  margin: 64px auto;
  padding: 0 24px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #1f2937;
}

h1 {
  margin-bottom: 8px;
}

.meta {
  color: #6b7280;
  margin-top: 0;
}

.card {
  margin-top: 24px;
  padding: 20px;
  border-radius: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
}

.row {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.hint {
  margin-top: 24px;
  color: #6b7280;
  font-size: 14px;
}

code {
  background: #eef2ff;
  color: #4338ca;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 13px;
}
</style>
