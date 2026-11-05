import { Engine } from "@babylonjs/core";

/**
 * Graphics presets. Nigerian players are often on mid-range Android phones and
 * metered connections, so "low" is the default and it trades pixels, not
 * gameplay — the simulation is identical at every level.
 */
export type QualityLevel = "low" | "medium" | "high";

export const QUALITY_PRESETS: Record<
  QualityLevel,
  { label: string; hardwareScaling: number; antialias: boolean; shadows: boolean; fog: boolean }
> = {
  low: { label: "Low (fastest)", hardwareScaling: 1.75, antialias: false, shadows: false, fog: false },
  medium: { label: "Medium", hardwareScaling: 1.25, antialias: true, shadows: false, fog: true },
  high: { label: "High", hardwareScaling: 1, antialias: true, shadows: true, fog: true },
};

export function createEngine(canvas: HTMLCanvasElement, quality: QualityLevel): Engine {
  const preset = QUALITY_PRESETS[quality];
  const engine = new Engine(
    canvas,
    preset.antialias,
    { preserveDrawingBuffer: false, stencil: false, powerPreference: "high-performance" },
    // adaptToDeviceRatio: keep the device pixel ratio, but let hardware scaling
    // pull the render resolution down on weaker devices.
    true,
  );
  engine.setHardwareScalingLevel(preset.hardwareScaling);
  return engine;
}

export function applyQuality(engine: Engine, quality: QualityLevel): void {
  engine.setHardwareScalingLevel(QUALITY_PRESETS[quality].hardwareScaling);
}
