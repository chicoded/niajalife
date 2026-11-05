import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Mesh,
  Scene,
  ShadowGenerator,
  Vector3,
} from "@babylonjs/core";
import { AdvancedDynamicTexture } from "@babylonjs/gui";
import {
  MOVEMENT,
  PLAYER_RADIUS,
  WORLD,
  getDistrictLayout,
  resolveWorldCollisions,
  type AppearanceUpdate,
  type CharacterAppearance,
} from "@naijaverse/shared";
import { QUALITY_PRESETS, applyQuality, createEngine, type QualityLevel } from "../engine/createEngine";
import { buildCity } from "../world/buildCity";
import { createAvatar, type AvatarLook, type AvatarRig } from "../characters/createAvatar";
import { createNameTag, createNameTagLayer, type NameTagHandle } from "../characters/nameTags";
import { createFollowCamera, rightOf, updateFollowCamera } from "../camera/followCamera";
import { findNearestInteractable, type NearbyBuilding } from "../interactions/proximity";
import type { GameClient } from "../networking/GameClient";

export interface DistrictSceneCallbacks {
  onNearestBuilding: (nearest: NearbyBuilding | null) => void;
  onInteractRequest: () => void;
  onChatRequest: () => void;
  onFps: (fps: number) => void;
}

interface RemoteEntry {
  rig: AvatarRig;
  tag: NameTagHandle;
  look: AvatarLook;
  targetX: number;
  targetZ: number;
  targetRotY: number;
  connected: boolean;
}

const SEND_INTERVAL = WORLD.tickMs / 1000;
const MOVEMENT_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"]);

/**
 * Renders and drives one district.
 *
 * Movement is *predicted* locally and *confirmed* by the server: the client
 * integrates the same intent through the same shared collision helper, then
 * snaps to the server's position if the two ever drift apart by more than a
 * few metres. See `docs/MULTIPLAYER.md`.
 */
export class DistrictScene {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly client: GameClient;
  private readonly callbacks: DistrictSceneCallbacks;
  private readonly layout = getDistrictLayout("yaba");
  private readonly layer: AdvancedDynamicTexture;

  private readonly localRig: AvatarRig;
  private readonly localTag: NameTagHandle;
  private readonly localLook: AvatarLook;

  private readonly remotes = new Map<string, RemoteEntry>();
  private readonly keys = new Set<string>();
  private readonly touch = { active: false, x: 0, y: 0, sprint: false };

  private ground: Mesh | null = null;
  private shadowCasters: Mesh[] = [];
  private shadowGenerator: ShadowGenerator | null = null;
  private quality: QualityLevel;

  private localX: number;
  private localZ: number;
  private localRotY: number;

  private inputEnabled = true;
  private sendAccumulator = 0;
  private fpsAccumulator = 0;
  private fpsFrames = 0;
  private nearestId: string | null = null;
  private cameraForward = new Vector3(0, 0, 1);
  private disposed = false;

  constructor(
    canvas: HTMLCanvasElement,
    client: GameClient,
    appearance: CharacterAppearance,
    quality: QualityLevel,
    callbacks: DistrictSceneCallbacks,
  ) {
    this.client = client;
    this.callbacks = callbacks;
    this.quality = quality;

    this.engine = createEngine(canvas, quality);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.62, 0.76, 0.9, 1);

    const spawn = this.layout.spawn;
    this.localX = spawn.x;
    this.localZ = spawn.z;
    this.localRotY = spawn.rotY;

    const city = buildCity(this.scene, this.layout);
    this.ground = city.ground;
    this.shadowCasters = city.shadowCasters;
    this.buildLighting();

    this.camera = createFollowCamera(this.scene, canvas, new Vector3(this.localX, 0, this.localZ));

    this.localLook = {
      skinTone: appearance.skinTone,
      hairstyle: appearance.hairstyle,
      outfit: appearance.outfit,
    };
    this.localRig = createAvatar(this.scene, this.localLook, "local");

    this.layer = createNameTagLayer(this.scene);
    this.localTag = createNameTag(this.layer, this.localRig.head, appearance.name, true);

    this.localRig.root.position.set(this.localX, 0, this.localZ);
    this.localRig.root.rotation.y = this.localRotY;

    this.applyPostProcessing();
  }

  start(): void {
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
    this.engine.runRenderLoop(this.renderFrame);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    this.engine.stopRenderLoop();
    for (const entry of this.remotes.values()) {
      entry.rig.dispose();
      entry.tag.dispose();
    }
    this.remotes.clear();
    this.scene.dispose();
    this.engine.dispose();
  }

  // -------------------------------------------------------------------------
  // Public controls used by the React HUD
  // -------------------------------------------------------------------------

  /** Chat typing must not also drive the character. */
  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (!enabled) this.keys.clear();
  }

  setTouchInput(x: number, y: number, active: boolean): void {
    this.touch.active = active;
    this.touch.x = x;
    this.touch.y = y;
  }

  setSprintHeld(sprint: boolean): void {
    this.touch.sprint = sprint;
  }

  setQuality(quality: QualityLevel): void {
    if (quality === this.quality) return;
    this.quality = quality;
    applyQuality(this.engine, quality);
    this.applyPostProcessing();
  }

  /** Reflects a server-confirmed appearance change (salon, boutique). */
  applyLocalAppearance(update: AppearanceUpdate): void {
    if (update.hairstyle) this.localLook.hairstyle = update.hairstyle;
    if (update.outfit) this.localLook.outfit = update.outfit;
    this.localRig.setLook(this.localLook);
  }

  setName(name: string): void {
    this.localTag.setText(name);
  }

  get nearestBuilding(): NearbyBuilding | null {
    return findNearestInteractable(this.layout.buildings, this.localX, this.localZ);
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  private renderFrame = (): void => {
    if (this.disposed) return;
    const dt = Math.min(this.engine.getDeltaTime(), 100) / 1000;
    if (dt <= 0) return;

    this.cameraForward = updateFollowCamera(this.camera, new Vector3(this.localX, 0, this.localZ), dt);
    this.stepLocalPlayer(dt);
    this.syncRemotes(dt);
    this.updateNearestBuilding();
    this.reportFps(dt);

    this.scene.render();
  };

  private stepLocalPlayer(dt: number): void {
    const forward = this.cameraForward;
    const right = rightOf(forward);

    let strafe = 0;
    let advance = 0;
    if (this.inputEnabled) {
      if (this.keys.has("w") || this.keys.has("arrowup")) advance += 1;
      if (this.keys.has("s") || this.keys.has("arrowdown")) advance -= 1;
      if (this.keys.has("d") || this.keys.has("arrowright")) strafe += 1;
      if (this.keys.has("a") || this.keys.has("arrowleft")) strafe -= 1;
    }
    if (this.touch.active) {
      advance = this.touch.y;
      strafe = this.touch.x;
    }

    const sprint = this.keys.has("shift") || this.touch.sprint;

    // Input is camera-relative, then converted into a world-space direction.
    // This is the exact vector the server integrates, so prediction matches.
    let dirX = forward.x * advance + right.x * strafe;
    let dirZ = forward.z * advance + right.z * strafe;

    const magnitude = Math.hypot(dirX, dirZ);
    const moving = magnitude > 0.06;
    if (moving) {
      const scale = Math.min(magnitude, MOVEMENT.maxInput) / magnitude;
      dirX *= scale;
      dirZ *= scale;

      const speed = MOVEMENT.speed * (sprint ? MOVEMENT.sprintMultiplier : 1);
      const nextX = clamp(this.localX + dirX * speed * dt, -WORLD.bounds, WORLD.bounds);
      const nextZ = clamp(this.localZ + dirZ * speed * dt, -WORLD.bounds, WORLD.bounds);
      const resolved = resolveWorldCollisions(this.layout, nextX, nextZ, PLAYER_RADIUS);
      this.localX = resolved.x;
      this.localZ = resolved.z;
      this.localRotY = approachAngle(this.localRotY, Math.atan2(dirX, dirZ), dt * 12);
    }

    // Reconciliation: trust local prediction, but never drift far from truth.
    const server = this.client.localSnapshot();
    if (server) {
      const error = Math.hypot(server.x - this.localX, server.z - this.localZ);
      if (error > 3) {
        this.localX = server.x;
        this.localZ = server.z;
      }
    }

    this.localRig.root.position.set(this.localX, 0, this.localZ);
    this.localRig.root.rotation.y = this.localRotY;
    this.localRig.animate(dt, moving, sprint ? 1.6 : 1);

    // Input is sent every tick — including zeros. If we stopped sending, the
    // server would happily keep applying the last non-zero intent.
    this.sendAccumulator += dt;
    if (this.sendAccumulator >= SEND_INTERVAL) {
      this.sendAccumulator = 0;
      this.client.sendInput(dirX, dirZ, this.localRotY, sprint);
    }
  }

  private syncRemotes(dt: number): void {
    const myId = this.client.sessionId;
    const present = new Set<string>();

    this.client.forEachPlayer((player) => {
      if (player.id === myId) return;
      present.add(player.id);

      let entry = this.remotes.get(player.id);
      if (!entry) {
        const look: AvatarLook = {
          skinTone: player.skinTone,
          hairstyle: player.hairstyle,
          outfit: player.outfit,
        };
        const rig = createAvatar(this.scene, look, `remote-${player.id}`);
        rig.root.position.set(player.x, 0, player.z);
        const tag = createNameTag(this.layer, rig.head, player.name, false);
        entry = {
          rig,
          tag,
          look,
          targetX: player.x,
          targetZ: player.z,
          targetRotY: player.rotY,
          connected: player.connected,
        };
        this.remotes.set(player.id, entry);
      }

      if (
        entry.look.hairstyle !== player.hairstyle ||
        entry.look.outfit !== player.outfit ||
        entry.look.skinTone !== player.skinTone
      ) {
        entry.look = { skinTone: player.skinTone, hairstyle: player.hairstyle, outfit: player.outfit };
        entry.rig.setLook(entry.look);
      }

      entry.tag.setText(player.name);
      entry.targetX = player.x;
      entry.targetZ = player.z;
      entry.targetRotY = player.rotY;
      entry.connected = player.connected;
    });

    for (const [id, entry] of this.remotes) {
      if (present.has(id)) continue;
      entry.rig.dispose();
      entry.tag.dispose();
      this.remotes.delete(id);
    }

    // Smooth interpolation towards the last authoritative position.
    const lerp = Math.min(1, dt * 12);
    for (const entry of this.remotes.values()) {
      const position = entry.rig.root.position;
      position.x += (entry.targetX - position.x) * lerp;
      position.z += (entry.targetZ - position.z) * lerp;
      entry.rig.root.rotation.y = approachAngle(entry.rig.root.rotation.y, entry.targetRotY, lerp);
      const stillMoving = Math.hypot(entry.targetX - position.x, entry.targetZ - position.z) > 0.03;
      entry.rig.animate(dt, stillMoving, 1);
      entry.rig.root.setEnabled(entry.connected);
      entry.tag.control.isVisible = entry.connected;
    }
  }

  private updateNearestBuilding(): void {
    const nearest = findNearestInteractable(this.layout.buildings, this.localX, this.localZ);
    const id = nearest?.building.id ?? null;
    if (id === this.nearestId) return;
    this.nearestId = id;
    this.callbacks.onNearestBuilding(nearest);
  }

  private reportFps(dt: number): void {
    this.fpsAccumulator += dt;
    this.fpsFrames++;
    if (this.fpsAccumulator < 0.5) return;
    this.callbacks.onFps(Math.round(this.fpsFrames / this.fpsAccumulator));
    this.fpsAccumulator = 0;
    this.fpsFrames = 0;
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  private buildLighting(): void {
    const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.15), this.scene);
    hemi.intensity = 0.92;
    hemi.diffuse = Color3.FromHexString("#fff4dd");
    hemi.groundColor = Color3.FromHexString("#4c5145");
    hemi.specular = new Color3(0.04, 0.04, 0.04);

    const sun = new DirectionalLight("sun", new Vector3(-0.45, -1, -0.35), this.scene);
    sun.position = new Vector3(70, 110, 60);
    sun.intensity = 0.55;
  }

  /** Applies the parts of a quality preset that live on the scene itself. */
  private applyPostProcessing(): void {
    const preset = QUALITY_PRESETS[this.quality];

    this.scene.fogMode = preset.fog ? Scene.FOGMODE_LINEAR : Scene.FOGMODE_NONE;
    if (preset.fog) {
      this.scene.fogStart = 110;
      this.scene.fogEnd = 230;
      this.scene.fogColor = Color3.FromHexString("#a8bfd4");
    }

    if (this.shadowGenerator) {
      this.shadowGenerator.dispose();
      this.shadowGenerator = null;
    }
    if (!preset.shadows) return;

    const sun = this.scene.getLightByName("sun");
    if (!(sun instanceof DirectionalLight)) return;

    const generator = new ShadowGenerator(1024, sun);
    generator.useBlurExponentialShadowMap = true;
    generator.blurKernel = 16;
    for (const mesh of this.shadowCasters) generator.addShadowCaster(mesh);
    if (this.ground) this.ground.receiveShadows = true;
    this.shadowGenerator = generator;
  }

  // -------------------------------------------------------------------------
  // DOM events
  // -------------------------------------------------------------------------

  private handleResize = (): void => {
    this.engine.resize();
  };

  private handleBlur = (): void => {
    this.keys.clear();
    this.touch.active = false;
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    // Never hijack keys while the player is typing in the chat box.
    if (isTypingTarget(event.target)) return;

    if (event.key === "Enter") {
      this.callbacks.onChatRequest();
      return;
    }
    if (!this.inputEnabled) return;

    const key = event.key.toLowerCase();
    if (key === "e") {
      if (!event.repeat) this.callbacks.onInteractRequest();
      return;
    }
    if (MOVEMENT_KEYS.has(key)) event.preventDefault();
    this.keys.add(key);
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.key.toLowerCase());
  };
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Interpolates an angle along the shortest path. */
function approachAngle(current: number, target: number, factor: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * Math.min(1, factor);
}
