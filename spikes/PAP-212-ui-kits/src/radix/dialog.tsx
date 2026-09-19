import { Dialog } from 'radix-ui';
export function Demo({ title, body }: { title: string; body: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger>{title}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{body}</Dialog.Description>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
