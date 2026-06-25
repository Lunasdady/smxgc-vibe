import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '私募基金策略业绩数据展示',
  description: '私募基金分策略业绩跟踪数据展示',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={`${inter.className} bg-dark-bg text-dark-text antialiased`}>
        {children}
      </body>
    </html>
  );
}
