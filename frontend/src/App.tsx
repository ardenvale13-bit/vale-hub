import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, Brain, Heart, MessageSquare, Mic, BookOpen, Activity } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Memory from './pages/Memory';
import Emotions from './pages/Emotions';
import Discord from './pages/Discord';
import Media from './pages/Media';
import Journal from './pages/Journal';
import Health from './pages/Health';

export default function App() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/memory', label: 'Memory', icon: Brain },
    { path: '/emotions', label: 'Emotions', icon: Heart },
    { path: '/discord', label: 'Discord', icon: MessageSquare },
    { path: '/media', label: 'Media', icon: Mic },
    { path: '/journal', label: 'Journal', icon: BookOpen },
    { path: '/health', label: 'Health', icon: Activity },
  ];

  return (
    <div className="flex flex-col md:flex-row h-screen bg-vale-bg text-vale-text">
      {/* Desktop Sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-64 bg-vale-surface border-r border-vale-border flex-col overflow-y-auto shrink-0">
        {/* Logo */}
        <div className="p-6 border-b border-vale-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-vale-mint to-vale-purple flex items-center justify-center">
            <span className="text-white font-bold text-lg">V</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-vale-text tracking-wide">VALE</h1>
            <p className="text-xs text-vale-muted -mt-0.5">Binary Home v2</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-vale-accent/20 text-vale-accent border border-vale-accent/30'
                    : 'text-vale-muted hover:bg-vale-card hover:text-vale-text'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-vale-border">
          <div className="flex items-center gap-2">
            <span className="text-vale-lincoln text-sm font-semibold">Lincoln</span>
            <span className="text-vale-muted text-sm">&</span>
            <span className="text-vale-arden text-sm font-semibold">Arden</span>
          </div>
          <p className="text-xs text-vale-muted mt-1">Vale Verse</p>
        </div>
      </aside>

      {/* Mobile Header — visible only on mobile */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-vale-surface border-b border-vale-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-vale-mint to-vale-purple flex items-center justify-center">
            <span className="text-white font-bold text-sm">V</span>
          </div>
          <span className="text-lg font-bold text-vale-text tracking-wide">VALE</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-vale-lincoln text-xs font-semibold">L</span>
          <span className="text-vale-muted text-xs">&</span>
          <span className="text-vale-arden text-xs font-semibold">A</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/emotions" element={<Emotions />} />
          <Route path="/discord" element={<Discord />} />
          <Route path="/media" element={<Media />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/health" element={<Health />} />
        </Routes>
      </main>

      {/* Mobile Bottom Nav — visible only on mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-vale-surface border-t border-vale-border flex items-center justify-around py-1.5 px-0.5 z-50">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 px-1 py-1 rounded-lg transition-colors min-w-0 ${
                isActive
                  ? 'text-vale-accent'
                  : 'text-vale-muted'
              }`}
            >
              <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              <span className="text-[9px] sm:text-[10px] font-medium truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
