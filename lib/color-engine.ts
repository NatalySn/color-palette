export type Rgb = {
  r: number;
  g: number;
  b: number;
};

export type Hsl = {
  h: number;
  s: number;
  l: number;
};

export type ColorToken = {
  hex: string;
  rgb: Rgb;
  hsl: Hsl;
  label: string;
  usage: number;
};

export type ColorPair = {
  id: string;
  text: ColorToken;
  background: ColorToken;
  contrast: number;
  rating: 'AAA' | 'AA' | 'UI';
};

export type PaletteStyle = {
  id: string;
  name: string;
  formula: string;
  palette: ColorToken[];
  textColors: ColorToken[];
  backgroundColors: ColorToken[];
  pairings: ColorPair[];
};

export type PaletteAnalysis = {
  imageColors: ColorToken[];
  styles: PaletteStyle[];
};

type WeightedRgb = Rgb & {
  count: number;
};

type StyleDefinition = {
  id: string;
  name: string;
  formula: string;
  shifts: number[];
  saturationBias: number;
  lightnessSet: number[];
};

const styleDefinitions: StyleDefinition[] = [
  {
    id: 'complementary',
    name: 'Комплементарная',
    formula: 'HSL: H + 180',
    shifts: [0, 180, 12, 192],
    saturationBias: 1,
    lightnessSet: [17, 24, 36, 58],
  },
  {
    id: 'analogous',
    name: 'Аналоговая',
    formula: 'HSL: H - 30, H, H + 30',
    shifts: [-30, 0, 30, 60],
    saturationBias: 0.82,
    lightnessSet: [18, 27, 44, 64],
  },
  {
    id: 'triadic',
    name: 'Триада',
    formula: 'HSL: H, H + 120, H + 240',
    shifts: [0, 120, 240, 24],
    saturationBias: 0.92,
    lightnessSet: [16, 25, 42, 62],
  },
  {
    id: 'tetradic',
    name: 'Тетрада',
    formula: 'HSL: H, H + 90, H + 180, H + 270',
    shifts: [0, 90, 180, 270],
    saturationBias: 0.76,
    lightnessSet: [15, 24, 40, 60],
  },
  {
    id: 'split',
    name: 'Split-complementary',
    formula: 'HSL: H, H + 150, H + 210',
    shifts: [0, 150, 210, 330],
    saturationBias: 0.86,
    lightnessSet: [18, 26, 45, 66],
  },
  {
    id: 'monochrome',
    name: 'Монохромная',
    formula: 'HSL: один hue, разные S/L',
    shifts: [0, 0, 0, 0],
    saturationBias: 0.55,
    lightnessSet: [12, 26, 48, 72],
  },
];

export async function calculatePaletteStyles(
  file: File,
  signal: AbortSignal,
): Promise<PaletteAnalysis> {
  assertNotAborted(signal);

  const bitmap = await createImageBitmap(file);
  assertNotAborted(signal);

  try {
    const colors = extractImageColors(bitmap);
    assertNotAborted(signal);

    const imageColors = medianCut(colors, 10)
      .sort((a, b) => b.count - a.count)
      .map((color, index) => toToken(color, `Image ${index + 1}`, color.count));

    const normalizedImageColors =
      imageColors.length > 0
        ? imageColors
        : [
            tokenFromHsl({ h: 215, s: 16, l: 18 }, 'Fallback 1', 1),
            tokenFromHsl({ h: 215, s: 14, l: 72 }, 'Fallback 2', 1),
          ];

    const anchor = chooseAnchor(normalizedImageColors);
    const styles = styleDefinitions.map((definition) =>
      buildPaletteStyle(definition, anchor, normalizedImageColors),
    );

    return {
      imageColors: normalizedImageColors,
      styles,
    };
  } finally {
    bitmap.close();
  }
}

function extractImageColors(bitmap: ImageBitmap): WeightedRgb[] {
  const maxSide = 420;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Canvas недоступен для анализа изображения.');
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(bitmap, 0, 0, width, height);

  const image = context.getImageData(0, 0, width, height);
  const histogram = new Map<string, WeightedRgb>();
  const totalPixels = width * height;
  const step = Math.max(1, Math.floor(Math.sqrt(totalPixels / 16000)));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      const alpha = image.data[index + 3];

      if (alpha < 160) {
        continue;
      }

      const rgb = {
        r: image.data[index],
        g: image.data[index + 1],
        b: image.data[index + 2],
      };

      if (isNearlyWhiteTransparentEdge(rgb)) {
        continue;
      }

      const bucket = {
        r: quantize(rgb.r),
        g: quantize(rgb.g),
        b: quantize(rgb.b),
      };
      const key = `${bucket.r}:${bucket.g}:${bucket.b}`;
      const current = histogram.get(key);

      if (current) {
        current.count += 1;
      } else {
        histogram.set(key, { ...bucket, count: 1 });
      }
    }
  }

  return Array.from(histogram.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 4096);
}

function medianCut(colors: WeightedRgb[], target: number): WeightedRgb[] {
  if (colors.length <= target) {
    return colors;
  }

  const boxes: WeightedRgb[][] = [colors];

  while (boxes.length < target) {
    boxes.sort((left, right) => boxScore(right) - boxScore(left));
    const box = boxes.shift();

    if (!box || box.length < 2) {
      if (box) {
        boxes.push(box);
      }
      break;
    }

    const channel = widestChannel(box);
    const sorted = [...box].sort((a, b) => a[channel] - b[channel]);
    const total = sorted.reduce((sum, color) => sum + color.count, 0);
    let acc = 0;
    let splitIndex = 1;

    for (let index = 0; index < sorted.length - 1; index += 1) {
      acc += sorted[index].count;

      if (acc >= total / 2) {
        splitIndex = index + 1;
        break;
      }
    }

    boxes.push(sorted.slice(0, splitIndex), sorted.slice(splitIndex));
  }

  return boxes.filter(Boolean).map(averageBox);
}

function buildPaletteStyle(
  definition: StyleDefinition,
  anchor: ColorToken,
  imageColors: ColorToken[],
): PaletteStyle {
  const anchorSaturation = clamp(
    Math.max(anchor.hsl.s, 34) * definition.saturationBias,
    22,
    76,
  );
  const harmonyColors = definition.shifts.map((shift, index) =>
    tokenFromHsl(
      {
        h: normalizeHue(anchor.hsl.h + shift),
        s:
          definition.id === 'monochrome'
            ? clamp(anchorSaturation - index * 7, 14, 72)
            : anchorSaturation,
        l: definition.lightnessSet[index] ?? 48,
      },
      `${definition.name} ${index + 1}`,
      1,
    ),
  );

  const backgroundColors = uniqueColors(
    [
      ...harmonyColors.map((color, index) =>
        tokenFromHsl(
          {
            h: color.hsl.h,
            s: clamp(color.hsl.s * 0.38, 8, 30),
            l: [97, 94, 91, 87][index] ?? 92,
          },
          `Фон ${index + 1}`,
          color.usage,
        ),
      ),
      tokenFromHsl(
        { h: anchor.hsl.h, s: clamp(anchor.hsl.s * 0.12, 4, 14), l: 98 },
        'Фон neutral',
        1,
      ),
    ],
    6,
  );

  const textColors = uniqueColors(
    [
      ...harmonyColors.map((color, index) =>
        tokenFromHsl(
          {
            h: color.hsl.h,
            s: clamp(color.hsl.s * 0.9, 18, 70),
            l: [13, 18, 22, 28][index] ?? 18,
          },
          `Текст ${index + 1}`,
          color.usage,
        ),
      ),
      tokenFromHsl(
        { h: anchor.hsl.h, s: clamp(anchor.hsl.s * 0.18, 5, 18), l: 12 },
        'Текст neutral',
        1,
      ),
    ],
    6,
  );

  const palette = uniqueColors(
    [...imageColors.slice(0, 8), ...harmonyColors, ...backgroundColors],
    18,
  );
  const pairings = buildPairings(textColors, backgroundColors);

  return {
    id: definition.id,
    name: definition.name,
    formula: definition.formula,
    palette,
    textColors,
    backgroundColors,
    pairings,
  };
}

function buildPairings(
  textColors: ColorToken[],
  backgroundColors: ColorToken[],
): ColorPair[] {
  return textColors
    .flatMap((text) =>
      backgroundColors.map((background) => {
        const contrast = contrastRatio(text.rgb, background.rgb);

        return {
          id: `${text.hex}-${background.hex}`,
          text,
          background,
          contrast,
          rating: contrast >= 7 ? 'AAA' : contrast >= 4.5 ? 'AA' : 'UI',
        } satisfies ColorPair;
      }),
    )
    .sort((a, b) => b.contrast - a.contrast);
}

function chooseAnchor(colors: ColorToken[]): ColorToken {
  return [...colors].sort((a, b) => {
    const aScore =
      a.usage * 0.7 + a.hsl.s * 0.22 + Math.abs(50 - a.hsl.l) * -0.08;
    const bScore =
      b.usage * 0.7 + b.hsl.s * 0.22 + Math.abs(50 - b.hsl.l) * -0.08;

    return bScore - aScore;
  })[0];
}

function averageBox(box: WeightedRgb[]): WeightedRgb {
  const total = box.reduce((sum, color) => sum + color.count, 0);
  const mixed = box.reduce(
    (acc, color) => ({
      r: acc.r + color.r * color.count,
      g: acc.g + color.g * color.count,
      b: acc.b + color.b * color.count,
    }),
    { r: 0, g: 0, b: 0 },
  );

  return {
    r: Math.round(mixed.r / total),
    g: Math.round(mixed.g / total),
    b: Math.round(mixed.b / total),
    count: total,
  };
}

function boxScore(box: WeightedRgb[]): number {
  const ranges = channelRanges(box);
  const volume =
    Math.max(1, ranges.r) * Math.max(1, ranges.g) * Math.max(1, ranges.b);
  const weight = box.reduce((sum, color) => sum + color.count, 0);

  return volume * weight;
}

function widestChannel(box: WeightedRgb[]): keyof Rgb {
  const ranges = channelRanges(box);
  const entries = Object.entries(ranges) as [keyof Rgb, number][];

  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

function channelRanges(box: WeightedRgb[]): Rgb {
  const min = { r: 255, g: 255, b: 255 };
  const max = { r: 0, g: 0, b: 0 };

  for (const color of box) {
    min.r = Math.min(min.r, color.r);
    min.g = Math.min(min.g, color.g);
    min.b = Math.min(min.b, color.b);
    max.r = Math.max(max.r, color.r);
    max.g = Math.max(max.g, color.g);
    max.b = Math.max(max.b, color.b);
  }

  return {
    r: max.r - min.r,
    g: max.g - min.g,
    b: max.b - min.b,
  };
}

function uniqueColors(colors: ColorToken[], limit: number): ColorToken[] {
  const seen = new Set<string>();
  const result: ColorToken[] = [];

  for (const color of colors) {
    const key = color.hex.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(color);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

function toToken(color: WeightedRgb, label: string, usage: number): ColorToken {
  const rgb = { r: color.r, g: color.g, b: color.b };

  return {
    hex: rgbToHex(rgb),
    rgb,
    hsl: rgbToHsl(rgb),
    label,
    usage,
  };
}

function tokenFromHsl(hsl: Hsl, label: string, usage: number): ColorToken {
  const rgb = hslToRgb(hsl);

  return {
    hex: rgbToHex(rgb),
    rgb,
    hsl,
    label,
    usage,
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((value) => Math.round(value).toString(16).padStart(2, '0'))
    .join('')}`;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l: Math.round(lightness * 100) };
  }

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;

  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return {
    h: Math.round(hue * 60),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hue = normalizeHue(h) / 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;

  if (saturation === 0) {
    const value = Math.round(lightness * 255);

    return { r: value, g: value, b: value };
  }

  const q =
    lightness < 0.5
      ? lightness * (1 + saturation)
      : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;

  return {
    r: Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, hue) * 255),
    b: Math.round(hueToRgb(p, q, hue - 1 / 3) * 255),
  };
}

function hueToRgb(p: number, q: number, t: number): number {
  let value = t;

  if (value < 0) {
    value += 1;
  }

  if (value > 1) {
    value -= 1;
  }

  if (value < 1 / 6) {
    return p + (q - p) * 6 * value;
  }

  if (value < 1 / 2) {
    return q;
  }

  if (value < 2 / 3) {
    return p + (q - p) * (2 / 3 - value) * 6;
  }

  return p;
}

function contrastRatio(left: Rgb, right: Rgb): number {
  const light = relativeLuminance(left);
  const dark = relativeLuminance(right);
  const brightest = Math.max(light, dark);
  const darkest = Math.min(light, dark);

  return Number(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const [red, green, blue] = [r, g, b].map((channel) => {
    const value = channel / 255;

    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

function quantize(value: number): number {
  return clamp(Math.round(value / 12) * 12, 0, 255);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isNearlyWhiteTransparentEdge({ r, g, b }: Rgb): boolean {
  return r > 248 && g > 248 && b > 248;
}

function assertNotAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('Генерация остановлена.', 'AbortError');
  }
}
