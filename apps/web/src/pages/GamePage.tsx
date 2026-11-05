import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HAIRSTYLES,
  OUTFITS,
  getDistrict,
  type AppearanceUpdate,
  type Building,
  type CharacterAppearance,
} from "@naijaverse/shared";
import { GAME_SERVER_URL } from "../config";
import type { Account } from "../profile";
import { GameClient, type ConnectionStatus, type PlayerSnapshot } from "../game/networking/GameClient";
import { DistrictScene } from "../game/scenes/DistrictScene";
import type { NearbyBuilding } from "../game/interactions/proximity";
import { QUALITY_PRESETS, type QualityLevel } from "../game/engine/createEngine";
import { ChatPanel, type ChatLine } from "../components/game/ChatPanel";
import { StyleShop, type StyleShopOption } from "../components/game/StyleShop";
import { TouchControls } from "../components/game/TouchControls";

interface GamePageProps {
  account: Account;
  appearance: CharacterAppearance;
  onExit: () => void;
  /** Persists look changes made at the barber or boutique. */
  onAppearanceChange: (update: AppearanceUpdate) => void;
}

const QUALITY_LEVELS = Object.keys(QUALITY_PRESETS) as QualityLevel[];
const CHAT_HISTORY = 80;

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  idle: "Standby",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
  error: "Connection error",
};

interface Toast {
  id: number;
  text: string;
}

/**
 * The in-world screen: hosts the Babylon canvas and the whole HUD.
 *
 * It owns exactly one `GameClient` and one `DistrictScene` for its lifetime.
 * The scene is driven by the game loop, not by React — React only renders HUD
 * that changes occasionally (connection, roster, chat, prompts).
 */
export function GamePage({ account, appearance, onExit, onAppearanceChange }: GamePageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<DistrictScene | null>(null);
  const clientRef = useRef<GameClient | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [statusDetail, setStatusDetail] = useState("");
  const [roster, setRoster] = useState<PlayerSnapshot[]>([]);
  const [nearest, setNearest] = useState<NearbyBuilding | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [shop, setShop] = useState<{ building: Building } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [fps, setFps] = useState(0);
  const [quality, setQuality] = useState<QualityLevel>("low");
  const [showSettings, setShowSettings] = useState(false);

  const chatKey = useRef(0);
  const toastKey = useRef(0);

  const isTouch = useMemo(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window),
    [],
  );

  // Latest-value refs: the scene is created once, but its key handlers must see
  // the current frame's state without the scene being rebuilt.
  const nearestRef = useRef<NearbyBuilding | null>(null);

  const doInteract = useCallback(() => {
    const current = nearestRef.current;
    if (!current) return;
    const building = current.building;
    if (building.interaction === "salon" || building.interaction === "boutique") {
      setChatOpen(false);
      setShop({ building });
      return;
    }
    clientRef.current?.interact(building.id);
  }, []);

  const openChat = useCallback(() => {
    setShop(null);
    setChatOpen(true);
  }, []);

  const applyAppearance = useCallback(
    (update: AppearanceUpdate) => {
      sceneRef.current?.applyLocalAppearance(update);
      onAppearanceChange(update);
    },
    [onAppearanceChange],
  );

  const interactRef = useRef(doInteract);
  const openChatRef = useRef(openChat);
  const applyAppearanceRef = useRef(applyAppearance);
  useEffect(() => {
    nearestRef.current = nearest;
  }, [nearest]);
  useEffect(() => {
    interactRef.current = doInteract;
  }, [doInteract]);
  useEffect(() => {
    openChatRef.current = openChat;
  }, [openChat]);
  useEffect(() => {
    applyAppearanceRef.current = applyAppearance;
  }, [applyAppearance]);

  // -------------------------------------------------------------------------
  // Boot the world exactly once.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const client = new GameClient(GAME_SERVER_URL);
    const scene = new DistrictScene(canvas, client, appearance, quality, {
      onNearestBuilding: (next) => setNearest(next),
      onInteractRequest: () => interactRef.current(),
      onChatRequest: () => openChatRef.current(),
      onFps: (value) => setFps(value),
    });

    client.setHandlers({
      onStatus: (next, detail) => {
        setStatus(next);
        setStatusDetail(detail ?? "");
      },
      onChat: (message) => {
        setChat((lines) => {
          const next: ChatLine[] = [
            ...lines,
            {
              key: chatKey.current++,
              name: message.name,
              text: message.text,
              system: message.system === true,
            },
          ];
          return next.length > CHAT_HISTORY ? next.slice(next.length - CHAT_HISTORY) : next;
        });
      },
      onBuilding: (event) => {
        toastKey.current += 1;
        setToast({ id: toastKey.current, text: event.message });
        if (event.appearance) applyAppearanceRef.current(event.appearance);
      },
      onRoster: (players) => setRoster(players),
    });

    sceneRef.current = scene;
    clientRef.current = client;
    scene.start();
    void client.connect(appearance).catch(() => {
      // The client already reported the failure through `onStatus`.
    });

    // A refresh or a closed tab never runs the React cleanup, so tell the
    // server we are leaving instead of holding the character for 15 seconds.
    const handlePageHide = () => client.leave();
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      client.leave();
      scene.dispose();
      clientRef.current = null;
      sceneRef.current = null;
    };
    // The scene is deliberately created once for the lifetime of the screen;
    // everything that must stay current is reached through a ref.
  }, []);

  // Movement stops while a panel is capturing the keyboard.
  useEffect(() => {
    sceneRef.current?.setInputEnabled(!chatOpen && !shop);
  }, [chatOpen, shop]);

  useEffect(() => {
    sceneRef.current?.setQuality(quality);
  }, [quality]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const chooseStyle = useCallback(
    (optionId: string) => {
      if (!shop) return;
      const action = shop.building.interaction === "salon" ? "hairstyle" : "outfit";
      clientRef.current?.interact(shop.building.id, action, optionId);
      setShop(null);
    },
    [shop],
  );

  const sendChat = useCallback((text: string) => {
    clientRef.current?.sendChat(text);
  }, []);

  const handleExit = useCallback(() => {
    clientRef.current?.leave();
    onExit();
  }, [onExit]);

  const handleRetry = useCallback(() => {
    setStatus("connecting");
    void clientRef.current?.connect(appearance).catch(() => {});
  }, [appearance]);

  const online = roster.reduce((count, player) => (player.connected ? count + 1 : count), 0);
  const districtName = getDistrict("yaba")?.name ?? "Yaba";

  const shopOptions: StyleShopOption[] = shop
    ? shop.building.interaction === "salon"
      ? HAIRSTYLES.map((item) => ({ id: item.id, label: item.label }))
      : OUTFITS.map((item) => ({ id: item.id, label: item.label }))
    : [];

  return (
    <div className="game">
      <canvas ref={canvasRef} />

      {/* Connection + roster */}
      <div className="overlay hud-top-left">
        <div className="panel">
          <div className="status">
            <span className={`dot dot-${status}`} />
            {STATUS_LABEL[status]}
          </div>
          <div className="status-meta">
            {districtName} · {online} {online === 1 ? "player" : "players"} online · {fps} fps
          </div>
          <div className="status-meta">Signed in as @{account.username}</div>
          {statusDetail ? <div className="status-meta">{statusDetail}</div> : null}
        </div>

        {!isTouch ? (
          <div className="panel" style={{ marginTop: 8 }}>
            <div className="controls-help">
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> move · <kbd>Shift</kbd> sprint
              <br />
              <kbd>Enter</kbd> chat · <kbd>E</kbd> interact
            </div>
          </div>
        ) : null}
      </div>

      {/* Settings + exit */}
      <div className="overlay hud-top-right">
        <div className="stack" style={{ alignItems: "flex-end", gap: 8 }}>
          {showSettings ? (
            <div className="panel" style={{ width: 240 }}>
              <div className="settings-row">
                <span>Graphics</span>
                <select value={quality} onChange={(event) => setQuality(event.target.value as QualityLevel)}>
                  {QUALITY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {QUALITY_PRESETS[level].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="status-meta">
                Lower settings keep the frame rate steady on mid-range phones. The simulation is identical at every
                level.
              </div>
            </div>
          ) : null}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-sm" type="button" onClick={() => setShowSettings((value) => !value)}>
              Settings
            </button>
            <button className="btn btn-sm" type="button" onClick={handleExit}>
              Leave city
            </button>
          </div>
        </div>
      </div>

      {/* Prompts, toasts and chat. On touch screens this sits above the thumbstick. */}
      <div className="overlay hud-bottom-center" style={isTouch ? { bottom: 172 } : undefined}>
        <div className="stack" style={{ gap: 8 }}>
          {toast ? <div className="panel">{toast.text}</div> : null}

          {shop ? (
            <StyleShop
              title={shop.building.name}
              subtitle={shop.building.blurb}
              options={shopOptions}
              onSelect={chooseStyle}
              onClose={() => setShop(null)}
            />
          ) : nearest ? (
            <div className="panel prompt">
              <div>
                <div className="name">{nearest.building.name}</div>
                <div className="blurb">{nearest.building.blurb}</div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={doInteract}
                disabled={chatOpen}
              >
                {nearest.building.interaction === "salon"
                  ? "Change hair"
                  : nearest.building.interaction === "boutique"
                    ? "Change outfit"
                    : "Look around"}
              </button>
            </div>
          ) : null}

          {chatOpen ? <ChatPanel lines={chat} onSend={sendChat} onClose={() => setChatOpen(false)} /> : null}
        </div>
      </div>

      {/* Mobile controls — hidden while the chat keyboard is up */}
      {isTouch && !chatOpen ? (
        <>
          <div className="overlay hud-bottom-left">
            <TouchControls onMove={(x, y, active) => sceneRef.current?.setTouchInput(x, y, active)} />
          </div>
          <div className="overlay hud-bottom-right">
            <div className="touch-actions">
              <button className="touch-btn" type="button" onClick={openChat}>
                Chat
              </button>
              <button className="touch-btn" type="button" onClick={doInteract}>
                Use
              </button>
              <button
                className="touch-btn"
                type="button"
                onPointerDown={() => sceneRef.current?.setSprintHeld(true)}
                onPointerUp={() => sceneRef.current?.setSprintHeld(false)}
                onPointerLeave={() => sceneRef.current?.setSprintHeld(false)}
                onPointerCancel={() => sceneRef.current?.setSprintHeld(false)}
              >
                Run
              </button>
            </div>
          </div>
        </>
      ) : null}

      {/* Hard failure: the server is unreachable */}
      {status === "error" ? (
        <div
          className="overlay"
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(420px, 90%)",
          }}
        >
          <div className="panel stack">
            <strong style={{ fontSize: 15 }}>Could not reach the city</strong>
            <div className="status-meta">
              {statusDetail || `The game server at ${GAME_SERVER_URL} is not responding.`}
            </div>
            <div className="row">
              <button className="btn btn-primary btn-sm" type="button" onClick={handleRetry}>
                Try again
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={handleExit}>
                Back to menu
              </button>
            </div>
            <div className="status-meta">
              Start the server with <code>npm run dev</code> from the project root.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
