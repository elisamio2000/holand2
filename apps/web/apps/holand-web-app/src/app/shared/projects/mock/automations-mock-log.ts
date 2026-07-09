// Mock automation execution log (phase 18 — removed when BE automations ship)

export type AutomationLogEntry = {
  id: string;
  preset: 'presetImport' | 'presetOverdue' | 'presetAssign';
  at: string;
  detail: string;
};

const log: AutomationLogEntry[] = [];

export function pushAutomationLog(
  preset: AutomationLogEntry['preset'],
  detail: string
): void {
  log.unshift({
    id: `auto-mock-${Date.now()}-${log.length}`,
    preset,
    at: new Date().toISOString(),
    detail,
  });
  if (log.length > 20) log.length = 20;
}

export function getAutomationLog(): AutomationLogEntry[] {
  return [...log];
}
