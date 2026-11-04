export function getLocalizedField(item: any, field: string, locale: string): string {
  if (!item) return '';
  return item[field] || '';
}