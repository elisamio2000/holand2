/**
 * User Boards API — re-export for app-wide service discovery.
 * Implementation lives in shared/user-boards/services/board.service.ts
 */
export {
  boardService as userBoardsService,
  type BoardApiStatus,
  type BoardRemoteRow,
} from '@/app/shared/user-boards/services/board.service';
