import { ComboBox, Input, Button, Popover, ListBox, ListBoxItem, Label, Virtualizer, ListLayout } from 'react-aria-components';
export function Demo({ items }: { items: { id: string; label: string }[] }) {
  return (
    <ComboBox items={items}>
      <Label>Pick</Label>
      <Input />
      <Button>v</Button>
      <Popover offset={8}>
        <Virtualizer layout={new ListLayout({ rowHeight: 44 })}>
          <ListBox>{(i: { id: string; label: string }) => <ListBoxItem id={i.id}>{i.label}</ListBoxItem>}</ListBox>
        </Virtualizer>
      </Popover>
    </ComboBox>
  );
}
