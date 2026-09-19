import { Select } from '@base-ui/react/select';
export function Demo({ items }: { items: { value: string; label: string }[] }) {
  return (
    <Select.Root items={items}>
      <Select.Trigger><Select.Value /><Select.Icon /></Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={8}>
          <Select.Popup>
            {items.map((i) => (
              <Select.Item key={i.value} value={i.value}>
                <Select.ItemText>{i.label}</Select.ItemText>
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
