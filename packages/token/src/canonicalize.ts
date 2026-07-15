export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => [key, (value as Record<string, unknown>)[key]] as const)
    .filter(([, v]) => v !== undefined)
    .map(([key, v]) => `${JSON.stringify(key)}:${canonicalize(v)}`);
  return `{${entries.join(",")}}`;
}
