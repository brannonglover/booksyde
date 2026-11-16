/** Ink colours readers can pick for bookplates, avatars and club covers. */
export const inks = [
  { hex: "#2D4A3E", name: "Library green" },
  { hex: "#8B3A2B", name: "Oxblood" },
  { hex: "#2F4A66", name: "Ink blue" },
  { hex: "#5B3A5E", name: "Aubergine" },
  { hex: "#B8893A", name: "Gilt" },
  { hex: "#6F8B5E", name: "Sage" },
  { hex: "#B0565A", name: "Rosewood" },
  { hex: "#1F1B16", name: "Iron-gall" },
] as const;

export const DEFAULT_INK = inks[0].hex;
