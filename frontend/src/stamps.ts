// SVG path data for built-in architectural plan stamps.
// Each stamp is designed in a 100x100 viewBox for consistent scaling.
// Inspired by architectural drafting symbols (AutoCAD / SmartDraw conventions).

export type StampPath = {
  d: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
};

export type StampCircle = {
  cx: number;
  cy: number;
  r: number;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
};

export type StampRender = {
  paths: StampPath[];
  circles?: StampCircle[];
  viewBox: string;
};

export type BuiltinStamp = {
  key: string;
  name: string;
  category: string;
  render: (size: number) => StampRender;
};

export const STAMP_STROKE = "#0F172A"; // default stroke color (dark navy)
export const STAMP_FILL = "#ffffff";   // default filling for closed shapes

const S = STAMP_STROKE;
const F = STAMP_FILL;

export const BUILTIN_STAMPS: Record<string, BuiltinStamp> = {
  // -------- ABERTURAS --------
  door: {
    key: "door",
    name: "Puerta",
    category: "Aberturas",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M0 50 L20 50", stroke: S, strokeWidth: 4 },
        { d: "M80 50 L100 50", stroke: S, strokeWidth: 4 },
        { d: "M20 50 L20 10", stroke: S, strokeWidth: 3 },
        { d: "M20 10 A40 40 0 0 1 60 50", stroke: S, fill: "none", strokeWidth: 1.5 },
      ],
    }),
  },
  door_double: {
    key: "door_double",
    name: "Puerta doble",
    category: "Aberturas",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M0 50 L10 50", stroke: S, strokeWidth: 4 },
        { d: "M90 50 L100 50", stroke: S, strokeWidth: 4 },
        // left leaf
        { d: "M10 50 L10 15", stroke: S, strokeWidth: 3 },
        { d: "M10 15 A35 35 0 0 1 45 50", stroke: S, fill: "none", strokeWidth: 1.2 },
        // right leaf
        { d: "M90 50 L90 15", stroke: S, strokeWidth: 3 },
        { d: "M90 15 A35 35 0 0 0 55 50", stroke: S, fill: "none", strokeWidth: 1.2 },
      ],
    }),
  },
  door_sliding: {
    key: "door_sliding",
    name: "Puerta corredera",
    category: "Aberturas",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Walls
        { d: "M0 40 L20 40 L20 60 L0 60 Z", stroke: S, fill: F, strokeWidth: 2 },
        { d: "M80 40 L100 40 L100 60 L80 60 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Track
        { d: "M20 48 L80 48", stroke: S, strokeWidth: 1 },
        { d: "M20 52 L80 52", stroke: S, strokeWidth: 1 },
        // Door leaf
        { d: "M22 44 L60 44 L60 56 L22 56 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Arrow indicating slide direction
        { d: "M65 50 L78 50 M75 46 L78 50 L75 54", stroke: S, fill: "none", strokeWidth: 2 },
      ],
    }),
  },
  window: {
    key: "window",
    name: "Ventana",
    category: "Aberturas",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Wall pieces
        { d: "M0 42 L100 42", stroke: S, strokeWidth: 3 },
        { d: "M0 58 L100 58", stroke: S, strokeWidth: 3 },
        // Outer vertical ends
        { d: "M8 42 L8 58 M92 42 L92 58", stroke: S, strokeWidth: 2 },
        // Glass line
        { d: "M10 50 L90 50", stroke: S, strokeWidth: 1.5 },
      ],
    }),
  },
  stairs: {
    key: "stairs",
    name: "Escalera",
    category: "Aberturas",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M15 15 L85 15 L85 85 L15 85 Z", stroke: S, fill: "none", strokeWidth: 2 },
        // Steps
        { d: "M15 25 L85 25 M15 35 L85 35 M15 45 L85 45 M15 55 L85 55 M15 65 L85 65 M15 75 L85 75", stroke: S, strokeWidth: 1.2 },
        // UP arrow
        { d: "M50 82 L50 20 M42 28 L50 20 L58 28", stroke: S, fill: "none", strokeWidth: 2 },
      ],
    }),
  },

  // -------- SANITARIOS --------
  toilet: {
    key: "toilet",
    name: "Inodoro",
    category: "Sanitarios",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Tank
        { d: "M25 10 L75 10 L75 30 L25 30 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Bowl
        { d: "M30 32 Q50 78 70 32 Z", stroke: S, fill: F, strokeWidth: 2 },
      ],
      circles: [{ cx: 50, cy: 20, r: 3, fill: S }],
    }),
  },
  sink: {
    key: "sink",
    name: "Lavabo",
    category: "Sanitarios",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Outer
        { d: "M15 20 L85 20 L85 80 L15 80 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Basin
        { d: "M25 32 L75 32 L75 70 L25 70 Z", stroke: S, fill: "none", strokeWidth: 1.5 },
      ],
      circles: [
        { cx: 50, cy: 26, r: 2, fill: S }, // faucet
        { cx: 50, cy: 55, r: 3, stroke: S, fill: "none", strokeWidth: 1.2 }, // drain
      ],
    }),
  },
  shower: {
    key: "shower",
    name: "Ducha",
    category: "Sanitarios",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M15 15 L85 15 L85 85 L15 85 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Diagonal cross
        { d: "M15 15 L85 85 M85 15 L15 85", stroke: S, strokeWidth: 1.2 },
      ],
      circles: [{ cx: 50, cy: 50, r: 5, stroke: S, fill: F, strokeWidth: 2 }],
    }),
  },
  bathtub: {
    key: "bathtub",
    name: "Bañera",
    category: "Sanitarios",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M10 25 L90 25 Q95 25 95 30 L95 70 Q95 75 90 75 L10 75 Q5 75 5 70 L5 30 Q5 25 10 25 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Inner basin
        { d: "M20 35 L80 35 Q85 35 85 40 L85 60 Q85 65 80 65 L20 65 Q15 65 15 60 L15 40 Q15 35 20 35 Z", stroke: S, fill: "none", strokeWidth: 1.2 },
      ],
      circles: [{ cx: 25, cy: 50, r: 2.5, stroke: S, fill: "none", strokeWidth: 1 }],
    }),
  },

  // -------- COCINA --------
  kitchen_sink: {
    key: "kitchen_sink",
    name: "Fregadero",
    category: "Cocina",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M5 20 L95 20 L95 80 L5 80 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Double basin
        { d: "M12 30 L48 30 L48 70 L12 70 Z", stroke: S, fill: "none", strokeWidth: 1.5 },
        { d: "M52 30 L88 30 L88 70 L52 70 Z", stroke: S, fill: "none", strokeWidth: 1.5 },
      ],
      circles: [
        { cx: 30, cy: 50, r: 2.5, stroke: S, fill: "none", strokeWidth: 1 },
        { cx: 70, cy: 50, r: 2.5, stroke: S, fill: "none", strokeWidth: 1 },
      ],
    }),
  },
  stove: {
    key: "stove",
    name: "Cocina",
    category: "Cocina",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M10 10 L90 10 L90 90 L10 90 Z", stroke: S, fill: F, strokeWidth: 2 },
      ],
      circles: [
        { cx: 32, cy: 32, r: 10, stroke: S, fill: "none", strokeWidth: 2 },
        { cx: 68, cy: 32, r: 10, stroke: S, fill: "none", strokeWidth: 2 },
        { cx: 32, cy: 68, r: 10, stroke: S, fill: "none", strokeWidth: 2 },
        { cx: 68, cy: 68, r: 10, stroke: S, fill: "none", strokeWidth: 2 },
      ],
    }),
  },
  fridge: {
    key: "fridge",
    name: "Nevera",
    category: "Cocina",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M20 5 L80 5 L80 95 L20 95 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Divider (freezer line)
        { d: "M20 35 L80 35", stroke: S, strokeWidth: 1.5 },
        // Handles
        { d: "M70 18 L70 27", stroke: S, strokeWidth: 3 },
        { d: "M70 55 L70 75", stroke: S, strokeWidth: 3 },
      ],
    }),
  },

  // -------- MOBILIARIO --------
  bed_single: {
    key: "bed_single",
    name: "Cama individual",
    category: "Mobiliario",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M15 10 L85 10 L85 90 L15 90 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Pillow
        { d: "M22 15 L78 15 L78 32 L22 32 Z", stroke: S, fill: "none", strokeWidth: 1.2 },
        // Blanket fold
        { d: "M15 42 L85 42", stroke: S, strokeWidth: 1.2 },
      ],
    }),
  },
  bed_double: {
    key: "bed_double",
    name: "Cama doble",
    category: "Mobiliario",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M5 10 L95 10 L95 90 L5 90 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Two pillows
        { d: "M10 15 L46 15 L46 32 L10 32 Z", stroke: S, fill: "none", strokeWidth: 1.2 },
        { d: "M54 15 L90 15 L90 32 L54 32 Z", stroke: S, fill: "none", strokeWidth: 1.2 },
        { d: "M5 42 L95 42", stroke: S, strokeWidth: 1.2 },
      ],
    }),
  },
  table: {
    key: "table",
    name: "Mesa",
    category: "Mobiliario",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M10 25 L90 25 L90 75 L10 75 Z", stroke: S, fill: F, strokeWidth: 2 },
        { d: "M10 25 L25 40 M90 25 L75 40 M10 75 L25 60 M90 75 L75 60", stroke: S, strokeWidth: 1 },
      ],
    }),
  },
  chair: {
    key: "chair",
    name: "Silla",
    category: "Mobiliario",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M25 30 L75 30 L75 85 L25 85 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Backrest
        { d: "M20 15 L80 15 L80 30 L20 30 Z", stroke: S, fill: S, strokeWidth: 2 },
      ],
    }),
  },
  sofa: {
    key: "sofa",
    name: "Sofá",
    category: "Mobiliario",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Base
        { d: "M5 40 L95 40 L95 85 L5 85 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Backrest
        { d: "M5 20 L95 20 L95 40 L5 40 Z", stroke: S, fill: "none", strokeWidth: 2 },
        // Armrests
        { d: "M5 20 L5 70 L18 70 L18 40", stroke: S, fill: "none", strokeWidth: 2 },
        { d: "M95 20 L95 70 L82 70 L82 40", stroke: S, fill: "none", strokeWidth: 2 },
        // Cushion divisions
        { d: "M40 45 L40 80 M60 45 L60 80", stroke: S, strokeWidth: 1 },
      ],
    }),
  },
  wardrobe: {
    key: "wardrobe",
    name: "Armario",
    category: "Mobiliario",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M10 10 L90 10 L90 90 L10 90 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Doors
        { d: "M50 10 L50 90", stroke: S, strokeWidth: 1.5 },
        // Opening arcs
        { d: "M10 10 A60 60 0 0 1 50 50", stroke: S, fill: "none", strokeWidth: 1 },
        { d: "M90 10 A60 60 0 0 0 50 50", stroke: S, fill: "none", strokeWidth: 1 },
      ],
      circles: [
        { cx: 46, cy: 50, r: 1.5, fill: S },
        { cx: 54, cy: 50, r: 1.5, fill: S },
      ],
    }),
  },

  // -------- ELECTRICIDAD / SEGURIDAD --------
  outlet: {
    key: "outlet",
    name: "Enchufe",
    category: "Electricidad",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M20 50 A30 30 0 0 1 80 50 L20 50 Z", stroke: S, fill: F, strokeWidth: 2 },
        { d: "M20 50 L80 50", stroke: S, strokeWidth: 2 },
      ],
      circles: [
        { cx: 38, cy: 42, r: 3, stroke: S, fill: S, strokeWidth: 1 },
        { cx: 62, cy: 42, r: 3, stroke: S, fill: S, strokeWidth: 1 },
      ],
    }),
  },
  switch: {
    key: "switch",
    name: "Interruptor",
    category: "Electricidad",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M50 85 L50 55", stroke: S, strokeWidth: 3 },
        { d: "M50 55 L72 30", stroke: S, strokeWidth: 3 },
      ],
      circles: [
        { cx: 50, cy: 85, r: 6, stroke: S, fill: S, strokeWidth: 1 },
        { cx: 50, cy: 50, r: 5, stroke: S, fill: F, strokeWidth: 2 },
      ],
    }),
  },
  light: {
    key: "light",
    name: "Luminaria",
    category: "Electricidad",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M22 22 L78 78 M78 22 L22 78", stroke: S, strokeWidth: 2 },
      ],
      circles: [{ cx: 50, cy: 50, r: 30, stroke: S, fill: F, strokeWidth: 2 }],
    }),
  },
  light_wall: {
    key: "light_wall",
    name: "Luz pared",
    category: "Electricidad",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M10 85 L90 85", stroke: S, strokeWidth: 3 },
        { d: "M30 85 L50 40 L70 85 Z", stroke: S, fill: F, strokeWidth: 2 },
        { d: "M36 60 L64 60", stroke: S, strokeWidth: 1 },
      ],
    }),
  },
  camera: {
    key: "camera",
    name: "Cámara",
    category: "Seguridad",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M35 35 L65 35 L65 55 L45 55 L35 65 Z", stroke: S, fill: F, strokeWidth: 3 },
        { d: "M50 35 L10 0 M50 35 L90 0", stroke: S, strokeWidth: 1.5 },
        { d: "M10 0 A50 50 0 0 1 90 0", stroke: S, fill: "none", strokeWidth: 1.5 },
      ],
      circles: [{ cx: 42, cy: 45, r: 3, fill: S }],
    }),
  },
  motion_sensor: {
    key: "motion_sensor",
    name: "Sensor mov.",
    category: "Seguridad",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M50 80 L20 30 L80 30 Z", stroke: S, fill: F, strokeWidth: 2 },
        // radiating waves
        { d: "M30 20 Q50 0 70 20", stroke: S, fill: "none", strokeWidth: 1.5 },
        { d: "M20 15 Q50 -10 80 15", stroke: S, fill: "none", strokeWidth: 1 },
      ],
      circles: [{ cx: 50, cy: 55, r: 5, fill: S }],
    }),
  },
  smoke_detector: {
    key: "smoke_detector",
    name: "Detector humo",
    category: "Seguridad",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // S letter inside
        { d: "M40 35 Q30 35 30 45 Q30 55 50 55 Q70 55 70 65 Q70 75 60 75", stroke: S, fill: "none", strokeWidth: 3 },
      ],
      circles: [
        { cx: 50, cy: 50, r: 38, stroke: S, fill: F, strokeWidth: 2 },
        { cx: 50, cy: 50, r: 28, stroke: S, fill: "none", strokeWidth: 1 },
      ],
    }),
  },
  door_handle: {
    key: "door_handle",
    name: "Manilla puerta",
    category: "Aberturas",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M50 50 L90 50", stroke: S, strokeWidth: 4 },
      ],
      circles: [
        { cx: 50, cy: 50, r: 14, stroke: S, fill: F, strokeWidth: 3 },
        { cx: 50, cy: 50, r: 4, fill: S },
      ],
    }),
  },
  barrier: {
    key: "barrier",
    name: "Barrera",
    category: "Seguridad",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M10 30 L20 30 L20 70 L10 70 Z", stroke: S, fill: S, strokeWidth: 2 },
        { d: "M20 48 L95 48 L95 52 L20 52 Z", stroke: S, fill: F, strokeWidth: 2 },
        { d: "M30 48 L30 52 M45 48 L45 52 M60 48 L60 52 M75 48 L75 52 M90 48 L90 52", stroke: S, strokeWidth: 2 },
      ],
    }),
  },

  // -------- REFERENCIA --------
  north_arrow: {
    key: "north_arrow",
    name: "Norte",
    category: "Referencia",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M50 15 L30 85 L50 70 L70 85 Z", stroke: S, fill: F, strokeWidth: 2 },
        { d: "M50 15 L50 70", stroke: S, strokeWidth: 1 },
        // N label
        { d: "M42 5 L42 12 M42 5 L48 12 M48 5 L48 12", stroke: S, fill: "none", strokeWidth: 2 },
      ],
      circles: [{ cx: 50, cy: 50, r: 42, stroke: S, fill: "none", strokeWidth: 1 }],
    }),
  },
  column: {
    key: "column",
    name: "Columna",
    category: "Referencia",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M25 25 L75 25 L75 75 L25 75 Z", stroke: S, fill: S, strokeWidth: 2 },
      ],
    }),
  },
  column_round: {
    key: "column_round",
    name: "Columna redonda",
    category: "Referencia",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [],
      circles: [{ cx: 50, cy: 50, r: 30, stroke: S, fill: S, strokeWidth: 2 }],
    }),
  },
  dimension: {
    key: "dimension",
    name: "Cota",
    category: "Referencia",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // horizontal line
        { d: "M5 50 L95 50", stroke: S, strokeWidth: 2 },
        // arrow tips
        { d: "M5 50 L15 45 L15 55 Z", stroke: S, fill: S, strokeWidth: 1 },
        { d: "M95 50 L85 45 L85 55 Z", stroke: S, fill: S, strokeWidth: 1 },
        // tick marks
        { d: "M5 35 L5 65 M95 35 L95 65", stroke: S, strokeWidth: 1.5 },
      ],
    }),
  },
};

export const BUILTIN_ORDER = [
  // Aberturas
  "door", "door_double", "door_sliding", "window", "stairs", "door_handle",
  // Sanitarios
  "toilet", "sink", "shower", "bathtub",
  // Cocina
  "kitchen_sink", "stove", "fridge",
  // Mobiliario
  "bed_single", "bed_double", "table", "chair", "sofa", "wardrobe",
  // Electricidad
  "outlet", "switch", "light", "light_wall",
  // Seguridad
  "camera", "motion_sensor", "smoke_detector", "barrier",
  // Referencia
  "north_arrow", "column", "column_round", "dimension",
];

export const CATEGORY_ORDER = [
  "Aberturas", "Sanitarios", "Cocina", "Mobiliario",
  "Electricidad", "Seguridad", "Referencia",
];
