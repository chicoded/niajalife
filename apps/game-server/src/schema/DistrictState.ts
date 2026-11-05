import { Schema, MapSchema, type } from "@colyseus/schema";

/**
 * A single player inside a district.
 *
 * Fields marked with `@type` are the authoritative, replicated state. Fields
 * without a decorator stay on the server (they are never serialised), which is
 * where we keep raw input and rate-limit bookkeeping.
 */
export class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "";
  @type("string") gender = "female";
  @type("string") skinTone = "caramel";
  @type("string") hairstyle = "braids";
  @type("string") outfit = "ankara";
  @type("string") trait = "ambitious";

  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;
  @type("number") rotY = 0;

  /** False while the player is inside their reconnection window. */
  @type("boolean") connected = true;

  @type("number") joinedAt = 0;

  // ---- server-only, never replicated -------------------------------------
  /** Latest movement input axes, magnitude <= 1 after validation. */
  inputX = 0;
  inputZ = 0;
  sprint = false;
  /** Highest movement sequence number accepted so far. */
  lastSeq = -1;
  lastChatAt = 0;
}

export class DistrictState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type("string") districtId = "yaba";
  /** ms since epoch, refreshed every tick, used for light clock sync. */
  @type("number") serverTime = 0;
  @type("number") tickCount = 0;
}
