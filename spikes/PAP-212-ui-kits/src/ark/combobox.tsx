import { Combobox, useListCollection } from '@ark-ui/react/combobox';
import { Portal } from '@ark-ui/react/portal';
export function Demo({ items }: { items: { value: string; label: string }[] }) {
  const { collection } = useListCollection({ initialItems: items });
  return (
    <Combobox.Root collection={collection}>
      <Combobox.Control>
        <Combobox.Input />
        <Combobox.Trigger>v</Combobox.Trigger>
      </Combobox.Control>
      <Portal>
        <Combobox.Positioner>
          <Combobox.Content>
            {collection.items.map((i) => (
              <Combobox.Item key={i.value} item={i}>
                <Combobox.ItemText>{i.label}</Combobox.ItemText>
              </Combobox.Item>
            ))}
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  );
}
