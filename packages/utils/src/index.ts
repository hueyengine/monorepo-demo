// formatDate: 跨地区一致的日期格式化（用于 monorepo 缓存验证）
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
