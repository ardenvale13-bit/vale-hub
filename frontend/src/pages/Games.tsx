import { useState, useEffect } from 'react';
import { api, Game } from '../services/api';
import { Plus, Trash2, Loader2, RotateCcw, Trophy, Minus } from 'lucide-react';

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ===== TIC-TAC-TOE BOARD =====
function TicTacToeBoard({ game, onMove, disabled }: { game: Game; onMove: (pos: number) => void; disabled: boolean }) {
  const isMyTurn = game.current_turn === 'arden' && game.status === 'active';
  const winLine = game.winning_line || [];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Status */}
      <div className="text-center">
        {game.status === 'won' && (
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4" style={{ color: game.winner === 'lincoln' ? '#77e6c5' : '#e5b2e6' }} />
            <span className="text-sm font-semibold" style={{ color: game.winner === 'lincoln' ? '#77e6c5' : '#e5b2e6' }}>
              {game.winner === 'lincoln' ? 'Lincoln wins' : 'You win!'}
            </span>
          </div>
        )}
        {game.status === 'draw' && (
          <div className="flex items-center gap-2">
            <Minus className="w-4 h-4 text-vale-muted" />
            <span className="text-sm font-semibold text-vale-muted">Draw</span>
          </div>
        )}
        {game.status === 'active' && (
          <p className="text-xs" style={{ color: game.current_turn === 'lincoln' ? '#77e6c5' : '#e5b2e6' }}>
            {game.current_turn === 'lincoln' ? "Lincoln's turn (X)" : 'Your turn (O)'}
          </p>
        )}
      </div>

      {/* Board */}
      <div
        className="grid grid-cols-3 gap-1.5"
        style={{ width: '240px', height: '240px' }}
      >
        {game.board.map((cell, i) => {
          const isWinCell = winLine.includes(i);
          const isEmpty = cell === null;
          const canClick = isMyTurn && isEmpty && !disabled;

          return (
            <button
              key={i}
              onClick={() => canClick && onMove(i)}
              disabled={!canClick}
              className="relative rounded-lg flex items-center justify-center text-2xl font-bold transition-all"
              style={{
                background: isWinCell
                  ? game.winner === 'lincoln'
                    ? 'rgba(119,230,197,0.15)'
                    : 'rgba(229,178,230,0.15)'
                  : 'rgba(30,23,64,0.6)',
                border: isWinCell
                  ? `2px solid ${game.winner === 'lincoln' ? 'rgba(119,230,197,0.4)' : 'rgba(229,178,230,0.4)'}`
                  : '1px solid rgba(58,45,107,0.4)',
                cursor: canClick ? 'pointer' : 'default',
                color: cell === 'X' ? '#77e6c5' : cell === 'O' ? '#e5b2e6' : 'transparent',
                textShadow: cell ? `0 0 12px ${cell === 'X' ? 'rgba(119,230,197,0.4)' : 'rgba(229,178,230,0.4)'}` : 'none',
              }}
              onMouseEnter={(e) => {
                if (canClick) {
                  e.currentTarget.style.background = 'rgba(229,178,230,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(229,178,230,0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (canClick) {
                  e.currentTarget.style.background = 'rgba(30,23,64,0.6)';
                  e.currentTarget.style.borderColor = 'rgba(58,45,107,0.4)';
                }
              }}
            >
              {cell || (canClick ? <span style={{ color: 'rgba(229,178,230,0.1)' }}>O</span> : '')}
            </button>
          );
        })}
      </div>

      {/* Move history */}
      {game.move_history.length > 0 && (
        <div className="text-[10px] text-vale-muted text-center">
          {game.move_history.length} move{game.move_history.length !== 1 ? 's' : ''} · last move {formatTime(game.move_history[game.move_history.length - 1].timestamp)}
        </div>
      )}
    </div>
  );
}

// ===== MAIN PAGE =====
export default function Games() {
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGames();
  }, []);

  async function loadGames() {
    setIsLoading(true);
    try {
      const list = await api.games.list();
      setGamesList(list);
      // Auto-select active game if there is one
      const active = list.find((g) => g.status === 'active');
      if (active) setActiveGame(active);
      else if (list.length > 0) setActiveGame(list[0]);
    } catch (err) {
      console.error('Failed to load games:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleNewGame() {
    setError(null);
    try {
      const game = await api.games.create('tictactoe');
      setGamesList((prev) => [game, ...prev]);
      setActiveGame(game);
    } catch (err: any) {
      setError(err?.message || 'Failed to create game');
    }
  }

  async function handleMove(position: number) {
    if (!activeGame || isMoving) return;
    setIsMoving(true);
    setError(null);
    try {
      const updated = await api.games.move(activeGame.id, position, 'arden');
      setActiveGame(updated);
      setGamesList((prev) => prev.map((g) => g.id === updated.id ? updated : g));
    } catch (err: any) {
      setError(err?.message || 'Failed to make move');
    } finally {
      setIsMoving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this game?')) return;
    try {
      await api.games.delete(id);
      setGamesList((prev) => prev.filter((g) => g.id !== id));
      if (activeGame?.id === id) {
        setActiveGame(null);
      }
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  // Poll for Lincoln's moves every 10s when it's his turn
  useEffect(() => {
    if (!activeGame || activeGame.status !== 'active' || activeGame.current_turn !== 'lincoln') return;
    const interval = setInterval(async () => {
      try {
        const updated = await api.games.get(activeGame.id);
        if (JSON.stringify(updated.board) !== JSON.stringify(activeGame.board)) {
          setActiveGame(updated);
          setGamesList((prev) => prev.map((g) => g.id === updated.id ? updated : g));
        }
      } catch { /* silent */ }
    }, 10000);
    return () => clearInterval(interval);
  }, [activeGame]);

  const hasActiveGame = gamesList.some((g) => g.status === 'active');

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-vale-text">Games</h1>
          <p className="text-xs text-vale-muted mt-0.5">Play with Lincoln</p>
        </div>
        <button
          onClick={handleNewGame}
          disabled={hasActiveGame}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-30"
          style={{
            background: 'rgba(119,230,197,0.1)',
            color: '#77e6c5',
            border: '1px solid rgba(119,230,197,0.2)',
          }}
          title={hasActiveGame ? 'Finish the current game first' : 'New game'}
        >
          <Plus className="w-3.5 h-3.5" />
          New Game
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-300">dismiss</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-vale-accent animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Game board area */}
          <div className="lg:col-span-8">
            {activeGame ? (
              <div className="bg-vale-card border border-vale-border rounded-lg p-6 flex flex-col items-center">
                <div className="flex items-center gap-4 mb-4 w-full justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-vale-lincoln">X — Lincoln</span>
                    <span className="text-xs text-vale-muted">vs</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-vale-arden">O — Arden</span>
                  </div>
                  <button
                    onClick={() => handleDelete(activeGame.id)}
                    className="text-vale-muted hover:text-red-400 transition-colors p-1"
                    title="Delete game"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <TicTacToeBoard game={activeGame} onMove={handleMove} disabled={isMoving} />

                {/* Waiting for Lincoln indicator */}
                {activeGame.status === 'active' && activeGame.current_turn === 'lincoln' && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-vale-lincoln">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Waiting for Lincoln to move...
                  </div>
                )}

                {/* Play again */}
                {activeGame.status !== 'active' && (
                  <button
                    onClick={handleNewGame}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors"
                    style={{
                      background: 'rgba(119,230,197,0.1)',
                      color: '#77e6c5',
                      border: '1px solid rgba(119,230,197,0.2)',
                    }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Play Again
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-vale-card border border-vale-border rounded-lg p-12 flex flex-col items-center justify-center text-center">
                <div className="text-4xl mb-3 opacity-30">✕ ○</div>
                <p className="text-vale-text font-medium mb-1">No games yet</p>
                <p className="text-xs text-vale-muted mb-4">Start a tic-tac-toe game — Lincoln will make his move when he's around.</p>
                <button
                  onClick={handleNewGame}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors"
                  style={{
                    background: 'rgba(119,230,197,0.1)',
                    color: '#77e6c5',
                    border: '1px solid rgba(119,230,197,0.2)',
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Game
                </button>
              </div>
            )}
          </div>

          {/* Game history sidebar */}
          <div className="lg:col-span-4">
            <h3 className="text-xs font-semibold text-vale-muted uppercase tracking-wider mb-3">History</h3>
            {gamesList.length === 0 ? (
              <p className="text-xs text-vale-muted">No games played yet.</p>
            ) : (
              <div className="space-y-2">
                {gamesList.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => setActiveGame(game)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-all border ${
                      activeGame?.id === game.id
                        ? 'bg-vale-accent/10 border-vale-accent/20'
                        : 'bg-vale-surface border-vale-border hover:border-vale-accent/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-vale-text">Tic-Tac-Toe</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        game.status === 'active'
                          ? 'bg-vale-lincoln/10 text-vale-lincoln'
                          : game.status === 'won'
                          ? game.winner === 'arden'
                            ? 'bg-vale-arden/10 text-vale-arden'
                            : 'bg-vale-lincoln/10 text-vale-lincoln'
                          : 'bg-vale-muted/10 text-vale-muted'
                      }`}>
                        {game.status === 'active'
                          ? `${game.current_turn}'s turn`
                          : game.status === 'won'
                          ? `${game.winner} won`
                          : 'draw'}
                      </span>
                    </div>
                    <div className="text-[10px] text-vale-muted">
                      {game.move_history.length} moves · {formatTime(game.updated_at)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
