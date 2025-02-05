import styles from "./styles.module.scss";

import FriendItem from "./friend-item/InboxDrawerFriendItem";
import { createEffect, createSignal, For, Show, useTransition } from "solid-js";
import { Friend } from "@/chat-api/store/useFriends";
import { FriendStatus } from "@/chat-api/RawData";
import useStore from "@/chat-api/store/useStore";
import { useTransContext } from "@nerimity/solid-i18next";

const InboxDrawerFriends = () => {
  const [t] = useTransContext();
  const [separatedFriends, setSeparatedFriends] = createSignal<ReturnType<typeof separateFriends>>();
  const [pending, startTransition] = useTransition();
  const {friends} = useStore();

  createEffect(() => {
    startTransition(() => {
      setSeparatedFriends(separateFriends(friends.array()));
    })
  });
1

  return (
    <Show when={separatedFriends()} >
      <div class={styles.inboxDrawerFriends}>
        <div class={styles.title}>{t('inbox.drawer.requests')} ({separatedFriends()?.requests.length})</div>
        <For each={separatedFriends()?.requests}>
          {friend => <FriendItem friend={friend} />}
        </For>

        <div class={styles.title}>{t('inbox.drawer.online')} ({separatedFriends()?.onlineFriends.length})</div>
        <For each={separatedFriends()?.onlineFriends}>
          {friend => <FriendItem friend={friend} />}
        </For>
        <div class={styles.title}>{t('inbox.drawer.offline')} ({separatedFriends()?.offlineFriends.length})</div>
        <For each={separatedFriends()?.offlineFriends}>
          {friend => <FriendItem friend={friend} />}
        </For>
      </div>
    </Show>
  )
};

export default InboxDrawerFriends;


function separateFriends(friends: Friend[]) {
  const requests = [];
  const onlineFriends = [];
  const offlineFriends = [];


  for (let i = 0; i < friends.length; i++) {
    const friend = friends[i];
    const user = friend.recipient
    if (friend.status === FriendStatus.BLOCKED) continue;
    if (friend.status === FriendStatus.PENDING || friend.status === FriendStatus.SENT) {
      // move incoming requests to the top.
      if (friend.status === FriendStatus.PENDING) {
        requests.unshift(friend);
        continue;
      }
      requests.push(friend);
      continue;
    }
    if (!user.presence?.status) {
      offlineFriends.push(friend);
      continue;
    }
    onlineFriends.push(friend);
  }
  return { requests, onlineFriends, offlineFriends };
}