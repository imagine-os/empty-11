# Case 05: cursor pagination boundary

PR adds cursor pagination to `packages/pm/src/queries/tasks.ts`:

```ts
const rows = await db.select().from(tasks)
  .where(cursor ? gt(tasks.updatedAt, cursor) : undefined)
  .orderBy(tasks.updatedAt)
  .limit(limit);
return { items: rows, nextCursor: rows.at(-1)?.updatedAt };
```

`updatedAt` is not unique (bulk imports set the same timestamp on hundreds of rows). Tests cover one page of three rows.
