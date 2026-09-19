# Case 06: a test that cannot fail

PR adds `packages/views/src/compiler/__tests__/compile.test.ts`:

```ts
it('compiles a grouped view', () => {
  const out = compile(fixture);
  expect(out).toBeDefined();
  expect(spy).toHaveBeenCalled();
});
```

`compile` never returns undefined (its return type is `CompiledView`) and `spy` wraps `compile` itself. The PR body says "tests added for grouping".
