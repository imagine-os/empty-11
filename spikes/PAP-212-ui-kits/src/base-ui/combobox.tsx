import { Combobox } from '@base-ui/react/combobox';
export function Demo({ items }: { items: string[] }) {
  return (
    <Combobox.Root items={items} virtualized>
      <Combobox.Input />
      <Combobox.Trigger><Combobox.Icon /></Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={8}>
          <Combobox.Popup>
            <Combobox.Empty>No matches</Combobox.Empty>
            <Combobox.List>
              {(item: string) => <Combobox.Item key={item} value={item}>{item}</Combobox.Item>}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
