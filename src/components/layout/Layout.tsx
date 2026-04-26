import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export function Layout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground font-sans">
      <Navbar />
      <main className="flex flex-1 overflow-y-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
