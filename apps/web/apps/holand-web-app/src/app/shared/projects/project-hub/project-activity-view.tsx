'use client';

import { useMemo, useState } from 'react';
import { Select, Text } from 'rizzui';
import type { ActivityAction, ActivityEvent } from '@/types/projects.types';

export default function ProjectActivityView({ events }: { events: ActivityEvent[] }) {
  const [actionFilter, setActionFilter] = useState<ActivityAction | 'all'>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');

  const actors = useMemo(() => {
    const names = new Set(events.map((e) => e.actor_name));
    return Array.from(names);
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (actionFilter !== 'all' && e.action !== actionFilter) return false;
      if (actorFilter !== 'all' && e.actor_name !== actorFilter) return false;
      return true;
    });
  }, [events, actionFilter, actorFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select
          size="sm"
          value={actionFilter}
          onChange={(v) => setActionFilter((v as ActivityAction) ?? 'all')}
          options={[
            { label: 'All actions', value: 'all' },
            { label: 'Created', value: 'created' },
            { label: 'Updated', value: 'updated' },
            { label: 'Status changed', value: 'status_changed' },
            { label: 'Assigned', value: 'assigned' },
            { label: 'Commented', value: 'commented' },
          ]}
          className="w-40"
        />
        <Select
          size="sm"
          value={actorFilter}
          onChange={(v) => setActorFilter(String(v ?? 'all'))}
          options={[{ label: 'All users', value: 'all' }, ...actors.map((a) => ({ label: a, value: a }))]}
          className="w-44"
        />
      </div>
      <div className="space-y-3">
        {filtered.map((event) => (
          <div
            key={event.id}
            className="rounded-xl border border-muted bg-gray-0 px-4 py-3 dark:bg-gray-50"
          >
            <Text className="text-sm">{event.summary}</Text>
            <Text className="mt-1 text-xs text-gray-500">
              {event.actor_name} · {event.action} · {new Date(event.created_at).toLocaleString()}
            </Text>
          </div>
        ))}
        {!filtered.length && (
          <Text className="py-12 text-center text-gray-400">No activity yet</Text>
        )}
      </div>
    </div>
  );
}
