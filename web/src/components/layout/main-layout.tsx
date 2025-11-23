import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { UserButton } from '@/components/UserButton';

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      <Header userButton={<UserButton />} />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
}
