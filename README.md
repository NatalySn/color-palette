# Palette Studio

Минималистичный React-сайт для генерации цветовых палитр из изображения. Пользователь загружает картинку, запускает анализ, а приложение показывает наборы цветовых гармоний, текстовые и фоновые цвета, WCAG-сочетания и примеры UI-компонентов.

## Возможности

- Загрузка изображения прямо в браузере.
- Локальный анализ без отправки файла на сервер.
- Извлечение основных цветов через canvas, histogram и median-cut quantization.
- Генерация палитр по известным HSL-гармониям:
  - complementary;
  - analogous;
  - triadic;
  - tetradic;
  - split-complementary;
  - monochrome.
- Проверка контраста текста и фона по WCAG.
- Табы с разными стилями оформления.
- Превью палитры, текстов, фонов, сетки сочетаний, кнопок, карточек и панелей.

## Стек

- React 19
- Vinext
- TypeScript
- Tailwind CSS
- shadcn/base-ui компоненты
- lucide-react иконки

## Требования

Нужен Node.js `22.13.0+`.

Проверить версию:

```bash
node --version
```

## Запуск через npm

```bash
npm install
npm run dev
```

После запуска открой URL из терминала. Обычно это:

```text
http://localhost:3000/
```

Если порт занят, Vinext выберет следующий свободный, например:

```text
http://localhost:3001/
```

## Запуск через pnpm

Если используешь `pnpm`, сначала установи зависимости:

```bash
pnpm install
```

Если появится ошибка про ignored builds:

```text
ERR_PNPM_IGNORED_BUILDS
```

разреши build-скрипты нужных нативных зависимостей:

```bash
pnpm approve-builds
```

В интерактивном списке отметь:

```text
esbuild
sharp
workerd
```

Затем запусти проект:

```bash
pnpm run dev
```

Лучше не смешивать `npm` и `pnpm` в одном рабочем цикле. Выбери один менеджер пакетов и дальше используй его. Да, скучно. Зато lockfile не превращается в место преступления.

## Production build

```bash
npm run build
npm run start
```

Или через `pnpm`:

```bash
pnpm run build
pnpm run start
```

## Основные файлы

- `app/page.tsx` — основной React-интерфейс.
- `lib/color-engine.ts` — вычисление цветов, гармоний и WCAG-контраста.
- `app/layout.tsx` — метаданные и корневой layout.
- `app/globals.css` — глобальная тема и Tailwind-настройки.

## Архитектура

Базы данных нет. Пользовательское изображение не сохраняется и не отправляется на backend.

Поток данных:

```text
File input
  -> Object URL preview
  -> ImageBitmap
  -> Canvas sampling
  -> RGB histogram
  -> Median-cut quantization
  -> HSL harmony generation
  -> WCAG contrast pairing
  -> React state
  -> Tabs and UI previews
```

Состояния интерфейса:

```text
idle -> imageReady -> generating -> success
                       -> error
```

## Безопасность и приватность

- Файл анализируется локально в браузере.
- Есть проверка MIME-типа изображения.
- Размер файла ограничен 16 MB.
- Object URL освобождается после замены изображения или размонтирования экрана.
- Повторная генерация отменяет предыдущую через `AbortController`.

## Проверки

Сборка:

```bash
npm run build
```

Проверка только файлов приложения:

```bash
npx oxlint app/page.tsx app/layout.tsx lib/color-engine.ts
```

Полный `npm run lint` может ругаться на сгенерированные shadcn-компоненты. Это не связано с логикой Palette Studio.
