/**
 * Chart chrome constants from the validated reference palette. Categorical
 * slots are assigned in fixed order and color follows the entity: IP is
 * always slot 1 (blue), Accelerator always slot 2 (orange), regardless of
 * filtering or rank.
 */

export const SERIES = [
  "#2a78d6", // 1 blue
  "#eb6834", // 2 orange
  "#1baf7a", // 3 aqua
  "#eda100", // 4 yellow
  "#e87ba4", // 5 magenta
  "#008300", // 6 green
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const;

export const ENTITY_COLORS: Record<string, string> = {
  IP: SERIES[0],
  Accelerator: SERIES[1],
};

export const INK = "#0b0b0b";
export const INK_2 = "#52514e";
export const MUTED = "#898781";
export const GRID = "#e1e0d9";
export const AXIS = "#c3c2b7";
export const SURFACE = "#fcfcfb";
export const ACCENT_SOFT = "#cde2fb";

export const FONT =
  'system-ui, -apple-system, "Segoe UI", sans-serif';

export const TOOLTIP_STYLE = {
  backgroundColor: SURFACE,
  borderColor: "rgba(11,11,11,0.10)",
  borderWidth: 1,
  padding: [8, 12] as [number, number],
  textStyle: { color: INK, fontFamily: FONT, fontSize: 12 },
  extraCssText: "box-shadow: 0 4px 12px rgba(11,11,11,0.10); border-radius: 8px;",
};

export const AXIS_LABEL = { color: MUTED, fontFamily: FONT, fontSize: 11 };

export const SPLIT_LINE = {
  show: true,
  lineStyle: { color: GRID, width: 1, type: "solid" as const },
};

export const AXIS_LINE = { lineStyle: { color: AXIS, width: 1 } };
