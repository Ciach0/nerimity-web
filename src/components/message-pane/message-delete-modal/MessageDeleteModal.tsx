import { deleteMessage } from "@/chat-api/services/MessageService";
import { Message } from "@/chat-api/store/useMessages";
import Button from "@/components/ui/Button";
import { FlexColumn, FlexRow } from "@/components/ui/Flexbox";
import Text from "@/components/ui/Text";
import LegacyModal from "@/components/ui/legacy-modal/LegacyModal";
import { onCleanup, onMount } from "solid-js";
import { css, styled } from "solid-styled-components";
import MessageItem from "../message-item/MessageItem";
import { Modal } from "@/components/ui/modal";

const bodyContainerStyles = css`
  overflow: auto;
  max-height: 600px;
`;
const messageItemStyles = css`
  padding-top: 5px;
  border-radius: 8px;
  margin-top: 5px;

  pointer-events: none;

  && {
    padding: 10px;
    border: solid 1px rgba(255, 255, 255, 0.1);
  }
`;

const modalStyles = css`
  max-height: 800px;
  overflow: hidden;
`;

const desktopRootStyles = css``;

export default function DeleteMessageModal(props: {
  instant?: boolean;
  message: Message;
  close: () => void;
}) {
  const onDeleteClick = () => {
    props.close();
    deleteMessage({
      channelId: props.message.channelId,
      messageId: props.message.id,
    });
  };

  if (props.instant) {
    onDeleteClick();
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onDeleteClick();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      props.close();
    }
  };

  onMount(() => {
    document.addEventListener("keydown", onKeyDown);
    onCleanup(() => {
      document.removeEventListener("keydown", onKeyDown);
    });
  });

  return (
    <Modal.Root
      desktopMaxWidth={600}
      desktopMinWidth={400}
      desktopClass={desktopRootStyles}
      close={props.close}
      class={modalStyles}
    >
      <Modal.Header title="Delete Message?" icon="delete" alert />
      <Modal.Body class={bodyContainerStyles}>
        <Text size={14}>Would you like to delete this message?</Text>
        <MessageItem
          class={messageItemStyles}
          hideFloating
          message={props.message}
        />
      </Modal.Body>
      <Modal.Footer>
        <Modal.Button
          label="Don't Delete"
          onClick={props.close}
          iconName="close"
        />
        <Modal.Button
          primary
          label="Delete"
          onClick={onDeleteClick}
          iconName="delete"
          color="var(--alert-color)"
        />
      </Modal.Footer>
    </Modal.Root>
  );
}
