# N+1 Optimization Notes for Group Listing

Problem
- The group-listing endpoint issues individual queries per group to fetch member counts and balances, causing N+1 queries under load.

Approach
- Use SQL aggregation joins to fetch counts and sums in a single query.
- Example (Postgres):

```sql
SELECT g.*, coalesce(m.count,0) AS member_count, coalesce(b.total_balance,0) AS total_balance
FROM groups g
LEFT JOIN (
  SELECT group_id, count(*) as count FROM memberships GROUP BY group_id
) m ON m.group_id = g.id
LEFT JOIN (
  SELECT group_id, SUM(balance) as total_balance FROM balances GROUP BY group_id
) b ON b.group_id = g.id;
```

Next steps
- Locate `backend/src/controllers/groupController.ts` and refactor the listing query to use aggregates.
- Add tests to assert query counts don't grow with number of groups.
