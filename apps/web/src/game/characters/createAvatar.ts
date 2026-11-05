import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import { skinHex } from "@naijaverse/shared";

/**
 * A stylized, low-poly character built from primitives.
 *
 * Milestone 01 deliberately ships no external 3D assets: the avatar is
 * assembled from a handful of meshes so the game loads instantly on a slow
 * connection. Swapping this factory for a glTF rig later does not touch
 * animation, networking or the HUD, which only know about `AvatarRig`.
 */

export interface AvatarLook {
  skinTone: string;
  hairstyle: string;
  outfit: string;
}

export interface AvatarRig {
  root: TransformNode;
  /** The tag anchor: name tags are linked to this mesh. */
  head: Mesh;
  setLook(look: AvatarLook): void;
  animate(dtSeconds: number, moving: boolean, speedScale: number): void;
  dispose(): void;
}

const OUTFIT_COLORS: Record<string, string> = {
  ankara: "#c9437a",
  adire: "#2f5fa8",
  "aso-oke": "#a8791c",
  streetwear: "#2b2b31",
  corporate: "#37474f",
  casual: "#3f8f5a",
};

const HAIR_COLORS: Record<string, string> = {
  braids: "#1b1b1b",
  locs: "#241a12",
  afro: "#161616",
  gele: "#c2452f",
  fade: "#141414",
  bald: "#141414",
};

const DEFAULTS = { outfit: "#37474f", skin: "#c68642", hair: "#1b1b1b" };

interface Limb {
  pivot: TransformNode;
  mesh: Mesh;
}

export function createAvatar(scene: Scene, look: AvatarLook, id = "avatar"): AvatarRig {
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(value: T): T => {
    disposables.push(value);
    return value;
  };

  const root = new TransformNode(`${id}-root`, scene);
  const body = new TransformNode(`${id}-body`, scene);
  body.parent = root;

  const skinMaterial = track(new StandardMaterial(`${id}-skin`, scene));
  skinMaterial.diffuseColor = Color3.FromHexString(skinHex(look.skinTone));
  skinMaterial.specularColor = new Color3(0.08, 0.08, 0.08);

  const outfitMaterial = track(new StandardMaterial(`${id}-outfit`, scene));
  outfitMaterial.diffuseColor = Color3.FromHexString(OUTFIT_COLORS[look.outfit] ?? DEFAULTS.outfit);
  outfitMaterial.specularColor = new Color3(0.08, 0.08, 0.08);

  const mk = <T extends Mesh>(mesh: T, material: StandardMaterial): T => {
    mesh.material = material;
    mesh.isPickable = false;
    track(mesh);
    return mesh;
  };

  // ---- torso -------------------------------------------------------------
  const torso = mk(MeshBuilder.CreateCapsule(`${id}-torso`, { radius: 0.3, height: 0.8 }, scene), outfitMaterial);
  torso.position.set(0, 1.25, 0);
  torso.parent = body;

  // ---- head --------------------------------------------------------------
  const neck = mk(MeshBuilder.CreateCylinder(`${id}-neck`, { height: 0.16, diameter: 0.2 }, scene), skinMaterial);
  neck.position.set(0, 1.72, 0);
  neck.parent = body;

  const head = mk(MeshBuilder.CreateSphere(`${id}-head`, { diameter: 0.46, segments: 12 }, scene), skinMaterial);
  head.position.set(0, 1.99, 0);
  head.parent = body;

  // ---- hair (rebuilt whenever the hairstyle changes) ---------------------
  const hairRoot = new TransformNode(`${id}-hair`, scene);
  hairRoot.parent = body;

  let hairMaterial = track(new StandardMaterial(`${id}-hairmat`, scene));
  hairMaterial.diffuseColor = Color3.FromHexString(HAIR_COLORS[look.hairstyle] ?? DEFAULTS.hair);
  let hairMeshes: Mesh[] = [];

  const buildHair = (hairstyle: string) => {
    for (const mesh of hairMeshes) mesh.dispose();
    hairMeshes = [];
    hairMaterial.diffuseColor = Color3.FromHexString(HAIR_COLORS[hairstyle] ?? DEFAULTS.hair);

    const add = (mesh: Mesh, x: number, y: number, z: number) => {
      mesh.material = hairMaterial;
      mesh.isPickable = false;
      mesh.position.set(x, y, z);
      mesh.parent = hairRoot;
      hairMeshes.push(mesh);
    };

    switch (hairstyle) {
      case "afro":
        add(MeshBuilder.CreateSphere(`${id}-afro`, { diameter: 0.62, segments: 10 }, scene), 0, 2.2, -0.02);
        break;
      case "gele": {
        add(MeshBuilder.CreateSphere(`${id}-gele-base`, { diameter: 0.54, segments: 10 }, scene), 0, 2.16, 0);
        add(MeshBuilder.CreateCylinder(`${id}-gele-wrap`, { height: 0.44, diameterTop: 0.24, diameterBottom: 0.6 }, scene), 0, 2.42, 0);
        break;
      }
      case "braids":
        add(MeshBuilder.CreateCylinder(`${id}-braid-cap`, { height: 0.2, diameter: 0.52 }, scene), 0, 2.18, 0);
        add(MeshBuilder.CreateCylinder(`${id}-braid-l`, { height: 0.7, diameter: 0.11 }, scene), -0.16, 1.85, -0.22);
        add(MeshBuilder.CreateCylinder(`${id}-braid-r`, { height: 0.7, diameter: 0.11 }, scene), 0.16, 1.85, -0.22);
        break;
      case "locs":
        add(MeshBuilder.CreateCylinder(`${id}-locs-cap`, { height: 0.18, diameter: 0.52 }, scene), 0, 2.17, 0);
        for (let i = -1; i <= 1; i++) {
          add(
            MeshBuilder.CreateCylinder(`${id}-loc-${i}`, { height: 0.78, diameter: 0.1 }, scene),
            i * 0.13,
            1.86,
            -0.24,
          );
        }
        break;
      case "fade":
        add(MeshBuilder.CreateBox(`${id}-fade`, { width: 0.5, height: 0.18, depth: 0.5 }, scene), 0, 2.19, 0);
        break;
      case "bald":
      default:
        break;
    }
  };
  buildHair(look.hairstyle);

  // ---- limbs -------------------------------------------------------------
  const limb = (
    part: string,
    radius: number,
    height: number,
    pivot: Vector3,
    material: StandardMaterial,
  ): Limb => {
    const pivotNode = new TransformNode(`${id}-${part}-pivot`, scene);
    pivotNode.position.copyFrom(pivot);
    pivotNode.parent = body;
    const mesh = mk(MeshBuilder.CreateCapsule(`${id}-${part}`, { radius, height }, scene), material);
    // Hang the limb below its pivot so rotating the pivot swings the joint.
    mesh.position.y = -height / 2;
    mesh.parent = pivotNode;
    return { pivot: pivotNode, mesh };
  };

  const legLeft = limb("leg-l", 0.15, 0.9, new Vector3(-0.17, 0.9, 0), outfitMaterial);
  const legRight = limb("leg-r", 0.15, 0.9, new Vector3(0.17, 0.9, 0), outfitMaterial);
  const armLeft = limb("arm-l", 0.11, 0.72, new Vector3(-0.38, 1.55, 0), skinMaterial);
  const armRight = limb("arm-r", 0.11, 0.72, new Vector3(0.38, 1.55, 0), skinMaterial);

  let phase = 0;

  return {
    root,
    head,

    setLook(next: AvatarLook) {
      skinMaterial.diffuseColor = Color3.FromHexString(skinHex(next.skinTone));
      outfitMaterial.diffuseColor = Color3.FromHexString(OUTFIT_COLORS[next.outfit] ?? DEFAULTS.outfit);
      buildHair(next.hairstyle);
    },

    animate(dtSeconds: number, moving: boolean, speedScale: number) {
      if (!moving) {
        // Settle back to a neutral standing pose.
        const settle = Math.min(1, dtSeconds * 10);
        legLeft.pivot.rotation.x += (0 - legLeft.pivot.rotation.x) * settle;
        legRight.pivot.rotation.x += (0 - legRight.pivot.rotation.x) * settle;
        armLeft.pivot.rotation.x += (0 - armLeft.pivot.rotation.x) * settle;
        armRight.pivot.rotation.x += (0 - armRight.pivot.rotation.x) * settle;
        body.position.y += (0 - body.position.y) * settle;
        return;
      }

      phase += dtSeconds * 9 * speedScale;
      const swing = Math.sin(phase);
      legLeft.pivot.rotation.x = swing * 0.62;
      legRight.pivot.rotation.x = -swing * 0.62;
      armLeft.pivot.rotation.x = -swing * 0.46;
      armRight.pivot.rotation.x = swing * 0.46;
      body.position.y = Math.abs(Math.sin(phase)) * 0.06;
    },

    dispose() {
      for (const item of disposables) item.dispose();
      hairRoot.dispose();
      body.dispose();
      root.dispose();
    },
  };
}
