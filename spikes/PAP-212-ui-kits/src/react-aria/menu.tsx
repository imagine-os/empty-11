import { MenuTrigger, Button, Popover, Menu, MenuItem, Separator } from 'react-aria-components';
export function Demo({ actions }: { actions: string[] }) {
  return (
    <MenuTrigger>
      <Button>Actions</Button>
      <Popover offset={8}>
        <Menu>
          {actions.map((a) => <MenuItem key={a} id={a}>{a}</MenuItem>)}
          <Separator />
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
