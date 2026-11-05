/**
 * Network protocol shared by client and server.
 *
 * The transport is Colyseus (WebSocket). Continuous state (positions, names,
 * appearance) travels through schema patches; discrete events travel as
 * messages. Keeping both in one file means the client and server can never
 * disagree about a message name or payload shape.
 */

import type { CharacterAppearance } from "./character";

export const ROOM_NAME = "district";
export const PROTOCOL_VERSION = 1;

/** Player movement input, sent client -> server at ~20 Hz. */
export interface MoveInput {
  /** Monotonic sequence number, used to discard out-of-order packets. */
  seq: number;
  /** Strafe axis, -1..1 */
  mx: number;
  /** Forward axis, -1..1 */
  mz: number;
  /** Desired facing, radians. */
  ry: number;
  sprint: boolean;
}

export interface ChatSendPayload {
  text: string;
}

export interface ChatReceivePayload {
  id: string;
  name: string;
  text: string;
  ts: number;
  /** True for server-generated notices (joins, leaves, reconnects). */
  system?: boolean;
}

/** Appearance fields a player can legitimately change in-world. */
export interface AppearanceUpdate {
  hairstyle?: string;
  outfit?: string;
}

/** Message names. Using constants prevents typo-driven silent failures. */
export const MSG = {
  MOVE: "move",
  CHAT: "chat",
  CHAT_EVENT: "chat",
  APPEARANCE: "appearance",
  APPEARANCE_EVENT: "appearance_changed",
  BUILDING: "building",
  BUILDING_EVENT: "building_event",
} as const;

/** Options a client passes when joining a district room. */
export interface JoinOptions {
  appearance: CharacterAppearance;
  /** Reserved for the Supabase session token introduced in a later milestone. */
  token?: string;
}

/** Result payload the server sends back after a successful join. */
export interface JoinResult {
  playerId: string;
  districtId: string;
  serverTime: number;
}

export interface BuildingEvent {
  buildingId: string;
  name: string;
  action: string;
  message: string;
  /** Optional appearance change caused by the interaction. */
  appearance?: AppearanceUpdate;
}
