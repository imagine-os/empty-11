import { DropdownMenu } from 'radix-ui';
import { twMerge } from 'tailwind-merge';
import clsx, { type ClassValue } from 'clsx';
const cn = (...i: ClassValue[]) => twMerge(clsx(i));
export function Demo({ actions }: { actions: string[] }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={cn('inline-flex')}>Actions</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content sideOffset={8} className={cn('z-50 min-w-32')}>
          {actions.map((a) => <DropdownMenu.Item key={a} className={cn('relative flex')}>{a}</DropdownMenu.Item>)}
          <DropdownMenu.Separator />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
