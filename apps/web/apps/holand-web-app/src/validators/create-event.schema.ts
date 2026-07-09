import { z } from 'zod';
import { messages } from '@/config/messages';

const baseEventFormSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, { message: messages.nameIsRequired }),
  description: z.string().optional(),
  location: z.string().optional(),
  timezone: z.string().min(1, { message: 'Timezone is required' }),
  recurrenceEnabled: z.boolean().optional(),
  recurrenceFrequency: z
    .enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])
    .optional(),
  recurrenceInterval: z.number().int().positive().optional(),
  recurrenceUntil: z.date().optional(),
  category: z
    .enum(['general', 'work', 'meeting', 'personal', 'deadline', 'travel', 'holiday', 'focus'])
    .optional(),
  color: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z
    .enum(['tentative', 'confirmed', 'in-progress', 'done', 'cancelled'])
    .optional(),
  notes: z.string().optional(),
  reminderMinutesBefore: z.number().int().min(0).max(60 * 24 * 7).optional(),
  startDate: z.date({
    required_error: messages.startDateIsRequired,
  }),
  // startTime: z.date({
  //   required_error: messages.startTimeIsRequired,
  // }),
  endDate: z.date({
    required_error: messages.endDateIsRequired,
  }),
  // endTime: z.date({
  //   required_error: messages.endTimeIsRequired,
  // }),
});

export const eventFormSchema = baseEventFormSchema
  .refine((value) => value.endDate > value.startDate, {
    path: ['endDate'],
    message: 'End date must be after start date',
  })
  .refine(
    (value) => {
      if (!value.recurrenceEnabled) {
        return true;
      }

      return Boolean(value.recurrenceFrequency);
    },
    {
      path: ['recurrenceFrequency'],
      message: 'Recurrence frequency is required when recurrence is enabled',
    }
  )
  .refine(
    (value) => {
      if (!value.recurrenceEnabled || !value.recurrenceUntil) {
        return true;
      }

      return value.recurrenceUntil >= value.startDate;
    },
    {
      path: ['recurrenceUntil'],
      message: 'Recurrence end must be after start date',
    }
  );

// generate form types from zod validation schema
export type EventFormInput = z.infer<typeof eventFormSchema>;
