import { Router } from 'express';

import { InMemoryGroupsRepository } from '../services/group/groups.repository';
import { GroupsService } from '../services/group/groups.service';

/**
 * Groups controller: request/response mapping only. No business rules and no
 * data access here, so the same behaviour is testable through GroupsService
 * without spinning up HTTP.
 *
 * Member lookups are batched inside GroupsService (single query per request),
 * so the router contract stays unchanged while avoiding N+1 queries.
 */
export function createGroupsRouter(
  service: GroupsService = new GroupsService(new InMemoryGroupsRepository())
): Router {
  const router = Router();

  router.get('/groups', async (_req, res, next) => {
    try {
      const groups = await service.listGroupsWithMembers();
      res.json(groups);
    } catch (error) {
      next(error);
    }
  });

  router.get('/groups/:id', async (req, res, next) => {
    try {
      const group = await service.getGroupByIdWithMembers(req.params.id);
      res.json(group);
    } catch (error) {
      next(error);
    }
  });

  return router;
}