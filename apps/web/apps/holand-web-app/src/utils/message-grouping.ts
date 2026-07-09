import type { MessageItem } from '@/types/messages.types';

export interface MessageGroup {
  senderId: string;
  senderName: string;
  messages: MessageItem[];
  date: Date;
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function groupMessages(messages: MessageItem[], currentUserId: string): MessageGroup[] {
  if (messages.length === 0) return [];

  const sorted = [...messages].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (const msg of sorted) {
    const msgTime = new Date(msg.created_at).getTime();
    const senderId = msg.from.id;
    const senderName = msg.from.name;

    if (!currentGroup || 
        currentGroup.senderId !== senderId || 
        msgTime - new Date(currentGroup.messages[currentGroup.messages.length - 1].created_at).getTime() > GROUP_WINDOW_MS
    ) {
      currentGroup = {
        senderId,
        senderName,
        messages: [msg],
        date: new Date(msg.created_at),
      };
      groups.push(currentGroup);
    } else {
      currentGroup.messages.push(msg);
    }
  }

  return groups;
}

export function shouldShowDateSeparator(currentDate: Date, previousDate?: Date): boolean {
  if (!previousDate) return true;
  
  const current = new Date(currentDate);
  const previous = new Date(previousDate);
  
  return (
    current.getFullYear() !== previous.getFullYear() ||
    current.getMonth() !== previous.getMonth() ||
    current.getDate() !== previous.getDate()
  );
}

export function formatDateSeparator(date: Date, t: (key: string, opts?: any) => string): string {
  const now = new Date();
  const msgDate = new Date(date);
  
  const isToday = 
    now.getFullYear() === msgDate.getFullYear() &&
    now.getMonth() === msgDate.getMonth() &&
    now.getDate() === msgDate.getDate();
    
  if (isToday) return t('messages.date.today', 'Today');
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const isYesterday =
    yesterday.getFullYear() === msgDate.getFullYear() &&
    yesterday.getMonth() === msgDate.getMonth() &&
    yesterday.getDate() === msgDate.getDate();
    
  if (isYesterday) return t('messages.date.yesterday', 'Yesterday');
  
  const thisYear = now.getFullYear() === msgDate.getFullYear();
  
  if (thisYear) {
    return msgDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  }
  
  return msgDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}
