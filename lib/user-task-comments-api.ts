import { request } from './api';
import { createTaskCommentsApi } from './task-comments/api';

/** API комментариев к задачам поверх общего `request`: тот же адрес, токен и выход при 401. */
export const userTaskCommentsApi = createTaskCommentsApi(request);
