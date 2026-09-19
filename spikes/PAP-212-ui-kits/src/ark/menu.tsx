import { Menu } from '@ark-ui/react/menu';
import { Portal } from '@ark-ui/react/portal';
export function Demo({ actions }: { actions: string[] }) {
  return (
    <Menu.Root>
      <Menu.Trigger>Actions</Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {actions.map((a) => <Menu.Item key={a} value={a}>{a}</Menu.Item>)}
            <Menu.Separator />
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
