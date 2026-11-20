import { Router } from 'express';

import { InMemoryGroupsRepository } from '../services/group/groups.repository';
import { GroupsService } from '../services/group/groups.service';
import { parseOffsetParams, paginateArray } from '../lib/pagination';

/**
 * Groups controller: request/response mapping only. No business rules and no
 * data access here, so the same behaviour is testable through GroupsService
 * without spinning up HTTP.
 */
export function createGroupsRouter(
  service: GroupsService = new GroupsService(new InMemoryGroupsRepository())
): Router {
  const router = Router();

  router.get('/groups', async (req, res, next) => {
    try {
      const groups = await service.listGroups();

      // Backwards compatibility: when no pagination params are supplied,
      // return the full array as before.
      const hasPaginationParams =
        req.query.limit !== undefined ||
        req.query.offset !== undefined ||
        req.query.page !== undefined;

      if (!hasPaginationParams) {
        res.json(groups);
        return;
      }

      const { limit, offset } = parseOffsetParams(req.query);
      const { data, meta } = paginateArray(groups, { limit, offset });
      res.json({ data, meta });
    } catch (error) {
      next(error);
    }
  });

  router.get('/groups/:id', async (req, res, next) => {
    try {
      const group = await service.getGroupById(req.params.id);
      res.json(group);
    } catch (error) {
      next(error);
    }
  });

  return router;
}