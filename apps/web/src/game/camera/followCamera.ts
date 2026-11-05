import { ArcRotateCamera, Scene, Vector3 } from "@babylonjs/core";

/** The distance from the character that the follow camera orbits at. */
export const CAMERA_DEFAULTS = {
  alpha: -Math.PI / 2,
  beta: 1.08,
  radius: 11,
  targetHeight: 1.35,
} as const;

/**
 * A third-person orbit camera that follows the player.
 *
 * Mouse drag / touch drag rotates it, the wheel changes distance. Movement is
 * interpreted relative to where this camera is looking, which is what makes
 * WASD feel correct in a third-person game.
 */
export function createFollowCamera(scene: Scene, canvas: HTMLCanvasElement, start: Vector3): ArcRotateCamera {
  const camera = new ArcRotateCamera(
    "followCamera",
    CAMERA_DEFAULTS.alpha,
    CAMERA_DEFAULTS.beta,
    CAMERA_DEFAULTS.radius,
    start.clone(),
    scene,
  );
  camera.attachControl(canvas, true);

  camera.lowerRadiusLimit = 5;
  camera.upperRadiusLimit = 22;
  camera.lowerBetaLimit = 0.42;
  camera.upperBetaLimit = 1.32;
  camera.wheelPrecision = 40;
  camera.pinchPrecision = 120;
  camera.panningSensibility = 0;
  camera.inertia = 0.72;
  camera.angularSensibilityX = 1400;
  camera.angularSensibilityY = 1400;
  camera.minZ = 0.4;
  camera.maxZ = 400;

  // Arrow keys must move the character, not the camera.
  camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");
  // Middle/right-drag panning fights the follow behaviour, so drop it.
  camera.inputs.removeByType("ArcRotateCameraPointingInput");

  return camera;
}

/**
 * Smoothly re-centres the camera on the player and returns the horizontal
 * (XZ) forward direction, which the movement code uses to make WASD
 * camera-relative.
 */
export function updateFollowCamera(camera: ArcRotateCamera, playerPos: Vector3, dt: number): Vector3 {
  const focus = playerPos.add(new Vector3(0, CAMERA_DEFAULTS.targetHeight, 0));
  const lerp = Math.min(1, dt * 9);
  camera.target.x += (focus.x - camera.target.x) * lerp;
  camera.target.y += (focus.y - camera.target.y) * lerp;
  camera.target.z += (focus.z - camera.target.z) * lerp;

  const forward = camera.getForwardRay().direction;
  const horizontal = new Vector3(forward.x, 0, forward.z);
  if (horizontal.lengthSquared() < 1e-6) return new Vector3(0, 0, 1);
  return horizontal.normalize();
}

/** Converts a camera-forward vector into its right-hand perpendicular on XZ. */
export function rightOf(forward: Vector3): Vector3 {
  return new Vector3(forward.z, 0, -forward.x);
}
