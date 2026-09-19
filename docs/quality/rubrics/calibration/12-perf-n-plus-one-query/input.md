# Case 12: N+1 in a loop

PR adds `packages/pm/src/queries/board.ts`:

```ts
const columns = await db.select().from(boardColumns).where(eq(boardColumns.boardId, id));
for (const col of columns) {
  col.tasks = await db.select().from(tasks).where(eq(tasks.columnId, col.id)).limit(100);
}
```

Boards have 3 to 8 columns. No performance budget exists yet for this route (PAP-242 pending).
