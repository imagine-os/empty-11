import { Popover } from 'radix-ui';
import { Command } from 'cmdk';
import { twMerge } from 'tailwind-merge';
import clsx, { type ClassValue } from 'clsx';
const cn = (...i: ClassValue[]) => twMerge(clsx(i));
export function Demo({ items }: { items: string[] }) {
  return (
    <Popover.Root>
      <Popover.Trigger className={cn('inline-flex')}>Pick one</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8} className={cn('w-52 p-0')}>
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
