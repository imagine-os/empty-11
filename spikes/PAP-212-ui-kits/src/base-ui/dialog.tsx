import { Dialog } from '@base-ui/react/dialog';
export function Demo({ title, body }: { title: string; body: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger>{title}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{body}</Dialog.Description>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
