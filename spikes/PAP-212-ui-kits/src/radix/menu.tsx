import { DropdownMenu } from 'radix-ui';
export function Demo({ actions }: { actions: string[] }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>Actions</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content sideOffset={8}>
          {actions.map((a) => <DropdownMenu.Item key={a}>{a}</DropdownMenu.Item>)}
          <DropdownMenu.Separator />
          <DropdownMenu.Label>More</DropdownMenu.Label>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
