export function getLocalizedField(item: any, field: string, locale: string): string {
  if (!item) return '';
  const localizedKey = `${field}_${locale}`;
  if (item[localizedKey] && item[localizedKey].trim() !== '') {
    return item[localizedKey];
  }
  // Par défaut, on retourne le champ de base (Français)
  return item[field] || '';
}