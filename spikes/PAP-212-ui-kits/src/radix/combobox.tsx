// Radix Primitives ships no combobox: the community pattern (and shadcn's own
// `combobox` recipe) is Radix Popover + cmdk. Measured as that pair.
import { Popover } from 'radix-ui';
import { Command } from 'cmdk';
export function Demo({ items }: { items: string[] }) {
  return (
    <Popover.Root>
      <Popover.Trigger>Pick one</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8}>
          <Command>
            <Command.Input />
            <Command.List>
              <Command.Empty>No matches</Command.Empty>
              {items.map((i) => <Command.Item key={i} value={i}>{i}</Command.Item>)}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
