export const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};

export const stringValue = (...values: unknown[]): string => {
  const value = values.find((item) => typeof item === 'string');
  return typeof value === 'string' ? value : '';
};

export const normalizeDate = (value: string): string => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? match[3] + '-' + match[2] + '-' + match[1] : value;
};
