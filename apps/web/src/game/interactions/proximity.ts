import { INTERACTION_RADIUS, distanceToBuilding, type Building } from "@naijaverse/shared";

export interface NearbyBuilding {
  building: Building;
  distance: number;
}

/**
 * Finds the closest building the player is allowed to interact with.
 *
 * This is a *hint* for the HUD only. The server repeats the same distance check
 * before acting on any interaction, so a modified client cannot interact with
 * a building from across the map.
 */
export function findNearestInteractable(buildings: Building[], x: number, z: number): NearbyBuilding | null {
  let best: NearbyBuilding | null = null;
  for (const building of buildings) {
    const distance = distanceToBuilding(building, x, z);
    if (distance > INTERACTION_RADIUS) continue;
    if (!best || distance < best.distance) best = { building, distance };
  }
  return best;
}
