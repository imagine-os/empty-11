# Case 02: query outside withTenant

PR adds a background job `apps/worker/src/jobs/digest.ts` that builds a weekly digest:

```ts
const rows = await db.select().from(activity).where(gte(activity.createdAt, since));
for (const tenant of tenants) {
  await sendDigest(tenant, rows.filter((r) => r.tenantId === tenant.id));
}
```

`db` here is the pooled connection without `withTenant`; RLS is `FORCE ROW LEVEL SECURITY` with a fail-closed context, but the worker role has `app.bypass` set for migrations in the same process.
