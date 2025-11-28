export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

const clamp = (value: number, min = 0, max = 255): number => {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
};

export const rgbToCss = (color: RGBColor, alpha?: number): string => {
  const r = Math.round(clamp(color.r));
  const g = Math.round(clamp(color.g));
  const b = Math.round(clamp(color.b));
  if (typeof alpha === "number") {
    const normalizedAlpha = Math.max(0, Math.min(1, alpha));
    return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha.toFixed(3)})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
};

const mix = (color: RGBColor, target: RGBColor, amount: number): RGBColor => {
  const ratio = Math.max(0, Math.min(1, amount));
  return {
    r: clamp(color.r + (target.r - color.r) * ratio),
    g: clamp(color.g + (target.g - color.g) * ratio),
    b: clamp(color.b + (target.b - color.b) * ratio),
  };
};

export const lighten = (color: RGBColor, amount: number): RGBColor =>
  mix(color, { r: 255, g: 255, b: 255 }, amount);

export const darken = (color: RGBColor, amount: number): RGBColor =>
  mix(color, { r: 0, g: 0, b: 0 }, amount);

export const toRelativeLuminance = (color: RGBColor): number => {
  const normalize = (component: number): number => {
    const value = clamp(component) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  const r = normalize(color.r);
  const g = normalize(color.g);
  const b = normalize(color.b);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const getPerceptualBrightness = (color: RGBColor): number =>
  toRelativeLuminance(color);
