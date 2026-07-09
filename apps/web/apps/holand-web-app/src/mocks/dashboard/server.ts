import { setupServer } from 'msw/node';
import { dashboardHandlers } from './handlers';

export const dashboardMswServer = setupServer(...dashboardHandlers);
