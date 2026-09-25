import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Palette Studio',
  description:
    'React-инструмент для вычисления цветовых гармоний из изображения.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
