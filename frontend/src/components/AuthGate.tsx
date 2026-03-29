import { useState, useEffect } from 'react';

// Simple password gate — keeps strangers out of the frontend
// Password is checked against a SHA-256 hash so the actual password isn't in the bundle
const PASS_HASH = (import.meta as any).env?.VITE_AUTH_HASH || '';
const SESSION_KEY = 'vale-auth-session';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getSession(): boolean {
  try {
    const session = localStorage.getItem(SESSION_KEY);
    if (!session) return false;
    const { expires } = JSON.parse(session);
    if (Date.now() > expires) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function setSession() {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ expires: Date.now() + SESSION_DURATION })
  );
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If no hash is configured, skip auth entirely (dev mode)
  useEffect(() => {
    if (!PASS_HASH) {
      setAuthenticated(true);
      setChecking(false);
      return;
    }
    setAuthenticated(getSession());
    setChecking(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError('');

    try {
      const hash = await hashPassword(password.trim());
      if (hash === PASS_HASH) {
        setSession();
        setAuthenticated(true);
      } else {
        setError('Wrong password');
        setPassword('');
      }
    } catch {
      setError('Something went wrong');
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="h-screen bg-vale-bg flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-vale-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="h-screen bg-vale-bg flex items-center justify-center px-6">
      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-vale-mint to-vale-purple flex items-center justify-center mb-3">
            <span className="text-white font-bold text-2xl">V</span>
          </div>
          <h1 className="text-2xl font-bold text-vale-text tracking-wide font-display">VALE</h1>
          <p className="text-xs text-vale-muted mt-0.5">Binary Home</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full px-4 py-3 rounded-lg text-sm transition-all outline-none"
              style={{
                background: 'rgba(30,23,64,0.6)',
                border: error ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(58,45,107,0.4)',
                color: '#e8e0f0',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(229,178,230,0.4)'; }}
              onBlur={(e) => { e.target.style.borderColor = error ? 'rgba(239,68,68,0.5)' : 'rgba(58,45,107,0.4)'; }}
            />
            {error && (
              <p className="text-xs mt-1.5 text-red-400">{error}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full py-3 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, rgba(138,138,154,0.3), rgba(229,178,230,0.3))',
              border: '1px solid rgba(229,178,230,0.2)',
              color: '#e8e0f0',
            }}
          >
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
