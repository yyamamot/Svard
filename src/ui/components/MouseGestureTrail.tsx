import type { GesturePoint } from "../../core/mouseGestures";

export function MouseGestureTrail({ points }: { points: GesturePoint[] }) {
  if (points.length <= 1) {
    return null;
  }

  return (
    <svg
      className="mouse-gesture-trail"
      data-review-id="mouse-gesture-trail"
      aria-hidden="true"
      viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
    >
      <polyline
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
      />
      <circle
        className="gesture-start"
        cx={points[0].x}
        cy={points[0].y}
        r="4"
      />
      <circle
        className="gesture-end"
        cx={points.at(-1)?.x}
        cy={points.at(-1)?.y}
        r="5"
      />
    </svg>
  );
}
