export const now = () => new Date().toISOString();

export const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now()}`;

export const lines = (text: string) =>
  text
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

export const join = (items: string[]) => items.join("\n");
