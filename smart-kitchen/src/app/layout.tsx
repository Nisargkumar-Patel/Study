import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'Smart Kitchen — Inventory & Meal Planner',
  description: 'Offline-first meal planning and grocery delta engine for 7 housemates.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Smart Kitchen',
  },
};

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Registers /sw.js and wires offline auto-sync. */}
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
