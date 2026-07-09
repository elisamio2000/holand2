'use client';

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { ProjectBoardData, TaskStatus, TaskSummary, TASK_STATUS_LABEL_KEYS } from '@/types/projects.types';
import { useTranslation } from 'react-i18next';

const columnBorders: Record<TaskStatus, string> = {
  backlog: 'border-t-gray-400',
  todo: 'border-t-blue-500',
  in_progress: 'border-t-amber-500',
  review: 'border-t-purple-500',
  done: 'border-t-green-500',
  canceled: 'border-t-gray-300',
};

function DraggableCard({
  task,
  onSelect,
}: {
  task: TaskSummary;
  onSelect: (task: TaskSummary) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <button
        type="button"
        onClick={() => onSelect(task)}
        className="w-full rounded-lg border border-muted bg-gray-0 p-3 text-start shadow-sm transition hover:shadow-md dark:bg-gray-50"
      >
        <div
          className={cn(
            'mb-2 h-1 w-full rounded',
            task.priority === 'urgent'
              ? 'bg-red-500'
              : task.priority === 'high'
                ? 'bg-amber-500'
                : 'bg-blue-500'
          )}
        />
        <Text className="text-sm font-medium">{task.title}</Text>
        {task.due_at && (
          <Text className="mt-1 text-xs text-gray-500">
            {new Date(task.due_at).toLocaleDateString()}
          </Text>
        )}
        {task.is_blocked && (
          <Badge variant="flat" size="sm" className="mt-2 bg-amber-100 text-amber-700">
            Blocked
          </Badge>
        )}
      </button>
    </div>
  );
}

function DroppableColumn({
  status,
  title,
  count,
  children,
}: {
  status: TaskStatus;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-w-[200px] flex-1 flex-col rounded-xl border border-muted border-t-4 bg-gray-50/50 dark:bg-gray-100/30',
        columnBorders[status],
        isOver && 'ring-2 ring-primary/40'
      )}
    >
      <div className="flex items-center justify-between p-3">
        <Text className="text-sm font-semibold">{title}</Text>
        <Badge variant="flat" size="sm">
          {count}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2 pt-0">{children}</div>
    </div>
  );
}

export default function ProjectBoardView({
  board,
  onMove,
  onSelect,
}: {
  board: ProjectBoardData;
  onMove: (taskId: string, status: TaskStatus, position: number) => void;
  onSelect: (task: TaskSummary) => void;
}) {
  const { t } = useTranslation();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const taskId = String(event.active.id);
    const overId = event.over?.id;
    if (!overId || !String(overId).startsWith('col-')) return;
    const status = String(overId).replace('col-', '') as TaskStatus;
    onMove(taskId, status, 0);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto">
        <div className="flex min-w-[900px] gap-4">
          {board.columns.map((column) => (
            <DroppableColumn
              key={column.status}
              status={column.status}
              title={t(TASK_STATUS_LABEL_KEYS[column.status])}
              count={column.tasks.length}
            >
              {column.tasks.map((task) => (
                <DraggableCard key={task.id} task={task} onSelect={onSelect} />
              ))}
            </DroppableColumn>
          ))}
        </div>
      </div>
      <Text className="mt-3 text-xs text-gray-500">{t('projects.board.dragDropDesc')}</Text>
    </DndContext>
  );
}
