import { useRef, type PointerEvent as ReactPointerEvent } from "react";

interface TouchControlsProps {
  /** Reports a normalised thumbstick vector: x is strafe, y is forward. */
  onMove: (x: number, y: number, active: boolean) => void;
}

/** How far the knob may travel, as a fraction of the pad radius. */
const KNOB_LIMIT = 0.72;

/**
 * The mobile thumbstick. It only ever reports an intent vector — the same
 * `mx`/`mz` pair the keyboard produces and the server clamps.
 */
export function TouchControls({ onMove }: TouchControlsProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function update(clientX: number, clientY: number): void {
    const pad = padRef.current;
    const knob = knobRef.current;
    if (!pad || !knob) return;

    const rect = pad.getBoundingClientRect();
    const centreX = rect.left + rect.width / 2;
    const centreY = rect.top + rect.height / 2;
    const limit = (rect.width / 2) * KNOB_LIMIT;

    let dx = clientX - centreX;
    let dy = clientY - centreY;
    const distance = Math.hypot(dx, dy);
    if (distance > limit) {
      dx = (dx / distance) * limit;
      dy = (dy / distance) * limit;
    }

    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // Screen y grows downwards, so "up" on the stick is positive forward.
    onMove(clamp(dx / limit, -1, 1), clamp(-dy / limit, -1, 1), true);
  }

  function handleDown(event: ReactPointerEvent<HTMLDivElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = true;
    update(event.clientX, event.clientY);
  }

  function handleMove(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!dragging.current) return;
    update(event.clientX, event.clientY);
  }

  function release(): void {
    dragging.current = false;
    if (knobRef.current) knobRef.current.style.transform = "";
    onMove(0, 0, false);
  }

  return (
    <div
      className="touch-pad"
      ref={padRef}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div className="touch-knob" ref={knobRef} />
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
