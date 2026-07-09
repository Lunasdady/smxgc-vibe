import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '私募星工厂 · 全量业绩跟踪',
  description: '私募基金分策略业绩跟踪数据展示',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
