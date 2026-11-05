import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core";
import { WORLD, type Building, type DistrictLayout, type PropDef } from "@naijaverse/shared";

/**
 * Builds the static geometry for a district from its data definition.
 *
 * Nothing here is hand-placed: every mesh comes from `DISTRICTS`/`YABA_LAYOUT`
 * in `@naijaverse/shared`, so adding a building to the data adds it to the
 * world. See `docs/ARCHITECTURE.md`.
 */

export interface CityBuild {
  ground: Mesh;
  buildings: Building[];
  shadowCasters: Mesh[];
  meshes: Mesh[];
}

const PALETTE = {
  ground: "#5f6b57",
  road: "#3a3c42",
  kerb: "#8b8f96",
  marking: "#e8e4d8",
  roof: "#2c2f35",
  shopfront: "#20242b",
  treeTrunk: "#6b4a2f",
  treeLeaf: "#3f7a3a",
  pole: "#7d848c",
  danfo: "#f2c200",
  danfoTrim: "#1b1b1b",
  glass: "#9fd3e8",
};

export function buildCity(scene: Scene, layout: DistrictLayout): CityBuild {
  const meshes: Mesh[] = [];
  const materials = new Map<string, StandardMaterial>();

  const material = (hex: string, emissive = 0): StandardMaterial => {
    const key = `${hex}|${emissive}`;
    const cached = materials.get(key);
    if (cached) return cached;
    const created = new StandardMaterial(`mat-${key}`, scene);
    created.diffuseColor = Color3.FromHexString(hex);
    created.specularColor = new Color3(0.05, 0.05, 0.05);
    if (emissive > 0) created.emissiveColor = Color3.FromHexString(hex).scale(emissive);
    // The city is viewed from far away; skip the cost of full per-pixel lighting.
    created.freeze();
    materials.set(key, created);
    return created;
  };

  const track = <T extends Mesh>(mesh: T): T => {
    meshes.push(mesh);
    return mesh;
  };

  // ---- ground ------------------------------------------------------------
  const ground = track(
    MeshBuilder.CreateGround("ground", { width: WORLD.half * 2, height: WORLD.half * 2 }, scene),
  );
  ground.material = material(PALETTE.ground);
  ground.isPickable = false;

  // ---- roads -------------------------------------------------------------
  for (const road of layout.roads) {
    const span = Math.abs(road.to - road.from);
    const mid = (road.from + road.to) / 2;
    const width = road.along === "x" ? span : road.width;
    const depth = road.along === "x" ? road.width : span;
    const roadMesh = track(
      MeshBuilder.CreateBox(`road-${road.id}`, { width, height: 0.14, depth }, scene),
    );
    roadMesh.position.set(road.along === "x" ? mid : road.at, 0.07, road.along === "x" ? road.at : mid);
    roadMesh.material = material(PALETTE.road);
    roadMesh.isPickable = false;
    roadMesh.freezeWorldMatrix();

    // Kerb lines make the road edges readable at a distance.
    const kerbWidth = road.along === "x" ? width : 0.5;
    const kerbDepth = road.along === "x" ? 0.5 : depth;
    for (const side of [-1, 1]) {
      const kerb = track(
        MeshBuilder.CreateBox(`kerb-${road.id}-${side}`, { width: kerbWidth, height: 0.2, depth: kerbDepth }, scene),
      );
      const offset = (road.width / 2 + 0.25) * side;
      kerb.position.set(
        road.along === "x" ? mid : road.at + offset,
        0.1,
        road.along === "x" ? road.at + offset : mid,
      );
      kerb.material = material(PALETTE.kerb);
      kerb.isPickable = false;
    }

    // Dashed centre markings on the two main arteries only.
    if (road.width >= 16) {
      const dashLength = 3;
      const gap = 5;
      for (let d = road.from + dashLength; d < road.to - dashLength; d += dashLength + gap) {
        const dash = track(
          MeshBuilder.CreateBox(
            `dash-${road.id}-${d}`,
            {
              width: road.along === "x" ? dashLength : 0.3,
              height: 0.02,
              depth: road.along === "x" ? 0.3 : dashLength,
            },
            scene,
          ),
        );
        dash.position.set(road.along === "x" ? d : road.at, 0.15, road.along === "x" ? road.at : d);
        dash.material = material(PALETTE.marking);
        dash.isPickable = false;
      }
    }
  }

  // ---- buildings ---------------------------------------------------------
  const shadowCasters: Mesh[] = [];
  for (const building of layout.buildings) {
    const body = track(
      MeshBuilder.CreateBox(
        `bld-${building.id}`,
        { width: building.w, height: building.h, depth: building.d },
        scene,
      ),
    );
    body.position.set(building.x, building.h / 2, building.z);
    body.material = material(building.color);
    // Buildings are part of the world description the HUD already knows about,
    // so picking them for interaction is unnecessary.
    body.isPickable = false;
    shadowCasters.push(body);

    // A darker shopfront band grounds each building on the street.
    const front = track(
      MeshBuilder.CreateBox(
        `bld-front-${building.id}`,
        { width: building.w + 0.35, height: 2.6, depth: building.d + 0.35 },
        scene,
      ),
    );
    front.position.set(building.x, 1.3, building.z);
    front.material = material(PALETTE.shopfront);
    front.isPickable = false;

    // Roof edge.
    const roof = track(
      MeshBuilder.CreateBox(
        `bld-roof-${building.id}`,
        { width: building.w + 0.6, height: 0.6, depth: building.d + 0.6 },
        scene,
      ),
    );
    roof.position.set(building.x, building.h + 0.3, building.z);
    roof.material = material(PALETTE.roof);
    roof.isPickable = false;
  }

  // ---- props -------------------------------------------------------------
  for (const prop of layout.props) {
    buildProp(scene, prop, track, material, meshes);
  }

  return { ground, buildings: layout.buildings, shadowCasters, meshes };
}

function buildProp(
  scene: Scene,
  prop: PropDef,
  track: <T extends Mesh>(mesh: T) => T,
  material: (hex: string, emissive?: number) => StandardMaterial,
  meshes: Mesh[],
): void {
  const rotY = prop.rotY ?? 0;

  switch (prop.kind) {
    case "streetlight": {
      const pole = track(MeshBuilder.CreateCylinder(`sl-pole-${prop.id}`, { height: 6, diameter: 0.22 }, scene));
      pole.position.set(prop.x, 3, prop.z);
      pole.material = material(PALETTE.pole);

      const lamp = track(MeshBuilder.CreateSphere(`sl-lamp-${prop.id}`, { diameter: 0.7 }, scene));
      lamp.position.set(prop.x, 6.1, prop.z);
      lamp.material = material("#fff2c4", 0.55);
      break;
    }
    case "tree": {
      const trunk = track(MeshBuilder.CreateCylinder(`tr-trunk-${prop.id}`, { height: 2.2, diameter: 0.5 }, scene));
      trunk.position.set(prop.x, 1.1, prop.z);
      trunk.material = material(PALETTE.treeTrunk);

      const foliage = track(MeshBuilder.CreateSphere(`tr-leaf-${prop.id}`, { diameter: 3.2, segments: 6 }, scene));
      foliage.position.set(prop.x, 3.3, prop.z);
      foliage.material = material(PALETTE.treeLeaf);
      break;
    }
    case "danfo": {
      const bus = track(MeshBuilder.CreateBox(`danfo-${prop.id}`, { width: 4.8, height: 1.9, depth: 2.1 }, scene));
      bus.position.set(prop.x, 1.15, prop.z);
      bus.rotation.y = rotY;
      bus.material = material(PALETTE.danfo);

      const stripe = track(
        MeshBuilder.CreateBox(`danfo-stripe-${prop.id}`, { width: 4.9, height: 0.32, depth: 2.16 }, scene),
      );
      stripe.position.set(prop.x, 1.15, prop.z);
      stripe.rotation.y = rotY;
      stripe.material = material(PALETTE.danfoTrim);

      const windows = track(
        MeshBuilder.CreateBox(`danfo-glass-${prop.id}`, { width: 4.4, height: 0.6, depth: 2.16 }, scene),
      );
      windows.position.set(prop.x, 1.72, prop.z);
      windows.rotation.y = rotY;
      windows.material = material(PALETTE.glass, 0.1);
      break;
    }
    case "stall": {
      const table = track(MeshBuilder.CreateBox(`stall-${prop.id}`, { width: 2.4, height: 1.1, depth: 1.5 }, scene));
      table.position.set(prop.x, 0.55, prop.z);
      table.rotation.y = rotY;
      table.material = material("#8a6a4a");

      const awning = track(
        MeshBuilder.CreateBox(`stall-awning-${prop.id}`, { width: 2.8, height: 0.14, depth: 1.9 }, scene),
      );
      awning.position.set(prop.x, 1.85, prop.z);
      awning.rotation.y = rotY;
      awning.material = material("#c2452f");
      break;
    }
    case "sign": {
      const post = track(MeshBuilder.CreateCylinder(`sign-post-${prop.id}`, { height: 3.4, diameter: 0.16 }, scene));
      post.position.set(prop.x, 1.7, prop.z);
      post.material = material(PALETTE.pole);

      const panel = track(MeshBuilder.CreateBox(`sign-panel-${prop.id}`, { width: 3, height: 1, depth: 0.16 }, scene));
      panel.position.set(prop.x, 3.4, prop.z);
      panel.rotation.y = rotY;
      panel.material = material("#12324f");

      const label = prop.label ?? "Lagos";
      const texture = new DynamicTexture(`sign-tex-${prop.id}`, { width: 256, height: 96 }, scene, false);
      texture.drawText(label, null, 64, "bold 46px sans-serif", "#ffffff", PALETTE.shopfront, true);
      texture.hasAlpha = true;
      const face = track(
        MeshBuilder.CreatePlane(`sign-face-${prop.id}`, { width: 2.8, height: 0.85 }, scene),
      );
      face.position.set(prop.x, 3.4, prop.z);
      face.rotation.y = rotY + Math.PI;
      const faceMat = new StandardMaterial(`sign-face-mat-${prop.id}`, scene);
      faceMat.diffuseTexture = texture;
      faceMat.emissiveColor = new Color3(0.35, 0.35, 0.35);
      faceMat.backFaceCulling = false;
      face.material = faceMat;
      meshes.push(face);
      break;
    }
  }
}
