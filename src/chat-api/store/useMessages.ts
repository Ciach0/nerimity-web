import env from '@/common/env';
import { createStore, produce, reconcile } from 'solid-js/store';
import { MessageType, RawMessage, RawMessageReaction, RawUser } from '../RawData';
import { fetchMessages, postMessage, updateMessage } from '../services/MessageService';
import socketClient from '../socketClient';
import useAccount from './useAccount';
import useChannelProperties from './useChannelProperties';
import useChannels from './useChannels';

const account = useAccount();

export enum MessageSentStatus {
  SENDING = 0,
  FAILED = 1,
}

export type Message = RawMessage & {
  tempId?: string;
  sentStatus?: MessageSentStatus;
  uploadingAttachment?: {file: File, progress: number};
}

const [messages, setMessages] = createStore<Record<string, Message[] | undefined>>({});
const fetchAndStoreMessages = async (channelId: string, force = false) => {
  if (!force && getMessagesByChannelId(channelId)) return;

  const channelProperties = useChannelProperties();
  channelProperties.setMoreTopToLoad(channelId, true);
  channelProperties.setMoreBottomToLoad(channelId, false);

  const newMessages = await fetchMessages(channelId);
  setMessages({
    [channelId]: newMessages
  });
}

const loadMoreTopAndStoreMessages = async (channelId: string, beforeSet: () => void, afterSet: (data: { hasMore: boolean }) => void) => {
  const channelMessages = messages[channelId]!;
  const newMessages = await fetchMessages(channelId, {beforeMessageId: channelMessages[0].id});
  const clamp = sliceEnd([...newMessages, ...channelMessages]);
  const hasMore = newMessages.length === env.MESSAGE_LIMIT

  beforeSet();
  setMessages({
    [channelId]: clamp
  });
  afterSet({ hasMore });
}

const loadMoreBottomAndStoreMessages = async (channelId: string, beforeSet: () => void, afterSet: (data: { hasMore: boolean }) => void) => {
  const channelMessages = messages[channelId]!;
  const newMessages = await fetchMessages(channelId, {afterMessageId: channelMessages[channelMessages.length - 1].id});
  const clamp = sliceBeginning([...channelMessages, ...newMessages]);
  const hasMore = newMessages.length === env.MESSAGE_LIMIT

  beforeSet();
  setMessages({
    [channelId]: clamp
  });
  afterSet({ hasMore });
}

const loadAroundAndStoreMessages = async (channelId: string, aroundMessageId: string) => {
  const newMessages = await fetchMessages(channelId, {aroundMessageId});

  setMessages({
    [channelId]: newMessages
  });
}

function sliceEnd(arr: any[]) {
  return arr.slice(0, env.MESSAGE_LIMIT * 4);
}

function sliceBeginning(arr: any[]) {
  return arr.slice(-(env.MESSAGE_LIMIT * 4), arr.length);
}


const editAndStoreMessage = async (channelId: string, messageId: string, content: string) => {
  let messages = get(channelId) || [];
  let index = messages.findIndex(m => m.id === messageId);
  if (index < 0) return;
  if (messages[index].content === content) return;
  setMessages(channelId, index, {
    sentStatus: MessageSentStatus.SENDING,
    content
  });

  await updateMessage({
    channelId,
    messageId,
    content
  }).catch(() => {
    updateLocalMessage({ sentStatus: MessageSentStatus.FAILED }, channelId, messageId);
  })
}

const updateLocalMessage = async (message: Partial<RawMessage & { sentStatus: MessageSentStatus }>, channelId: string, messageId: string) => {
  const messages = get(channelId) || [];
  const index = messages.findIndex(m => m.id === messageId);
  if (index < 0) return;
  setMessages(channelId, index, message)
}


const sendAndStoreMessage = async (channelId: string, content?: string) => {
  const channels = useChannels();
  const channelProperties = useChannelProperties();
  const properties = channelProperties.get(channelId);
  const tempMessageId = `${Date.now()}-${Math.random()}`;
  const channel = channels.get(channelId);

  const user = account.user();
  if (!user) return;

  
  const localMessage: Message = {
    id: "",
    tempId: tempMessageId,
    channelId,
    content,
    createdAt: Date.now(),
    sentStatus: MessageSentStatus.SENDING,
    type: MessageType.CONTENT,
    ...(!properties?.attachment ? undefined : {uploadingAttachment: {file: properties.attachment, progress: 0}}),
    reactions: [],
    quotedMessages: [],
    createdBy: {
      id: user.id,
      username: user.username,
      tag: user.tag,
      badges: user.badges,
      hexColor: user.hexColor,
      avatar: user.avatar
    },
  };
  
  !properties?.moreBottomToLoad && setMessages({
    [channelId]: sliceBeginning([...messages[channelId]!, localMessage])
  })
  if (properties?.attachment && properties.attachment.size > 12 * 1024 * 1024) {
    pushMessage(channelId, {
      channelId: channelId,
      createdAt: Date.now(),
      createdBy: {
        username: 'Nerimity',
        tag: "owo",
        badges: 0,
        hexColor: '0',
        id: "0",
      },
      reactions: [],
      quotedMessages: [],
      id: Math.random().toString(),
      type: MessageType.CONTENT,
      content: "This message couldn't be sent. Try again later. ```Error\nMax file size is 12MB.\nbody: " + content  + "```"
    })
    const index = messages[channelId]?.findIndex(m => m.tempId === tempMessageId);
    setMessages(channelId, index!, 'sentStatus', MessageSentStatus.FAILED);
    return;
  }
  
  const onUploadProgress = (percent: number) => {
    const messageIndex = messages[channelId]!.findIndex(m => m.tempId === tempMessageId);
    if (messageIndex === -1) return;
    setMessages(channelId, messageIndex, 'uploadingAttachment', 'progress', percent);
  }

  const message: void | Message = await postMessage({
    content,
    channelId,
    socketId: socketClient.id(),
    attachment: properties?.attachment,
    onUploadProgress
  }).catch((err) => {
    console.log(err);
    pushMessage(channelId, {
      channelId: channelId,
      createdAt: Date.now(),
      createdBy: {
        username: 'Nerimity',
        tag: "owo",
        badges: 0,
        hexColor: '0',
        id: "0",
      },
      reactions: [],
      quotedMessages: [],
      id: Math.random().toString(),
      type: MessageType.CONTENT,
      content: "This message couldn't be sent. Try again later. ```Error\n" + err.message + "\nbody: " + content  + "```"
    })
  });


  channel?.updateLastSeen(message?.createdAt! + 1);
  channel?.updateLastMessaged?.(message?.createdAt!);

  const index = messages[channelId]?.findIndex(m => m.tempId === tempMessageId);

  if (!message) {
    !properties?.moreBottomToLoad && setMessages(channelId, index!, 'sentStatus', MessageSentStatus.FAILED);
    return;
  }
  message.tempId = tempMessageId;

  !properties?.moreBottomToLoad && setMessages(channelId, index!, reconcile(message, { key: "tempId" }));
}


const pushMessage = (channelId: string, message: Message) => {
  if (!messages[channelId]) return;
  const channelProperties = useChannelProperties();
  const properties = channelProperties.get(channelId);
  !properties?.moreBottomToLoad && setMessages({
    [channelId]: sliceBeginning([...messages[channelId]!, message])
  });
};

const locallyRemoveMessage = (channelId: string, messageId: string) => {
  const channelMessages = messages[channelId];
  if (!channelMessages) return;
  const index = channelMessages.findIndex(m => m.id === messageId);
  if (index === -1) return;
  setMessages(channelId, produce(messages => messages?.splice(index, 1)));
}

const updateMessageReaction = (channelId: string, messageId: string, reaction: Partial<RawMessageReaction>) => {
  const channelMessages = messages[channelId];
  if (!channelMessages) return;
  const index = channelMessages.findIndex(m => m.id === messageId);
  if (index === -1) return;

  const message = channelMessages[index];
  const reactionIndex = message.reactions.findIndex(r => r.emojiId === reaction.emojiId && r.name === reaction.name)

  if (!reaction.count) {
    if (reactionIndex >= 0)
      return setMessages(channelId, index, "reactions", produce(arr => arr.splice(reactionIndex, 1)));
  }

  if (reactionIndex >= 0) {
    return setMessages(channelId, index, "reactions", reactionIndex, reaction);
  }

  setMessages(channelId, index, "reactions", message.reactions.length, reaction);
}

const get = (channelId: string) => messages[channelId]


const getMessagesByChannelId = (channelId: string) => messages[channelId];

const deleteChannelMessages = (channelId: string) => setMessages(channelId, undefined);

export default function useMessages() {
  return {
    getMessagesByChannelId,
    fetchAndStoreMessages,
    loadMoreTopAndStoreMessages,
    loadAroundAndStoreMessages,
    loadMoreBottomAndStoreMessages,
    editAndStoreMessage,
    sendAndStoreMessage,
    locallyRemoveMessage,
    pushMessage,
    deleteChannelMessages,
    get,
    updateLocalMessage,
    updateMessageReaction
  }
}