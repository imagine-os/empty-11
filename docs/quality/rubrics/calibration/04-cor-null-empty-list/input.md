# Case 04: empty list crashes

PR adds `apps/web/src/routes/projects/List.tsx`:

```tsx
const { data } = useProjects();
const first = data.items[0];
return (
  <Table rows={data.items} highlight={first.id} />
);
```

`useProjects` returns `{ items: Project[] }` and the spec declares states `loaded`, `empty`, `loading`, `error`. There is no test for an empty tenant.
