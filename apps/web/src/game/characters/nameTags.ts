import { AbstractMesh, Scene } from "@babylonjs/core";
import { AdvancedDynamicTexture, Control, Rectangle, TextBlock } from "@babylonjs/gui";

/**
 * Player name tags.
 *
 * Implemented with Babylon's fullscreen GUI so the tags are drawn in the
 * engine's own UI pass: they always face the camera, never get buried behind
 * the canvas, and cost nothing when hidden.
 */

export interface NameTagHandle {
  control: Control;
  setText(text: string): void;
  dispose(): void;
}

export function createNameTagLayer(scene: Scene): AdvancedDynamicTexture {
  const layer = AdvancedDynamicTexture.CreateFullscreenUI("nameTags", true, scene);
  layer.idealWidth = 1280;
  layer.useSmallestIdeal = false;
  return layer;
}

export function createNameTag(
  layer: AdvancedDynamicTexture,
  anchor: AbstractMesh,
  text: string,
  isLocal: boolean,
): NameTagHandle {
  const box = new Rectangle(`tag-${anchor.name}`);
  box.height = "28px";
  // Without this the rectangle stretches to the whole fullscreen layer instead
  // of hugging the label. `adaptWidthToChildren` sizes it to the text block
  // (which itself is `resizeToFit`), so the tag is exactly as wide as its name.
  box.adaptWidthToChildren = true;
  box.cornerRadius = 9;
  box.thickness = 1.2;
  box.color = isLocal ? "#f7c948" : "#8fd0ff55";
  box.background = "rgba(11,14,19,0.66)";
  box.isPointerBlocker = false;
  box.isVisible = true;

  const label = new TextBlock(`tag-text-${anchor.name}`);
  label.text = text;
  label.color = isLocal ? "#ffe08a" : "#eaf4ff";
  label.fontSize = 14;
  label.fontFamily = "system-ui, sans-serif";
  label.resizeToFit = true;
  label.paddingLeft = "10px";
  label.paddingRight = "10px";
  box.addControl(label);

  layer.addControl(box);
  box.linkWithMesh(anchor);
  box.linkOffsetY = -26;

  return {
    control: box,
    setText(next: string) {
      label.text = next;
    },
    dispose() {
      layer.removeControl(box);
      box.dispose();
    },
  };
}
