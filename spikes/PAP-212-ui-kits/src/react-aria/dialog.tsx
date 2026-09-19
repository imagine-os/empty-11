import { DialogTrigger, Button, Modal, ModalOverlay, Dialog, Heading } from 'react-aria-components';
export function Demo({ title, body }: { title: string; body: string }) {
  return (
    <DialogTrigger>
      <Button>{title}</Button>
      <ModalOverlay>
        <Modal>
          <Dialog>
            <Heading slot="title">{title}</Heading>
            <p>{body}</p>
            <Button slot="close">Close</Button>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
