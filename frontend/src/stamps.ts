// SVG path data for built-in architectural plan stamps
// Each stamp is designed in a 100x100 viewBox for consistent scaling.

export type BuiltinStamp = {
  key: string;
  name: string;
  // multiple SVG children so we can combine arcs+rects for doors etc
  render: (size: number) => { paths: { d: string; stroke?: string; fill?: string; strokeWidth?: number }[], circles?: { cx: number; cy: number; r: number; stroke?: string; fill?: string; strokeWidth?: number }[], viewBox: string };
};

const STROKE = "#0F172A";
const FILL = "#fff";

export const BUILTIN_STAMPS: Record<string, BuiltinStamp> = {
  door: {
    key: "door",
    name: "Puerta",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Wall segment
        { d: "M0 50 L20 50", stroke: STROKE, strokeWidth: 4 },
        { d: "M80 50 L100 50", stroke: STROKE, strokeWidth: 4 },
        // Door leaf
        { d: "M20 50 L20 10", stroke: STROKE, strokeWidth: 3 },
        // Arc of swing
        { d: "M20 10 A40 40 0 0 1 60 50", stroke: STROKE, fill: "none", strokeWidth: 1.5 },
      ],
    }),
  },
  door_handle: {
    key: "door_handle",
    name: "Manilla",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Rosette back
        { d: "M50 50 L90 50", stroke: STROKE, strokeWidth: 4 },
      ],
      circles: [
        { cx: 50, cy: 50, r: 14, stroke: STROKE, fill: FILL, strokeWidth: 3 },
        { cx: 50, cy: 50, r: 4, fill: STROKE },
      ],
    }),
  },
  camera: {
    key: "camera",
    name: "Cámara",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Body
        { d: "M35 35 L65 35 L65 55 L45 55 L35 65 Z", stroke: STROKE, fill: FILL, strokeWidth: 3 },
        // Field of view cone
        { d: "M50 35 L10 0 M50 35 L90 0", stroke: STROKE, strokeWidth: 1.5 },
        { d: "M10 0 A50 50 0 0 1 90 0", stroke: STROKE, fill: "none", strokeWidth: 1.5 },
      ],
      circles: [
        { cx: 42, cy: 45, r: 3, fill: STROKE },
      ],
    }),
  },
  barrier: {
    key: "barrier",
    name: "Barrera",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Post
        { d: "M10 30 L20 30 L20 70 L10 70 Z", stroke: STROKE, fill: STROKE, strokeWidth: 2 },
        // Boom arm
        { d: "M20 48 L95 48 L95 52 L20 52 Z", stroke: STROKE, fill: "#fff", strokeWidth: 2 },
        // Stripes
        { d: "M30 48 L30 52 M45 48 L45 52 M60 48 L60 52 M75 48 L75 52 M90 48 L90 52", stroke: STROKE, strokeWidth: 2 },
      ],
    }),
  },
};

export const BUILTIN_ORDER = ["door", "door_handle", "camera", "barrier"];
