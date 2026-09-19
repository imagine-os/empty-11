# Case 11: icon-only button without a name

PR adds a row action in `packages/ui/src/table/RowActions.tsx`:

```tsx
<button onClick={onArchive} className="icon">
  <ArchiveIcon />
</button>
```

axe (PAP-73) reports `button-name` serious on 12 rows. The icon component renders an `<svg>` with no `<title>`. No tooltip.
