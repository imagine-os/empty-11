import { Select, SelectValue, Button, Popover, ListBox, ListBoxItem, Label } from 'react-aria-components';
export function Demo({ items }: { items: { value: string; label: string }[] }) {
  return (
    <Select>
      <Label>Pick</Label>
      <Button><SelectValue /></Button>
      <Popover offset={8}>
        <ListBox items={items}>
          {(i) => <ListBoxItem id={i.value}>{i.label}</ListBoxItem>}
        </ListBox>
      </Popover>
    </Select>
  );
}
