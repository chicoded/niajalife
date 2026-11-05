import { useEffect, useRef } from "react";
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { createAvatar, type AvatarLook, type AvatarRig } from "../game/characters/createAvatar";

/**
 * A small live 3D preview of the character being created.
 *
 * It reuses the exact same avatar factory as the game world, so what a player
 * designs here is literally the mesh their friends will see in Yaba.
 */
export function AvatarPreview({ look }: { look: AvatarLook }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rigRef = useRef<AvatarRig | null>(null);
  const initialLook = useRef(look);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false }, true);
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.13, 0.17, 0.23, 1);

    const camera = new ArcRotateCamera(
      "previewCamera",
      -Math.PI / 2 + 0.6,
      1.3,
      4.4,
      new Vector3(0, 1.15, 0),
      scene,
    );
    camera.lowerRadiusLimit = 2.8;
    camera.upperRadiusLimit = 7.5;
    camera.lowerBetaLimit = 0.5;
    camera.upperBetaLimit = 1.75;
    camera.wheelPrecision = 50;
    camera.panningSensibility = 0;
    camera.attachControl(canvas, true);

    const hemi = new HemisphericLight("previewHemi", new Vector3(0.3, 1, 0.2), scene);
    hemi.intensity = 0.95;
    hemi.groundColor = Color3.FromHexString("#2a3444");

    const key = new DirectionalLight("previewKey", new Vector3(-0.5, -1, -0.4), scene);
    key.position = new Vector3(3, 6, 4);
    key.intensity = 0.6;

    const floor = MeshBuilder.CreateDisc("previewFloor", { radius: 2.4 }, scene);
    floor.rotation.x = Math.PI / 2;
    const floorMaterial = new StandardMaterial("previewFloorMat", scene);
    floorMaterial.diffuseColor = Color3.FromHexString("#1b2531");
    floorMaterial.specularColor = new Color3(0, 0, 0);
    floor.material = floorMaterial;

    const rig = createAvatar(scene, initialLook.current, "preview");
    rigRef.current = rig;

    engine.runRenderLoop(() => {
      rig.root.rotation.y += engine.getDeltaTime() * 0.00045;
      scene.render();
    });

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      rig.dispose();
      floorMaterial.dispose();
      scene.dispose();
      engine.dispose();
      rigRef.current = null;
    };
  }, []);

  useEffect(() => {
    rigRef.current?.setLook(look);
  }, [look.skinTone, look.hairstyle, look.outfit]);

  return <canvas ref={canvasRef} />;
}
