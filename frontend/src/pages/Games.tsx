import { useState, useEffect, useCallback } from 'react';
import { api, Game, GameType } from '../services/api';
import { Plus, Trash2, Loader2, RotateCcw, Trophy, Minus, Crown } from 'lucide-react';

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
      <StatusLine game={game} />
      <div className="grid grid-cols-3 gap-1.5" style={{ width: '240px', height: '240px' }}>
        {game.board.map((cell, i) => {
          const isWinCell = winLine.includes(i);
          const isEmpty = cell === null;
          const canClick = isMyTurn && isEmpty && !disabled;
          const isLincoln = cell === 'X';
          const isArden = cell === 'O';
          return (
            <button
              key={i}
              onClick={() => canClick && onMove(i)}
              disabled={!canClick}
              className="relative rounded-lg flex items-center justify-center transition-all"
              style={{
                background: isWinCell
                  ? game.winner === 'lincoln' ? 'rgba(138,138,154,0.15)' : 'rgba(229,178,230,0.15)'
                  : 'rgba(30,23,64,0.6)',
                border: isWinCell
                  ? `2px solid ${game.winner === 'lincoln' ? 'rgba(138,138,154,0.4)' : 'rgba(229,178,230,0.4)'}`
                  : '1px solid rgba(58,45,107,0.4)',
                cursor: canClick ? 'pointer' : 'default',
              }}
              onMouseEnter={(e) => { if (canClick) { e.currentTarget.style.background = 'rgba(229,178,230,0.08)'; e.currentTarget.style.borderColor = 'rgba(229,178,230,0.3)'; } }}
              onMouseLeave={(e) => { if (canClick) { e.currentTarget.style.background = 'rgba(30,23,64,0.6)'; e.currentTarget.style.borderColor = 'rgba(58,45,107,0.4)'; } }}
            >
              {isLincoln && (
                <img src="/pieces/tictactoe/lincoln.png" alt="X" className="w-14 h-14 object-contain select-none pointer-events-none" draggable={false} />
              )}
              {isArden && (
                <img src="/pieces/tictactoe/arden.png" alt="O" className="w-14 h-14 object-contain select-none pointer-events-none" draggable={false} />
              )}
              {isEmpty && canClick && (
                <img src="/pieces/tictactoe/arden.png" alt="O" className="w-10 h-10 object-contain opacity-10 select-none pointer-events-none" draggable={false} />
              )}
            </button>
          );
        })}
      </div>
      <MoveCount game={game} />
    </div>
  );
}

// ===== CHECKERS BOARD =====
function CheckersBoard({ game, onMove, disabled }: { game: Game; onMove: (from: number, to: number) => void; disabled: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const isMyTurn = game.current_turn === 'arden' && game.status === 'active';
  const myPieces = ['b', 'B'];

  // Highlight valid destinations when a piece is selected
  const getValidMoves = useCallback((from: number): number[] => {
    if (!isMyTurn) return [];
    const board = game.board;
    const piece = board[from];
    if (!piece || !myPieces.includes(piece)) return [];
    const row = Math.floor(from / 8);
    const col = from % 8;
    const isKing = piece === 'B';
    const oppPieces = ['r', 'R'];
    const moves: number[] = [];
    const jumps: number[] = [];

    // Must-jump-from constraint (multi-jump)
    if (game.metadata?.must_jump_from !== undefined && game.metadata.must_jump_from !== from) return [];

    const dirs: number[][] = [];
    if (isKing) { dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]); }
    else { dirs.push([-1, -1], [-1, 1]); } // arden moves up

    for (const [dr, dc] of dirs) {
      const nr = row + dr, nc = col + dc;
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
      const ni = nr * 8 + nc;
      if (board[ni] === null) {
        moves.push(ni);
      } else if (oppPieces.includes(board[ni]!)) {
        const jr = nr + dr, jc = nc + dc;
        if (jr >= 0 && jr <= 7 && jc >= 0 && jc <= 7) {
          const ji = jr * 8 + jc;
          if (board[ji] === null) jumps.push(ji);
        }
      }
    }
    return jumps.length > 0 ? jumps : moves;
  }, [game, isMyTurn]);

  const handleCellClick = (idx: number) => {
    if (!isMyTurn || disabled) return;
    const piece = game.board[idx];

    if (selected !== null) {
      const validMoves = getValidMoves(selected);
      if (validMoves.includes(idx)) {
        onMove(selected, idx);
        setSelected(null);
        return;
      }
    }

    // Select a piece
    if (piece && myPieces.includes(piece)) {
      setSelected(idx);
    } else {
      setSelected(null);
    }
  };

  const validDestinations = selected !== null ? getValidMoves(selected) : [];
  const lincolnCount = game.board.filter((c) => c === 'r' || c === 'R').length;
  const ardenCount = game.board.filter((c) => c === 'b' || c === 'B').length;

  // Reset selection when game updates
  useEffect(() => { setSelected(null); }, [game.board]);

  return (
    <div className="flex flex-col items-center gap-4">
      <StatusLine game={game} />
      {/* Piece counts */}
      <div className="flex items-center gap-4 text-xs">
        <span style={{ color: '#8a8a9a' }}>Lincoln: {lincolnCount}</span>
        <span className="text-vale-muted">vs</span>
        <span style={{ color: '#e5b2e6' }}>Arden: {ardenCount}</span>
      </div>
      {/* Board */}
      <div className="grid grid-cols-8" style={{ width: '288px', height: '288px' }}>
        {Array.from({ length: 64 }).map((_, idx) => {
          const row = Math.floor(idx / 8);
          const col = idx % 8;
          const isDark = (row + col) % 2 === 1;
          const piece = game.board[idx];
          const isSelected = selected === idx;
          const isValidDest = validDestinations.includes(idx);
          const isLincoln = piece === 'r' || piece === 'R';
          const isArden = piece === 'b' || piece === 'B';
          const isKing = piece === 'R' || piece === 'B';
          const canSelect = isMyTurn && isArden && !disabled;

          return (
            <div
              key={idx}
              onClick={() => isDark && handleCellClick(idx)}
              className="flex items-center justify-center relative transition-all"
              style={{
                width: '36px',
                height: '36px',
                background: isSelected
                  ? 'rgba(229,178,230,0.25)'
                  : isValidDest
                  ? 'rgba(229,178,230,0.12)'
                  : isDark
                  ? 'rgba(30,23,64,0.7)'
                  : 'rgba(58,45,107,0.2)',
                cursor: isDark && (canSelect || isValidDest) ? 'pointer' : 'default',
                border: isSelected ? '2px solid rgba(229,178,230,0.5)' : '1px solid rgba(58,45,107,0.15)',
              }}
            >
              {piece && (
                <div
                  className="rounded-full flex items-center justify-center"
                  style={{
                    width: '28px',
                    height: '28px',
                    background: isLincoln
                      ? 'radial-gradient(circle, #8a8a9a 60%, #6a6a7a 100%)'
                      : 'radial-gradient(circle, #e5b2e6 60%, #c47cc5 100%)',
                    boxShadow: isLincoln
                      ? '0 2px 6px rgba(138,138,154,0.3)'
                      : '0 2px 6px rgba(229,178,230,0.3)',
                    border: `2px solid ${isLincoln ? '#5cc9a7' : '#b87ab9'}`,
                  }}
                >
                  {isKing && <Crown className="w-3 h-3 text-white" />}
                </div>
              )}
              {isValidDest && !piece && (
                <div
                  className="rounded-full"
                  style={{
                    width: '10px',
                    height: '10px',
                    background: 'rgba(229,178,230,0.3)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <MoveCount game={game} />
    </div>
  );
}

// ===== CHESS BOARD =====
// Custom piece images — Lincoln plays dark pieces, Arden plays light/pink pieces
// Backend: uppercase = lincoln, lowercase = arden (game logic unchanged)
const CHESS_PIECE_IMAGES: Record<string, string> = {
  'K': '/pieces/lincoln/king.png',
  'Q': '/pieces/lincoln/queen.png',
  'R': '/pieces/lincoln/rook.png',
  'B': '/pieces/lincoln/bishop.png',
  'N': '/pieces/lincoln/knight.png',
  'P': '/pieces/lincoln/pawn.png',
  'k': '/pieces/arden/king.png',
  'q': '/pieces/arden/queen.png',
  'r': '/pieces/arden/rook.png',
  'b': '/pieces/arden/bishop.png',
  'n': '/pieces/arden/knight.png',
  'p': '/pieces/arden/pawn.png',
};

// Fallback unicode in case images fail to load
const CHESS_PIECES: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
};

function ChessBoard({ game, onMove, disabled }: { game: Game; onMove: (from: number, to: number) => void; disabled: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const isMyTurn = game.current_turn === 'arden' && game.status === 'active';

  const isMyPiece = (piece: string | null): boolean => {
    if (!piece) return false;
    return piece === piece.toLowerCase(); // arden = black (lowercase)
  };

  const handleCellClick = (idx: number) => {
    if (!isMyTurn || disabled) return;
    const piece = game.board[idx];

    if (selected !== null) {
      // If clicking own piece, re-select
      if (piece && isMyPiece(piece)) {
        setSelected(idx);
        return;
      }
      // Otherwise try to move
      onMove(selected, idx);
      setSelected(null);
      return;
    }

    if (piece && isMyPiece(piece)) {
      setSelected(idx);
    }
  };

  const lastMove = game.move_history.length > 0 ? game.move_history[game.move_history.length - 1] : null;
  const lastFrom = lastMove?.from;
  const lastTo = lastMove?.to;

  // Reset selection on board change
  useEffect(() => { setSelected(null); }, [game.board]);

  return (
    <div className="flex flex-col items-center gap-4">
      <StatusLine game={game} />
      {/* Coordinates + board */}
      <div>
        {/* Column labels */}
        <div className="flex ml-5 mb-0.5">
          {['a','b','c','d','e','f','g','h'].map((l) => (
            <div key={l} className="text-[9px] text-vale-muted text-center" style={{ width: '36px' }}>{l}</div>
          ))}
        </div>
        <div className="flex">
          {/* Row labels */}
          <div className="flex flex-col mr-1">
            {[8,7,6,5,4,3,2,1].map((n) => (
              <div key={n} className="text-[9px] text-vale-muted flex items-center justify-center" style={{ width: '16px', height: '36px' }}>{n}</div>
            ))}
          </div>
          {/* Board */}
          <div className="grid grid-cols-8" style={{ width: '288px', height: '288px' }}>
            {Array.from({ length: 64 }).map((_, idx) => {
              const row = Math.floor(idx / 8);
              const col = idx % 8;
              const isDark = (row + col) % 2 === 1;
              const piece = game.board[idx];
              const isSelected = selected === idx;
              const isLastMove = idx === lastFrom || idx === lastTo;
              const isWhite = piece ? piece === piece.toUpperCase() : false;
              const canSelect = isMyTurn && piece && isMyPiece(piece) && !disabled;

              return (
                <div
                  key={idx}
                  onClick={() => handleCellClick(idx)}
                  className="flex items-center justify-center transition-all"
                  style={{
                    width: '36px',
                    height: '36px',
                    background: isSelected
                      ? 'rgba(229,178,230,0.3)'
                      : isLastMove
                      ? 'rgba(200,180,100,0.15)'
                      : isDark
                      ? 'rgba(30,23,64,0.7)'
                      : 'rgba(58,45,107,0.2)',
                    cursor: canSelect || (selected !== null && isMyTurn) ? 'pointer' : 'default',
                    border: isSelected ? '2px solid rgba(229,178,230,0.5)' : '1px solid rgba(58,45,107,0.1)',
                  }}
                >
                  {piece && (
                    CHESS_PIECE_IMAGES[piece] ? (
                      <img
                        src={CHESS_PIECE_IMAGES[piece]}
                        alt={CHESS_PIECES[piece] || piece}
                        className="select-none pointer-events-none"
                        style={{
                          width: '30px',
                          height: '30px',
                          objectFit: 'contain',
                        }}
                        draggable={false}
                      />
                    ) : (
                      <span
                        className="text-xl select-none"
                        style={{
                          color: isWhite ? '#8a8a9a' : '#e5b2e6',
                          textShadow: `0 1px 4px ${isWhite ? 'rgba(138,138,154,0.4)' : 'rgba(229,178,230,0.4)'}`,
                          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))',
                        }}
                      >
                        {CHESS_PIECES[piece] || piece}
                      </span>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Last move notation */}
      {lastMove?.algebraic && (
        <div className="text-[10px] text-vale-muted">
          Last: <span className="font-mono">{lastMove.algebraic}</span>
          {lastMove.check && <span className="text-red-400 ml-1">+</span>}
        </div>
      )}
      <MoveCount game={game} />
    </div>
  );
}

// ===== SHARED UI =====
function StatusLine({ game }: { game: Game }) {
  if (game.status === 'won') {
    return (
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4" style={{ color: game.winner === 'lincoln' ? '#8a8a9a' : '#e5b2e6' }} />
        <span className="text-sm font-semibold" style={{ color: game.winner === 'lincoln' ? '#8a8a9a' : '#e5b2e6' }}>
          {game.winner === 'lincoln' ? 'Lincoln wins' : 'You win!'}
        </span>
      </div>
    );
  }
  if (game.status === 'draw') {
    return (
      <div className="flex items-center gap-2">
        <Minus className="w-4 h-4 text-vale-muted" />
        <span className="text-sm font-semibold text-vale-muted">Draw</span>
      </div>
    );
  }
  return (
    <p className="text-xs" style={{ color: game.current_turn === 'lincoln' ? '#8a8a9a' : '#e5b2e6' }}>
      {game.current_turn === 'lincoln' ? "Lincoln's turn" : 'Your turn'}
    </p>
  );
}

function MoveCount({ game }: { game: Game }) {
  if (game.move_history.length === 0) return null;
  return (
    <div className="text-[10px] text-vale-muted text-center">
      {game.move_history.length} move{game.move_history.length !== 1 ? 's' : ''} · last move {formatTime(game.move_history[game.move_history.length - 1].timestamp)}
    </div>
  );
}

const GAME_LABELS: Record<GameType, string> = {
  tictactoe: 'Tic-Tac-Toe',
  checkers: 'Checkers',
  chess: 'Chess',
};

const GAME_ROLES: Record<GameType, [string, string]> = {
  tictactoe: ['Lincoln', 'Arden'],
  checkers: ['Red — Lincoln', 'Black — Arden'],
  chess: ['Black — Lincoln', 'White — Arden'],
};

// ===== MAIN PAGE =====
export default function Games() {
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newGameType, setNewGameType] = useState<GameType>('tictactoe');
  const [showNewMenu, setShowNewMenu] = useState(false);

  useEffect(() => { loadGames(); }, []);

  async function loadGames() {
    setIsLoading(true);
    try {
      const list = await api.games.list();
      setGamesList(list);
      const active = list.find((g) => g.status === 'active');
      if (active) setActiveGame(active);
      else if (list.length > 0) setActiveGame(list[0]);
    } catch (err) {
      console.error('Failed to load games:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleNewGame(type: GameType) {
    setError(null);
    setShowNewMenu(false);
    try {
      const game = await api.games.create(type);
      setGamesList((prev) => [game, ...prev]);
      setActiveGame(game);
    } catch (err: any) {
      setError(err?.message || 'Failed to create game');
    }
  }

  async function handleTTTMove(position: number) {
    if (!activeGame || isMoving) return;
    setIsMoving(true);
    setError(null);
    try {
      const updated = await api.games.move(activeGame.id, 'arden', { position });
      setActiveGame(updated);
      setGamesList((prev) => prev.map((g) => g.id === updated.id ? updated : g));
    } catch (err: any) {
      setError(err?.message || 'Failed to make move');
    } finally {
      setIsMoving(false);
    }
  }

  async function handleBoardMove(from: number, to: number) {
    if (!activeGame || isMoving) return;
    setIsMoving(true);
    setError(null);
    try {
      const updated = await api.games.move(activeGame.id, 'arden', { from, to });
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
      if (activeGame?.id === id) setActiveGame(null);
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

  const hasActiveByType = (type: GameType) => gamesList.some((g) => g.status === 'active' && g.game_type === type);

  function renderBoard() {
    if (!activeGame) return null;
    switch (activeGame.game_type) {
      case 'tictactoe':
        return <TicTacToeBoard game={activeGame} onMove={handleTTTMove} disabled={isMoving} />;
      case 'checkers':
        return <CheckersBoard game={activeGame} onMove={handleBoardMove} disabled={isMoving} />;
      case 'chess':
        return <ChessBoard game={activeGame} onMove={handleBoardMove} disabled={isMoving} />;
    }
  }

  const roles = activeGame ? GAME_ROLES[activeGame.game_type] : null;

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-vale-text">Games</h1>
          <p className="text-xs text-vale-muted mt-0.5">Play with Lincoln</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowNewMenu(!showNewMenu)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors"
            style={{
              background: 'rgba(138,138,154,0.1)',
              color: '#8a8a9a',
              border: '1px solid rgba(138,138,154,0.2)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            New Game
          </button>
          {showNewMenu && (
            <div
              className="absolute right-0 mt-1 w-44 rounded-lg shadow-lg z-50 overflow-hidden"
              style={{ background: '#1e1740', border: '1px solid rgba(58,45,107,0.5)' }}
            >
              {(['tictactoe', 'checkers', 'chess'] as GameType[]).map((type) => {
                const hasActive = hasActiveByType(type);
                return (
                  <button
                    key={type}
                    onClick={() => !hasActive && handleNewGame(type)}
                    disabled={hasActive}
                    className="w-full text-left px-3 py-2.5 text-xs transition-colors hover:bg-white/5 disabled:opacity-30"
                    style={{ color: '#e5e2f0' }}
                  >
                    {GAME_LABELS[type]}
                    {hasActive && <span className="text-vale-muted ml-1">(active)</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
                    <span className="text-xs font-semibold uppercase tracking-wider text-vale-lincoln">{roles?.[0]}</span>
                    <span className="text-xs text-vale-muted">vs</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-vale-arden">{roles?.[1]}</span>
                  </div>
                  <button
                    onClick={() => handleDelete(activeGame.id)}
                    className="text-vale-muted hover:text-red-400 transition-colors p-1"
                    title="Delete game"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {renderBoard()}

                {/* Waiting for Lincoln */}
                {activeGame.status === 'active' && activeGame.current_turn === 'lincoln' && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-vale-lincoln">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Waiting for Lincoln to move...
                  </div>
                )}

                {/* Play again */}
                {activeGame.status !== 'active' && (
                  <button
                    onClick={() => handleNewGame(activeGame.game_type)}
                    disabled={hasActiveByType(activeGame.game_type)}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-30"
                    style={{
                      background: 'rgba(138,138,154,0.1)',
                      color: '#8a8a9a',
                      border: '1px solid rgba(138,138,154,0.2)',
                    }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Play Again
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-vale-card border border-vale-border rounded-lg p-12 flex flex-col items-center justify-center text-center">
                <div className="flex items-center gap-2 mb-3 opacity-40">
                  <img src="/pieces/lincoln/king.png" alt="♔" className="w-8 h-8 object-contain" />
                  <img src="/pieces/arden/queen.png" alt="♛" className="w-8 h-8 object-contain" />
                  <span className="text-3xl">⬤</span>
                </div>
                <p className="text-vale-text font-medium mb-1">No games yet</p>
                <p className="text-xs text-vale-muted mb-4">Start a game — Lincoln will make his move when he's around.</p>
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
                      <span className="text-xs font-medium text-vale-text">{GAME_LABELS[game.game_type]}</span>
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
      {/* Click-away for menu */}
      {showNewMenu && <div className="fixed inset-0 z-40" onClick={() => setShowNewMenu(false)} />}
    </div>
  );
}
