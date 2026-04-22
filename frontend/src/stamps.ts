// SVG path data for built-in architectural plan stamps.
// Each stamp is designed in a 100x100 viewBox for consistent scaling.
// Focus: control de accesos electrónicos + aberturas + seguridad + referencia.

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
  // =============== ABERTURAS ===============
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
        { d: "M10 50 L10 15", stroke: S, strokeWidth: 3 },
        { d: "M10 15 A35 35 0 0 1 45 50", stroke: S, fill: "none", strokeWidth: 1.2 },
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
        { d: "M0 40 L20 40 L20 60 L0 60 Z", stroke: S, fill: F, strokeWidth: 2 },
        { d: "M80 40 L100 40 L100 60 L80 60 Z", stroke: S, fill: F, strokeWidth: 2 },
        { d: "M20 48 L80 48", stroke: S, strokeWidth: 1 },
        { d: "M20 52 L80 52", stroke: S, strokeWidth: 1 },
        { d: "M22 44 L60 44 L60 56 L22 56 Z", stroke: S, fill: F, strokeWidth: 2 },
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
        { d: "M0 42 L100 42", stroke: S, strokeWidth: 3 },
        { d: "M0 58 L100 58", stroke: S, strokeWidth: 3 },
        { d: "M8 42 L8 58 M92 42 L92 58", stroke: S, strokeWidth: 2 },
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
        { d: "M15 25 L85 25 M15 35 L85 35 M15 45 L85 45 M15 55 L85 55 M15 65 L85 65 M15 75 L85 75", stroke: S, strokeWidth: 1.2 },
        { d: "M50 82 L50 20 M42 28 L50 20 L58 28", stroke: S, fill: "none", strokeWidth: 2 },
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

  // =============== CONTROL DE ACCESOS ===============
  card_reader: {
    key: "card_reader",
    name: "Lector tarjeta",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Body
        { d: "M20 10 L80 10 L80 90 L20 90 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Card slot at top
        { d: "M30 22 L70 22 L70 30 L30 30 Z", stroke: S, fill: S, strokeWidth: 1.5 },
        // RFID waves
        { d: "M40 55 Q50 45 60 55", stroke: S, fill: "none", strokeWidth: 2 },
        { d: "M35 62 Q50 47 65 62", stroke: S, fill: "none", strokeWidth: 1.5 },
        { d: "M30 70 Q50 50 70 70", stroke: S, fill: "none", strokeWidth: 1 },
      ],
      circles: [
        // LED
        { cx: 50, cy: 80, r: 3, stroke: S, fill: S, strokeWidth: 1 },
      ],
    }),
  },
  keypad: {
    key: "keypad",
    name: "Teclado",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M15 10 L85 10 L85 90 L15 90 Z", stroke: S, fill: F, strokeWidth: 2 },
        // display
        { d: "M22 18 L78 18 L78 30 L22 30 Z", stroke: S, fill: "none", strokeWidth: 1.2 },
      ],
      circles: [
        // 3x4 keypad dots
        { cx: 32, cy: 42, r: 4, stroke: S, fill: F, strokeWidth: 1.5 },
        { cx: 50, cy: 42, r: 4, stroke: S, fill: F, strokeWidth: 1.5 },
        { cx: 68, cy: 42, r: 4, stroke: S, fill: F, strokeWidth: 1.5 },
        { cx: 32, cy: 56, r: 4, stroke: S, fill: F, strokeWidth: 1.5 },
        { cx: 50, cy: 56, r: 4, stroke: S, fill: F, strokeWidth: 1.5 },
        { cx: 68, cy: 56, r: 4, stroke: S, fill: F, strokeWidth: 1.5 },
        { cx: 32, cy: 70, r: 4, stroke: S, fill: F, strokeWidth: 1.5 },
        { cx: 50, cy: 70, r: 4, stroke: S, fill: F, strokeWidth: 1.5 },
        { cx: 68, cy: 70, r: 4, stroke: S, fill: F, strokeWidth: 1.5 },
        { cx: 32, cy: 84, r: 4, stroke: S, fill: F, strokeWidth: 1.5 },
        { cx: 50, cy: 84, r: 4, stroke: S, fill: F, strokeWidth: 1.5 },
        { cx: 68, cy: 84, r: 4, stroke: S, fill: F, strokeWidth: 1.5 },
      ],
    }),
  },
  fingerprint: {
    key: "fingerprint",
    name: "Lector huella",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Outer oval body
        { d: "M50 10 Q20 10 20 50 Q20 90 50 90 Q80 90 80 50 Q80 10 50 10 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Fingerprint ridges
        { d: "M35 45 Q50 35 65 45", stroke: S, fill: "none", strokeWidth: 1.5 },
        { d: "M32 55 Q50 40 68 55", stroke: S, fill: "none", strokeWidth: 1.5 },
        { d: "M30 65 Q50 45 70 65", stroke: S, fill: "none", strokeWidth: 1.5 },
        { d: "M34 72 Q50 60 66 72", stroke: S, fill: "none", strokeWidth: 1.5 },
      ],
    }),
  },
  face_reader: {
    key: "face_reader",
    name: "Lector facial",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Device body
        { d: "M15 15 L85 15 L85 85 L15 85 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Face oval
        { d: "M50 28 Q35 28 35 50 Q35 70 50 72 Q65 70 65 50 Q65 28 50 28 Z", stroke: S, fill: "none", strokeWidth: 1.5 },
        // Smile
        { d: "M42 58 Q50 64 58 58", stroke: S, fill: "none", strokeWidth: 1.2 },
        // Camera circle at bottom
      ],
      circles: [
        { cx: 44, cy: 47, r: 2.2, fill: S }, // left eye
        { cx: 56, cy: 47, r: 2.2, fill: S }, // right eye
        { cx: 50, cy: 82, r: 3, stroke: S, fill: S, strokeWidth: 1 }, // camera dot
      ],
    }),
  },
  maglock: {
    key: "maglock",
    name: "Electroimán",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Long horizontal bar (maglock body)
        { d: "M5 40 L95 40 L95 60 L5 60 Z", stroke: S, fill: S, strokeWidth: 2 },
        // N / S markers
        { d: "M18 48 L18 52 M30 48 L30 52 M42 48 L42 52 M54 48 L54 52 M66 48 L66 52 M78 48 L78 52 M90 48 L90 52", stroke: F, strokeWidth: 2 },
        // Top indicator cable
        { d: "M50 40 L50 25 M45 25 L55 25", stroke: S, strokeWidth: 2 },
      ],
    }),
  },
  electric_strike: {
    key: "electric_strike",
    name: "Cerradura eléc.",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Strike plate
        { d: "M30 20 L70 20 L70 80 L30 80 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Strike cavity
        { d: "M40 35 L60 35 L60 65 L40 65 Z", stroke: S, fill: "none", strokeWidth: 1.5 },
        // Wire
        { d: "M50 80 L50 92 M45 88 L55 96", stroke: S, strokeWidth: 2 },
      ],
      circles: [
        { cx: 35, cy: 26, r: 1.8, fill: S },
        { cx: 65, cy: 26, r: 1.8, fill: S },
        { cx: 35, cy: 74, r: 1.8, fill: S },
        { cx: 65, cy: 74, r: 1.8, fill: S },
      ],
    }),
  },
  exit_button: {
    key: "exit_button",
    name: "Pulsador salida",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Arrow inside
        { d: "M30 50 L60 50 M52 42 L60 50 L52 58", stroke: S, fill: "none", strokeWidth: 3 },
      ],
      circles: [
        { cx: 50, cy: 50, r: 40, stroke: S, fill: F, strokeWidth: 3 },
        { cx: 50, cy: 50, r: 30, stroke: S, fill: "none", strokeWidth: 1.5 },
      ],
    }),
  },
  emergency_button: {
    key: "emergency_button",
    name: "Botón emergencia",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Cross/hand pictogram
        { d: "M50 32 L50 68 M32 50 L68 50", stroke: F, strokeWidth: 5 },
      ],
      circles: [
        { cx: 50, cy: 50, r: 42, stroke: S, fill: S, strokeWidth: 3 },
        { cx: 50, cy: 50, r: 30, stroke: F, fill: S, strokeWidth: 2 },
      ],
    }),
  },
  intercom: {
    key: "intercom",
    name: "Interfono",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Body
        { d: "M20 10 L80 10 L80 90 L20 90 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Speaker grill area
        { d: "M30 20 L70 20 L70 45 L30 45 Z", stroke: S, fill: "none", strokeWidth: 1.2 },
        // Call button bar
        { d: "M30 70 L70 70 L70 80 L30 80 Z", stroke: S, fill: S, strokeWidth: 1.5 },
      ],
      circles: [
        // Speaker dots
        { cx: 38, cy: 28, r: 1.5, fill: S }, { cx: 50, cy: 28, r: 1.5, fill: S }, { cx: 62, cy: 28, r: 1.5, fill: S },
        { cx: 38, cy: 35, r: 1.5, fill: S }, { cx: 50, cy: 35, r: 1.5, fill: S }, { cx: 62, cy: 35, r: 1.5, fill: S },
        // Call bell
        { cx: 50, cy: 55, r: 5, stroke: S, fill: F, strokeWidth: 1.5 },
      ],
    }),
  },
  video_intercom: {
    key: "video_intercom",
    name: "Videoportero",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Body
        { d: "M15 10 L85 10 L85 90 L15 90 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Screen
        { d: "M22 18 L78 18 L78 55 L22 55 Z", stroke: S, fill: "none", strokeWidth: 1.5 },
        // Call button
        { d: "M32 72 L68 72 L68 82 L32 82 Z", stroke: S, fill: S, strokeWidth: 1.5 },
      ],
      circles: [
        // Camera dot at top of screen
        { cx: 50, cy: 14, r: 2.5, stroke: S, fill: S, strokeWidth: 1 },
        // Speaker inside screen
        { cx: 50, cy: 36, r: 6, stroke: S, fill: F, strokeWidth: 1.5 },
        { cx: 50, cy: 36, r: 2, fill: S },
      ],
    }),
  },
  controller: {
    key: "controller",
    name: "Controladora",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Panel body
        { d: "M10 20 L90 20 L90 80 L10 80 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Terminal rows
        { d: "M18 32 L82 32", stroke: S, strokeWidth: 1 },
        { d: "M18 45 L82 45", stroke: S, strokeWidth: 1 },
        { d: "M18 58 L82 58", stroke: S, strokeWidth: 1 },
        { d: "M18 71 L82 71", stroke: S, strokeWidth: 1 },
        // Terminal screws (top row)
        { d: "M22 28 L22 36 M32 28 L32 36 M42 28 L42 36 M52 28 L52 36 M62 28 L62 36 M72 28 L72 36", stroke: S, strokeWidth: 1 },
      ],
      circles: [
        // Status LED
        { cx: 82, cy: 26, r: 2, fill: S },
      ],
    }),
  },
  door_contact: {
    key: "door_contact",
    name: "Contacto mag.",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Two contact plates aligned with gap
        { d: "M10 35 L42 35 L42 65 L10 65 Z", stroke: S, fill: F, strokeWidth: 2 },
        { d: "M58 35 L90 35 L90 65 L58 65 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Magnetic field waves between them
        { d: "M46 45 L54 45 M46 50 L54 50 M46 55 L54 55", stroke: S, strokeWidth: 1.5 },
        // Wires
        { d: "M10 65 L5 75 M90 65 L95 75", stroke: S, strokeWidth: 1.5 },
      ],
    }),
  },
  turnstile: {
    key: "turnstile",
    name: "Torniquete",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Arms (3) 120° apart, radiating from center
        { d: "M50 50 L50 8", stroke: S, strokeWidth: 5 },
        { d: "M50 50 L86 71", stroke: S, strokeWidth: 5 },
        { d: "M50 50 L14 71", stroke: S, strokeWidth: 5 },
        // Rotation arrow
        { d: "M78 35 A38 38 0 0 1 85 55", stroke: S, fill: "none", strokeWidth: 2 },
        { d: "M82 52 L85 55 L88 50", stroke: S, fill: "none", strokeWidth: 2 },
      ],
      circles: [
        { cx: 50, cy: 50, r: 10, stroke: S, fill: S, strokeWidth: 2 },
        { cx: 50, cy: 50, r: 45, stroke: S, fill: "none", strokeWidth: 1 },
      ],
    }),
  },
  bollard: {
    key: "bollard",
    name: "Bolardo retráctil",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Ground line
        { d: "M5 75 L95 75", stroke: S, strokeWidth: 1 },
        // Bollard body (cylinder top-down view with perspective)
        { d: "M35 75 L35 30 Q35 22 50 22 Q65 22 65 30 L65 75 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Top cap stripe
        { d: "M38 35 L62 35", stroke: S, strokeWidth: 2 },
        // Up/down arrow indicating retractable
        { d: "M50 50 L50 62 M46 54 L50 50 L54 54 M46 58 L50 62 L54 58", stroke: S, strokeWidth: 1.5, fill: "none" },
      ],
      circles: [
        { cx: 50, cy: 26, r: 2, fill: S },
      ],
    }),
  },
  barrier: {
    key: "barrier",
    name: "Barrera vehículo",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M10 30 L20 30 L20 70 L10 70 Z", stroke: S, fill: S, strokeWidth: 2 },
        { d: "M20 48 L95 48 L95 52 L20 52 Z", stroke: S, fill: F, strokeWidth: 2 },
        { d: "M30 48 L30 52 M45 48 L45 52 M60 48 L60 52 M75 48 L75 52 M90 48 L90 52", stroke: S, strokeWidth: 2 },
      ],
    }),
  },
  gate_motor: {
    key: "gate_motor",
    name: "Motor puerta",
    category: "Control de accesos",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Gear teeth (8 rectangles around a circle)
        { d: "M47 5 L53 5 L53 15 L47 15 Z", stroke: S, fill: S, strokeWidth: 1 },
        { d: "M47 85 L53 85 L53 95 L47 95 Z", stroke: S, fill: S, strokeWidth: 1 },
        { d: "M5 47 L5 53 L15 53 L15 47 Z", stroke: S, fill: S, strokeWidth: 1 },
        { d: "M85 47 L85 53 L95 53 L95 47 Z", stroke: S, fill: S, strokeWidth: 1 },
        { d: "M18 18 L22 14 L30 22 L26 26 Z", stroke: S, fill: S, strokeWidth: 1 },
        { d: "M82 18 L78 14 L70 22 L74 26 Z", stroke: S, fill: S, strokeWidth: 1 },
        { d: "M18 82 L22 86 L30 78 L26 74 Z", stroke: S, fill: S, strokeWidth: 1 },
        { d: "M82 82 L78 86 L70 78 L74 74 Z", stroke: S, fill: S, strokeWidth: 1 },
      ],
      circles: [
        { cx: 50, cy: 50, r: 32, stroke: S, fill: F, strokeWidth: 2 },
        { cx: 50, cy: 50, r: 6, fill: S },
      ],
    }),
  },

  // =============== SEGURIDAD ===============
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
        { d: "M40 35 Q30 35 30 45 Q30 55 50 55 Q70 55 70 65 Q70 75 60 75", stroke: S, fill: "none", strokeWidth: 3 },
      ],
      circles: [
        { cx: 50, cy: 50, r: 38, stroke: S, fill: F, strokeWidth: 2 },
        { cx: 50, cy: 50, r: 28, stroke: S, fill: "none", strokeWidth: 1 },
      ],
    }),
  },
  siren: {
    key: "siren",
    name: "Sirena",
    category: "Seguridad",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        // Body
        { d: "M20 35 L60 20 L60 80 L20 65 Z", stroke: S, fill: F, strokeWidth: 2 },
        // Horn cone
        { d: "M60 30 L80 25 L80 75 L60 70 Z", stroke: S, fill: S, strokeWidth: 2 },
        // Sound waves
        { d: "M84 40 Q92 50 84 60", stroke: S, fill: "none", strokeWidth: 2 },
        { d: "M88 32 Q100 50 88 68", stroke: S, fill: "none", strokeWidth: 1.5 },
      ],
    }),
  },

  // =============== ELECTRICIDAD ===============
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

  // =============== REFERENCIA ===============
  north_arrow: {
    key: "north_arrow",
    name: "Norte",
    category: "Referencia",
    render: () => ({
      viewBox: "0 0 100 100",
      paths: [
        { d: "M50 15 L30 85 L50 70 L70 85 Z", stroke: S, fill: F, strokeWidth: 2 },
        { d: "M50 15 L50 70", stroke: S, strokeWidth: 1 },
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
        { d: "M5 50 L95 50", stroke: S, strokeWidth: 2 },
        { d: "M5 50 L15 45 L15 55 Z", stroke: S, fill: S, strokeWidth: 1 },
        { d: "M95 50 L85 45 L85 55 Z", stroke: S, fill: S, strokeWidth: 1 },
        { d: "M5 35 L5 65 M95 35 L95 65", stroke: S, strokeWidth: 1.5 },
      ],
    }),
  },
};

export const BUILTIN_ORDER = [
  // Aberturas
  "door", "door_double", "door_sliding", "window", "stairs", "door_handle",
  // Control de accesos
  "card_reader", "keypad", "fingerprint", "face_reader",
  "maglock", "electric_strike", "exit_button", "emergency_button",
  "intercom", "video_intercom", "controller", "door_contact",
  "turnstile", "bollard", "barrier", "gate_motor",
  // Seguridad
  "camera", "motion_sensor", "smoke_detector", "siren",
  // Electricidad
  "outlet", "switch", "light", "light_wall",
  // Referencia
  "north_arrow", "column", "column_round", "dimension",
];

export const CATEGORY_ORDER = [
  "Aberturas",
  "Control de accesos",
  "Seguridad",
  "Electricidad",
  "Referencia",
];
