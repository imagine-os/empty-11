import { Dialog } from 'radix-ui';
import { twMerge } from 'tailwind-merge';
import clsx, { type ClassValue } from 'clsx';
const cn = (...i: ClassValue[]) => twMerge(clsx(i));
export function Demo({ title, body }: { title: string; body: string }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={cn('inline-flex')}>{title}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={cn('fixed inset-0')} />
        <Dialog.Content className={cn('fixed z-50')}>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{body}</Dialog.Description>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
