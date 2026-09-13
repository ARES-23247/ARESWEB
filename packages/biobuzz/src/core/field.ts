// CAD-derived ARES field coordinates; meters, +X up, +Y left.
export const FIELD = {
  "obstacles": [
    {
      "id": "biobuzz-frame--1",
      "name": "Hive frame foot",
      "x": 0,
      "y": -0.6,
      "width": 0.9895,
      "height": 0.0508,
      "isBlocking": true,
      "color": "#8A919A",
      "locked": true
    },
    {
      "id": "biobuzz-frame-1",
      "name": "Hive frame foot",
      "x": 0,
      "y": 0.6,
      "width": 0.9895,
      "height": 0.0508,
      "isBlocking": true,
      "color": "#8A919A",
      "locked": true
    },
    {
      "id": "biobuzz-flower-support-0",
      "name": "Flower 1 rear support",
      "x": 1.790216,
      "y": 0.5941695,
      "width": 0.0254,
      "height": 0.15,
      "isBlocking": true,
      "color": "#D9B14F",
      "locked": true
    },
    {
      "id": "biobuzz-flower-support-1",
      "name": "Flower 2 rear support",
      "x": -0.5941695,
      "y": 1.790216,
      "width": 0.15,
      "height": 0.0254,
      "isBlocking": true,
      "color": "#D9B14F",
      "locked": true
    },
    {
      "id": "biobuzz-flower-support-2",
      "name": "Flower 3 rear support",
      "x": -1.790216,
      "y": -0.5941695,
      "width": 0.0254,
      "height": 0.15,
      "isBlocking": true,
      "color": "#D9B14F",
      "locked": true
    },
    {
      "id": "biobuzz-flower-support-3",
      "name": "Flower 4 rear support",
      "x": 0.5941695,
      "y": -1.790216,
      "width": 0.15,
      "height": 0.0254,
      "isBlocking": true,
      "color": "#D9B14F",
      "locked": true
    }
  ],
  "fieldWaypoints": [
    {
      "id": "biobuzz-flower-0",
      "name": "Flower 1",
      "x": 1.728216,
      "y": 0.5941695
    },
    {
      "id": "biobuzz-flower-1",
      "name": "Flower 2",
      "x": -0.5941695,
      "y": 1.728216
    },
    {
      "id": "biobuzz-flower-2",
      "name": "Flower 3",
      "x": -1.728216,
      "y": -0.5941695
    },
    {
      "id": "biobuzz-flower-3",
      "name": "Flower 4",
      "x": 0.5941695,
      "y": -1.728216
    },
    {
      "id": "biobuzz-hive-red",
      "name": "Red hive pivot",
      "x": 0,
      "y": 0.32385
    },
    {
      "id": "biobuzz-hive-blue",
      "name": "Blue hive pivot",
      "x": 0,
      "y": -0.32385
    }
  ]
} as const;

export const ZONES = {
  red: { loading: { x: 0.9017, y: 1.689, halfX: 0.2921, halfY: 0.1397 }, garden: { x: -1.8034, y: 1.5367, halfX: 0.0254, halfY: 0.2921 } },
  blue: { loading: { x: -0.9017, y: -1.689, halfX: 0.2921, halfY: 0.1397 }, garden: { x: 1.8034, y: -1.5367, halfX: 0.0254, halfY: 0.2921 } },
} as const;
export function inZone(p: {x: number; y: number}, z: {x: number; y: number; halfX: number; halfY: number}, radius = 0) {
  return Math.hypot(Math.max(0, Math.abs(p.x-z.x)-z.halfX), Math.max(0, Math.abs(p.y-z.y)-z.halfY)) <= radius;
}
