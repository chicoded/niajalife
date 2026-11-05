import { Client, type Room } from "colyseus.js";
import {
  MSG,
  ROOM_NAME,
  type BuildingEvent,
  type CharacterAppearance,
  type ChatReceivePayload,
} from "@naijaverse/shared";

/**
 * The browser's only door to the game world.
 *
 * It sends *intent* (movement axes, chat text, an interaction request) and
 * receives authoritative state. It never decides a position or an outcome —
 * see `docs/MULTIPLAYER.md`.
 */

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export interface PlayerSnapshot {
  id: string;
  name: string;
  gender: string;
  skinTone: string;
  hairstyle: string;
  outfit: string;
  trait: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  connected: boolean;
}

export interface GameClientHandlers {
  onStatus?: (status: ConnectionStatus, detail?: string) => void;
  onChat?: (message: ChatReceivePayload) => void;
  onBuilding?: (event: BuildingEvent) => void;
  onRoster?: (players: PlayerSnapshot[]) => void;
}

// The shapes Colyseus replicates. Declared locally so the client does not
// depend on server-only schema classes.
interface PlayerStateLike {
  id: string;
  name: string;
  gender: string;
  skinTone: string;
  hairstyle: string;
  outfit: string;
  trait: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  connected: boolean;
}

interface PlayersMapLike {
  onAdd(cb: (player: PlayerStateLike, key: string) => void): void;
  onRemove(cb: (player: PlayerStateLike, key: string) => void): void;
  forEach(cb: (player: PlayerStateLike, key: string) => void): void;
  get(key: string): PlayerStateLike | undefined;
  size: number;
}

interface DistrictStateLike {
  players: PlayersMapLike;
  districtId: string;
  serverTime: number;
  tickCount: number;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class GameClient {
  private readonly client: Client;
  private room: Room | null = null;
  private handlers: GameClientHandlers = {};
  private appearance: CharacterAppearance | null = null;

  /** Monotonic movement sequence. Must restart at 0 for every new session. */
  private seq = 0;
  private intentionalLeave = false;
  private reconnecting = false;
  private readonly maxReconnectAttempts = 5;

  constructor(endpoint: string) {
    this.client = new Client(endpoint);
  }

  setHandlers(handlers: GameClientHandlers): void {
    this.handlers = handlers;
  }

  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  get districtId(): string {
    return this.state()?.districtId ?? "yaba";
  }

  get playerCount(): number {
    return this.state()?.players.size ?? 0;
  }

  get connected(): boolean {
    return this.room !== null;
  }

  async connect(appearance: CharacterAppearance): Promise<void> {
    this.appearance = appearance;
    this.intentionalLeave = false;
    this.emitStatus("connecting");
    try {
      const room = await this.client.joinOrCreate(ROOM_NAME, {
        districtId: "yaba",
        appearance,
      });
      this.bindRoom(room);
      this.emitStatus("connected");
    } catch (error) {
      this.emitStatus("error", describe(error));
      throw error;
    }
  }

  leave(): void {
    this.intentionalLeave = true;
    this.room?.leave(true);
    this.room = null;
    this.emitStatus("disconnected");
  }

  /** Sends the current movement intent. The server clamps and integrates it. */
  sendInput(mx: number, mz: number, ry: number, sprint: boolean): void {
    if (!this.room) return;
    this.room.send(MSG.MOVE, { seq: this.seq++, mx, mz, ry, sprint });
  }

  sendChat(text: string): void {
    if (!this.room || !text.trim()) return;
    this.room.send(MSG.CHAT, { text });
  }

  interact(buildingId: string, action?: string, value?: string): void {
    if (!this.room) return;
    this.room.send(MSG.BUILDING, { buildingId, action, value });
  }

  /** Reads the authoritative position of our own character. */
  localSnapshot(): PlayerSnapshot | null {
    const id = this.sessionId;
    if (!id) return null;
    const player = this.state()?.players.get(id);
    return player ? toSnapshot(player) : null;
  }

  /**
   * Streams every replicated player without allocating an array, which keeps
   * the render loop free of per-frame garbage.
   */
  forEachPlayer(callback: (player: PlayerSnapshot) => void): void {
    this.state()?.players.forEach((player) => callback(toSnapshot(player)));
  }

  private state(): DistrictStateLike | null {
    if (!this.room) return null;
    return this.room.state as unknown as DistrictStateLike;
  }

  private bindRoom(room: Room): void {
    this.room = room;
    // A new or restored session always starts its sequence from zero, matching
    // the sequence guard the server resets on join and on reconnection.
    this.seq = 0;

    room.onMessage(MSG.CHAT_EVENT, (message: ChatReceivePayload) => {
      this.handlers.onChat?.(message);
    });

    room.onMessage(MSG.BUILDING_EVENT, (event: BuildingEvent) => {
      this.handlers.onBuilding?.(event);
    });

    const state = room.state as unknown as DistrictStateLike | undefined;
    state?.players.onAdd(() => this.emitRoster());
    state?.players.onRemove(() => this.emitRoster());
    room.onStateChange(() => this.emitRoster());

    room.onError((code, message) => {
      this.emitStatus("error", `Server error ${code}${message ? `: ${message}` : ""}`);
    });

    room.onLeave((code) => this.handleLeave(code));
  }

  private handleLeave(code: number): void {
    this.room = null;
    if (this.intentionalLeave || code === 1000) {
      this.emitStatus("disconnected");
      return;
    }
    void this.attemptReconnect();
  }

  private async attemptReconnect(): Promise<void> {
    if (this.reconnecting) return;
    this.reconnecting = true;
    this.emitStatus("reconnecting", "Connection lost. Trying to restore your session…");

    for (let attempt = 1; attempt <= this.maxReconnectAttempts; attempt++) {
      await delay(Math.min(4000, 600 * attempt));
      if (this.intentionalLeave) break;
      const restored = await this.tryResume();
      if (restored) {
        this.reconnecting = false;
        this.emitStatus("connected");
        return;
      }
    }

    // The reconnection window expired. Re-enter the city as a fresh session so
    // the player is never stranded on a dead screen.
    if (!this.intentionalLeave && this.appearance) {
      try {
        const room = await this.client.joinOrCreate(ROOM_NAME, {
          districtId: "yaba",
          appearance: this.appearance,
        });
        this.reconnecting = false;
        this.bindRoom(room);
        this.emitStatus("connected", "Rejoined the city with a new session.");
        return;
      } catch (error) {
        this.reconnecting = false;
        this.emitStatus("error", describe(error));
        return;
      }
    }

    this.reconnecting = false;
    this.emitStatus("disconnected");
  }

  private async tryResume(): Promise<boolean> {
    const token = this.resumeToken();
    if (!token) return false;
    const reconnect = (
      this.client as unknown as { reconnect?: (token: string) => Promise<Room> }
    ).reconnect;
    if (typeof reconnect !== "function") return false;
    try {
      const room = await reconnect.call(this.client, token);
      this.bindRoom(room);
      return true;
    } catch {
      return false;
    }
  }

  private resumeToken(): string | null {
    const room = this.room as unknown as { reconnectionToken?: string } | null;
    return room?.reconnectionToken ?? null;
  }

  private emitStatus(status: ConnectionStatus, detail?: string): void {
    this.handlers.onStatus?.(status, detail);
  }

  private emitRoster(): void {
    const state = this.state();
    if (!state) return;
    const players: PlayerSnapshot[] = [];
    state.players.forEach((player) => players.push(toSnapshot(player)));
    this.handlers.onRoster?.(players);
  }
}

function toSnapshot(player: PlayerStateLike): PlayerSnapshot {
  return {
    id: player.id,
    name: player.name,
    gender: player.gender,
    skinTone: player.skinTone,
    hairstyle: player.hairstyle,
    outfit: player.outfit,
    trait: player.trait,
    x: player.x,
    y: player.y,
    z: player.z,
    rotY: player.rotY,
    connected: player.connected,
  };
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
