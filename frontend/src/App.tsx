import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, Brain, Heart, MessageSquare, Mic, BookOpen } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Memory from './pages/Memory';
import Emotions from './pages/Emotions';
import Discord from './pages/Discord';
import Media from './pages/Media';
import Journal from './pages/Journal';

export default function App() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/memory', label: 'Memory', icon: Brain },
    { path: '/emotions', label: 'Emotions', icon: Heart },
    { path: '/discord', label: 'Discord', icon: MessageSquare },
    { path: '/media', label: 'Media', icon: Mic },
    { path: '/journal', label: 'Journal', icon: BookOpen },
  ];

  return (
    <div className="flex h-screen bg-vale-bg text-vale-text">
      {/* Sidebar */}
      <aside className="w-64 bg-vale-surface border-r border-vale-border flex flex-col overflow-y-auto">
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

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/emotions" element={<Emotions />} />
          <Route path="/discord" element={<Discord />} />
          <Route path="/media" element={<Media />} />
          <Route path="/journal" element={<Journal />} />
        </Routes>
      </main>
    </div>
  );
}
