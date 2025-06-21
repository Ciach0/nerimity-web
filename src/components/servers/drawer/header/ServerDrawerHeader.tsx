import styles from "./styles.module.scss";
import Icon from "@/components/ui/icon/Icon";
import { useParams } from "solid-navigator";
import { createSignal, Show } from "solid-js";
import useStore from "@/chat-api/store/useStore";
import ContextMenuServer from "@/components/servers/context-menu/ContextMenuServer";
import { ServerVerifiedIcon } from "../../ServerVerifiedIcon";
import { DrawerHeader } from "@/components/drawer-header/DrawerHeader";
import Button from "@/components/ui/Button";

const ServerDrawerHeader = () => {
  const params = useParams();
  const [contextPosition, setContextPosition] = createSignal<
    { x: number; y: number } | undefined
  >();
  const { servers } = useStore();
  const server = () => servers.get(params.serverId!);

  const onClick = (e: any) => {
    setContextPosition({ x: e.clientX, y: e.clientY });
  };

  return (
    <DrawerHeader>
      <div class={styles.headerContainer}>
        <ContextMenuServer
          onClose={() => setContextPosition(undefined)}
          position={contextPosition()}
          serverId={params.serverId}
          triggerClassName={styles.showMoreIcon}
        />
        <div class={styles.serverName}>{server()?.name}</div>
        <Show when={server()?.verified}>
          <ServerVerifiedIcon />
        </Show>
        <Button
          class={styles.showMoreIcon}
          iconName="more_vert"
          iconSize={20}
          onClick={onClick}
          padding={7}
        />
      </div>
    </DrawerHeader>
  );
};

export default ServerDrawerHeader;
