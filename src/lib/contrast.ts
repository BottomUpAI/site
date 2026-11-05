// WCAG 2 contrast, for keeping syntax-highlighting colours readable on the
// site's code background (src/lib/shiki.ts).

type Rgb = [number, number, number];

const parse = (hex: string): Rgb => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`not a #rrggbb colour: ${hex}`);
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
};

const format = (rgb: Rgb): string => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG contrast ratio of two #rrggbb colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(parse(a)), luminance(parse(b))].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * `fg` if it already reaches `min` against `bg`; otherwise `fg` mixed toward
 * black (on a light background) or white (on a dark one), by the smallest step
 * that does, so the colour keeps as much of its hue as it can.
 */
export function ensureContrast(fg: string, bg: string, min: number): string {
  if (contrast(fg, bg) >= min) return fg;
  const from = parse(fg);
  const target: Rgb = luminance(parse(bg)) > 0.18 ? [0, 0, 0] : [255, 255, 255];
  for (let step = 1; step <= 100; step++) {
    const t = step / 100;
    const mixed = format(from.map((c, i) => c + (target[i]! - c) * t) as Rgb);
    if (contrast(mixed, bg) >= min) return mixed;
  }
  return format(target);
}
