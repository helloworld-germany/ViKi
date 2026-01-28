import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'ViKi Specialist Portal',
  description: 'Review and converse with incoming pediatric consults.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
