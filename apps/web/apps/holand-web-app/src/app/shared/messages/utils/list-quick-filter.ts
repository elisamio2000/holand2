export type ListQuickFilter = 'all' | 'unread' | 'starred' | 'attachments';

export function applyListQuickFilter<T extends {
  read: boolean;
  attachments?: unknown[];
}>(
  items: T[],
  filter: ListQuickFilter,
  isStarred?: (id: string) => boolean,
  getId?: (item: T) => string
): T[] {
  if (filter === 'all') return items;
  return items.filter((item) => {
    const id = getId?.(item) ?? (item as { id?: string }).id ?? '';
    switch (filter) {
      case 'unread':
        return !item.read;
      case 'starred':
        return isStarred?.(id) ?? false;
      case 'attachments':
        return (item.attachments?.length ?? 0) > 0;
      default:
        return true;
    }
  });
}
