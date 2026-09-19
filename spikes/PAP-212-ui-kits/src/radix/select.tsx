import { Select } from 'radix-ui';
export function Demo({ items }: { items: { value: string; label: string }[] }) {
  return (
    <Select.Root>
      <Select.Trigger><Select.Value /><Select.Icon /></Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={8}>
          <Select.ScrollUpButton />
          <Select.Viewport>
            {items.map((i) => (
              <Select.Item key={i.value} value={i.value}>
                <Select.ItemText>{i.label}</Select.ItemText>
                <Select.ItemIndicator />
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton />
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
