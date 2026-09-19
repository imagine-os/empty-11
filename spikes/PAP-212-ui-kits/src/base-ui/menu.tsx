import { Menu } from '@base-ui/react/menu';
export function Demo({ actions }: { actions: string[] }) {
  return (
    <Menu.Root>
      <Menu.Trigger>Actions</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8}>
          <Menu.Popup>
            {actions.map((a) => <Menu.Item key={a}>{a}</Menu.Item>)}
            <Menu.Separator />
            <Menu.Group><Menu.GroupLabel>More</Menu.GroupLabel></Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
