'use client';

import { useTranslation } from 'react-i18next';
import { PiCaretDown, PiSparkle } from 'react-icons/pi';
import { Popover } from 'rizzui';
import cn from '@core/utils/class-names';
import { getModelDisplayLabel } from '@/utils/chat-models-resolve';
import { CHAT_PREFERRED_MODEL_STORAGE_KEY } from '@/utils/chat-models-resolve';
import type { ModelInfo } from '@/types/chat.types';

interface ChatModelPickerProps {
  models: ModelInfo[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
}

export default function ChatModelPicker({
  models,
  selectedModel,
  onSelectModel,
}: ChatModelPickerProps) {
  const { t } = useTranslation();
  const active = models.find((m) => m.id === selectedModel) ?? models[0];
  const label = getModelDisplayLabel(active, selectedModel) || t('chatPage.modelNotConfigured');

  if (models.length <= 1) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300"
        title={t('chatPage.chatModelSingleHint')}
      >
        <PiSparkle className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span className="max-w-[12rem] truncate sm:max-w-[16rem]">{label}</span>
      </div>
    );
  }

  return (
    <Popover placement="bottom-start">
      <Popover.Trigger>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-200/20"
          aria-label={t('chatPage.chatModelLabel', { model: label })}
          title={t('chatPage.chatModelHint')}
        >
          <PiSparkle className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="max-w-[10rem] truncate sm:max-w-[14rem]">{label}</span>
          <PiCaretDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </button>
      </Popover.Trigger>
      <Popover.Content className="z-50 max-h-64 w-56 overflow-y-auto p-1">
        {models.map((model) => (
          <button
            key={model.id}
            type="button"
            onClick={() => {
              onSelectModel(model.id);
              try {
                localStorage.setItem(CHAT_PREFERRED_MODEL_STORAGE_KEY, model.id);
              } catch {
                /* ignore */
              }
            }}
            className={cn(
              'flex w-full flex-col rounded-md px-2.5 py-2 text-start text-sm transition-colors',
              model.id === selectedModel
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-200/10'
            )}
          >
            <span className="truncate">{getModelDisplayLabel(model, model.id)}</span>
            <span className="truncate text-[10px] text-gray-400">{model.id}</span>
          </button>
        ))}
      </Popover.Content>
    </Popover>
  );
}
