# Case 03: request logging with PII

PR adds middleware `apps/api/src/middleware/log.ts`:

```ts
logger.info('request', { path: req.path, user: ctx.user?.email, ip: req.ip, body: req.body });
```

The redacting logger exists (`@paperos/core/log`) and is used elsewhere; this uses the raw pino instance. Bodies include passwords on `/auth/*` routes.
