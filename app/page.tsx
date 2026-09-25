'use client';

import type { ChangeEvent, ReactNode } from 'react';
import { useEffect, useMemo, useReducer, useRef } from 'react';
import {
  Grid3X3,
  ImageIcon,
  Layers,
  Palette,
  PaintBucket,
  Sparkles,
  Type,
  Upload,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  calculatePaletteStyles,
  type ColorPair,
  type ColorToken,
  type PaletteStyle,
} from '@/lib/color-engine';

type AppStatus = 'idle' | 'imageReady' | 'generating' | 'success' | 'error';

type AppState = {
  status: AppStatus;
  fileName: string;
  previewUrl: string;
  styles: PaletteStyle[];
  activeStyleId: string;
  error: string;
};

type AppAction =
  | { type: 'selected'; fileName: string; previewUrl: string }
  | { type: 'generating' }
  | { type: 'generated'; styles: PaletteStyle[] }
  | { type: 'activeStyleChanged'; activeStyleId: string }
  | { type: 'failed'; error: string }
  | { type: 'reset' };

const initialState: AppState = {
  status: 'idle',
  fileName: '',
  previewUrl: '',
  styles: [],
  activeStyleId: '',
  error: '',
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'selected':
      return {
        ...initialState,
        status: 'imageReady',
        fileName: action.fileName,
        previewUrl: action.previewUrl,
      };
    case 'generating':
      return { ...state, status: 'generating', error: '' };
    case 'generated':
      return {
        ...state,
        status: 'success',
        styles: action.styles,
        activeStyleId: action.styles[0]?.id ?? '',
      };
    case 'activeStyleChanged':
      return { ...state, activeStyleId: action.activeStyleId };
    case 'failed':
      return { ...state, status: 'error', error: action.error };
    case 'reset':
      return initialState;
    default:
      return state;
  }
}

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const fileRef = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeStyle = useMemo(
    () => state.styles.find((style) => style.id === state.activeStyleId),
    [state.activeStyleId, state.styles],
  );
  const canGenerate = Boolean(state.fileName) && state.status !== 'generating';

  useEffect(() => {
    return () => {
      if (state.previewUrl) {
        URL.revokeObjectURL(state.previewUrl);
      }
    };
  }, [state.previewUrl]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function generatePalette() {
    if (!fileRef.current) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: 'generating' });

    try {
      const result = await calculatePaletteStyles(
        fileRef.current,
        controller.signal,
      );
      dispatch({ type: 'generated', styles: result.styles });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      dispatch({
        type: 'failed',
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось вычислить палитру для этого изображения.',
      });
    }
  }

  function selectFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      dispatch({ type: 'failed', error: 'Загрузите файл изображения.' });
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      dispatch({ type: 'failed', error: 'Файл должен быть меньше 16 MB.' });
      return;
    }

    abortRef.current?.abort();
    fileRef.current = file;
    dispatch({
      type: 'selected',
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
    });
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
    event.target.value = '';
  }

  function resetImage() {
    abortRef.current?.abort();
    fileRef.current = null;
    dispatch({ type: 'reset' });
  }

  return (
    <main className="min-h-screen bg-[#fdfdfc] text-zinc-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-900 shadow-sm">
              <Palette className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">Palette Studio</p>
              <p className="text-xs text-zinc-500">React color harmonies</p>
            </div>
          </div>
          {state.status !== 'idle' ? (
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
              onClick={resetImage}
              aria-label="Сбросить изображение"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </header>

        <section className="flex flex-1 flex-col items-center justify-center gap-5 py-12">
          <div className="w-full max-w-3xl">
            <label className="group relative flex min-h-[300px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-white text-center shadow-sm transition hover:border-zinc-900 focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-zinc-900/10">
              <input
                ref={inputRef}
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={onFileChange}
              />
              {state.previewUrl ? (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 size-full object-cover"
                    style={{
                      backgroundImage: `url(${state.previewUrl})`,
                      backgroundPosition: 'center',
                      backgroundSize: 'cover',
                    }}
                  />
                  <span className="absolute inset-0 bg-white/70" />
                  <span className="relative flex max-w-[calc(100%-32px)] items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm">
                    <ImageIcon className="size-4" aria-hidden="true" />
                    <span className="truncate">{state.fileName}</span>
                  </span>
                </>
              ) : (
                <span className="flex flex-col items-center gap-4 px-6">
                  <span className="flex size-14 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700">
                    <Upload className="size-6" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-lg font-semibold">
                      Загрузите изображение
                    </span>
                    <span className="mt-1 block text-sm text-zinc-500">
                      PNG, JPG, WebP
                    </span>
                  </span>
                </span>
              )}
            </label>
          </div>

          <Button
            type="button"
            size="lg"
            disabled={!canGenerate}
            onClick={generatePalette}
            className="h-11 min-w-64 rounded-md bg-zinc-950 px-5 text-white hover:bg-zinc-800"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            {state.status === 'generating'
              ? 'Вычисление палитры'
              : 'Сгенерировать палитру'}
          </Button>

          {state.error ? (
            <p
              className="max-w-xl text-center text-sm text-red-600"
              role="alert"
            >
              {state.error}
            </p>
          ) : null}

          {state.status === 'generating' ? (
            <div className="h-1 w-full max-w-3xl overflow-hidden rounded-full bg-zinc-100">
              <span className="block h-full w-1/2 animate-pulse rounded-full bg-zinc-950" />
            </div>
          ) : null}
        </section>

        {activeStyle ? (
          <section className="pb-14" aria-live="polite">
            <div
              role="tablist"
              aria-label="Вычисленные стили оформления"
              className="mb-8 flex gap-2 overflow-x-auto border-b border-zinc-200 pb-3"
            >
              {state.styles.map((style) => (
                <button
                  key={style.id}
                  role="tab"
                  type="button"
                  aria-selected={style.id === activeStyle.id}
                  className="min-h-10 shrink-0 rounded-md border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 data-[active=true]:border-zinc-950 data-[active=true]:bg-zinc-950 data-[active=true]:text-white"
                  data-active={style.id === activeStyle.id}
                  onClick={() =>
                    dispatch({
                      type: 'activeStyleChanged',
                      activeStyleId: style.id,
                    })
                  }
                >
                  {style.name}
                </button>
              ))}
            </div>

            <StyleResult style={activeStyle} />
          </section>
        ) : null}
      </div>
    </main>
  );
}

function StyleResult({ style }: { style: PaletteStyle }) {
  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{style.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">{style.formula}</p>
        </div>
        <p className="text-sm text-zinc-500">
          {style.pairings.length} WCAG сочетаний текста и фона
        </p>
      </div>

      <ColorSection
        icon={<Palette className="size-4" aria-hidden="true" />}
        title="Вся палитра цветов"
        colors={style.palette}
      />

      <TextColors colors={style.textColors} />
      <BackgroundColors colors={style.backgroundColors} />
      <CombinationGrid pairings={style.pairings} />
      <ComponentShowcase style={style} />
    </div>
  );
}

function ColorSection({
  icon,
  title,
  colors,
}: {
  icon: ReactNode;
  title: string;
  colors: ColorToken[];
}) {
  return (
    <section>
      <SectionTitle icon={icon} title={title} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {colors.map((color) => (
          <article
            key={`${title}-${color.hex}`}
            className="grid min-h-28 grid-cols-[88px_1fr] overflow-hidden rounded-lg border border-zinc-200 bg-white"
          >
            <span style={{ backgroundColor: color.hex }} />
            <div className="flex min-w-0 flex-col justify-center gap-1 p-3">
              <p className="truncate text-sm font-semibold">
                {color.hex.toUpperCase()}
              </p>
              <p className="text-xs text-zinc-500">
                HSL {color.hsl.h} {color.hsl.s}% {color.hsl.l}%
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TextColors({ colors }: { colors: ColorToken[] }) {
  return (
    <section>
      <SectionTitle
        icon={<Type className="size-4" aria-hidden="true" />}
        title="Цвета текстов"
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {colors.map((color) => (
          <article
            key={`text-${color.hex}`}
            className="min-h-28 rounded-lg border border-zinc-200 bg-white p-4"
          >
            <p className="text-xs font-medium text-zinc-500">
              {color.hex.toUpperCase()}
            </p>
            <p
              className="mt-3 text-2xl font-semibold"
              style={{ color: color.hex }}
            >
              Heading
            </p>
            <p className="mt-1 text-sm" style={{ color: color.hex }}>
              Body text, label, navigation
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function BackgroundColors({ colors }: { colors: ColorToken[] }) {
  return (
    <section>
      <SectionTitle
        icon={<PaintBucket className="size-4" aria-hidden="true" />}
        title="Фоновые цвета"
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {colors.map((color) => (
          <article
            key={`background-${color.hex}`}
            className="min-h-32 rounded-lg border border-zinc-200 p-4"
            style={{ backgroundColor: color.hex }}
          >
            <p className="text-sm font-semibold text-zinc-950">
              {color.hex.toUpperCase()}
            </p>
            <p className="mt-2 max-w-64 text-sm text-zinc-600">
              Surface, section, sidebar
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CombinationGrid({ pairings }: { pairings: ColorPair[] }) {
  return (
    <section>
      <SectionTitle
        icon={<Grid3X3 className="size-4" aria-hidden="true" />}
        title="Комбинации текста и фона"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {pairings.map((pair) => (
          <article
            key={pair.id}
            className="flex min-h-36 flex-col justify-between rounded-lg border border-zinc-200 p-4"
            style={{
              backgroundColor: pair.background.hex,
              color: pair.text.hex,
            }}
          >
            <div>
              <p className="text-lg font-semibold">Aa Palette</p>
              <p className="mt-2 text-sm">
                Contrast {pair.contrast}:1 / {pair.rating}
              </p>
            </div>
            <p className="mt-6 text-xs">
              {pair.text.hex.toUpperCase()} on{' '}
              {pair.background.hex.toUpperCase()}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ComponentShowcase({ style }: { style: PaletteStyle }) {
  const hero = style.pairings[0];
  const calm = style.pairings[Math.min(7, style.pairings.length - 1)];
  const accent = style.pairings[Math.min(14, style.pairings.length - 1)];
  const buttonText = style.backgroundColors[0];
  const buttonBackground = style.textColors[0];

  return (
    <section>
      <SectionTitle
        icon={<Layers className="size-4" aria-hidden="true" />}
        title="Кнопки, карточки, панели"
      />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article
          className="min-h-72 rounded-lg border border-zinc-200 p-6"
          style={{
            backgroundColor: hero.background.hex,
            color: hero.text.hex,
          }}
        >
          <div className="flex h-full flex-col justify-between gap-8">
            <div>
              <p className="text-sm font-medium">Layout preview</p>
              <h2 className="mt-4 max-w-xl text-4xl font-semibold">
                Visual system generated from image colors
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="min-h-10 rounded-md px-4 text-sm font-semibold"
                style={{
                  backgroundColor: buttonBackground.hex,
                  color: buttonText.hex,
                }}
              >
                Primary button
              </button>
              <button
                type="button"
                className="min-h-10 rounded-md border px-4 text-sm font-semibold"
                style={{
                  borderColor: hero.text.hex,
                  color: hero.text.hex,
                }}
              >
                Secondary
              </button>
            </div>
          </div>
        </article>

        <div className="grid gap-4">
          <article
            className="rounded-lg border border-zinc-200 p-5"
            style={{
              backgroundColor: calm.background.hex,
              color: calm.text.hex,
            }}
          >
            <p className="text-sm font-semibold">Metric card</p>
            <p className="mt-5 text-4xl font-semibold">94%</p>
            <p className="mt-2 text-sm">Readable contrast score</p>
          </article>
          <article
            className="rounded-lg border border-zinc-200 p-5"
            style={{
              backgroundColor: accent.background.hex,
              color: accent.text.hex,
            }}
          >
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm font-semibold">Panel</p>
              <span
                className="rounded-md px-2 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: accent.text.hex,
                  color: accent.background.hex,
                }}
              >
                AA
              </span>
            </div>
            <div className="space-y-2">
              {[72, 54, 86].map((width) => (
                <span
                  key={width}
                  className="block h-2 rounded-full"
                  style={{
                    width: `${width}%`,
                    backgroundColor: accent.text.hex,
                    opacity: 0.42,
                  }}
                />
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700">
        {icon}
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}
