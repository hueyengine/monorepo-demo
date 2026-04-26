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
.r-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.r-button--default {
  background: #fff;
  color: #333;
  border-color: #d9d9d9;
}

.r-button--default:hover {
  border-color: #4f46e5;
  color: #4f46e5;
}

.r-button--primary {
  background: #4f46e5;
  color: #fff;
}

.r-button--primary:hover {
  background: #4338ca;
}

.r-button--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
