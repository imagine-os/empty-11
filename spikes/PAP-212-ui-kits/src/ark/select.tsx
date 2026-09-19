import { Select, createListCollection } from '@ark-ui/react/select';
export function Demo({ items }: { items: { value: string; label: string }[] }) {
  const collection = createListCollection({ items });
  return (
    <Select.Root collection={collection}>
      <Select.Label>Pick</Select.Label>
      <Select.Control>
        <Select.Trigger><Select.ValueText /><Select.Indicator /></Select.Trigger>
      </Select.Control>
      <Select.Positioner>
        <Select.Content>
          {collection.items.map((i) => (
            <Select.Item key={i.value} item={i}>
              <Select.ItemText>{i.label}</Select.ItemText>
              <Select.ItemIndicator />
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Positioner>
    </Select.Root>
  );
}
