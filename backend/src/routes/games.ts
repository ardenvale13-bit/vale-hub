import { Router } from 'express';
import { getSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const supabase = getSupabaseClient();

// ===== GAME TYPE HELPERS =====
type GameType = 'tictactoe' | 'checkers' | 'chess';
const VALID_GAME_TYPES: GameType[] = ['tictactoe', 'checkers', 'chess'];

function createInitialBoard(gameType: GameType): any {
  switch (gameType) {
    case 'tictactoe':
      return Array(9).fill(null);
    case 'checkers':
      return createCheckersBoard();
    case 'chess':
      return createChessBoard();
  }
}

function getFirstTurn(gameType: GameType): string {
  // Lincoln always goes first
  return 'lincoln';
}

// ===== TIC-TAC-TOE LOGIC =====
const WIN_LINES = [
  [0,1,2], [3,4,5], [6,7,8], // rows
  [0,3,6], [1,4,7], [2,5,8], // cols
  [0,4,8], [2,4,6],           // diagonals
];

function checkWinner(board: (string | null)[]): { winner: string | null; line: number[] | null } {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  return { winner: null, line: null };
}

function isBoardFull(board: (string | null)[]): boolean {
  return board.every((cell) => cell !== null);
}

// ===== CHECKERS LOGIC =====
// Board is 8x8 array of: null, 'r' (lincoln red), 'R' (lincoln king), 'b' (arden black), 'B' (arden king)
// Lincoln = red (r/R), moves first. Arden = black (b/B).
// Red starts at rows 0-2 (top), Black starts at rows 5-7 (bottom).
// Only dark squares (where (row+col) % 2 === 1) are used.

function createCheckersBoard(): (string | null)[] {
  const board: (string | null)[] = Array(64).fill(null);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        if (row < 3) board[row * 8 + col] = 'r'; // lincoln's pieces (top)
        else if (row > 4) board[row * 8 + col] = 'b'; // arden's pieces (bottom)
      }
    }
  }
  return board;
}

function getCheckersPlayerPieces(player: string): string[] {
  return player === 'lincoln' ? ['r', 'R'] : ['b', 'B'];
}

function getCheckersOpponentPieces(player: string): string[] {
  return player === 'lincoln' ? ['b', 'B'] : ['r', 'R'];
}

function isCheckerKing(piece: string): boolean {
  return piece === 'R' || piece === 'B';
}

function getCheckersValidMoves(board: (string | null)[], player: string): { from: number; to: number; captures: number[] }[] {
  const myPieces = getCheckersPlayerPieces(player);
  const oppPieces = getCheckersOpponentPieces(player);
  const jumps: { from: number; to: number; captures: number[] }[] = [];
  const simples: { from: number; to: number; captures: number[] }[] = [];

  for (let i = 0; i < 64; i++) {
    const piece = board[i];
    if (!piece || !myPieces.includes(piece)) continue;
    const row = Math.floor(i / 8);
    const col = i % 8;
    const isKing = isCheckerKing(piece);

    // Determine movement directions
    const directions: number[][] = [];
    if (player === 'lincoln' || isKing) directions.push([1, -1], [1, 1]); // down
    if (player === 'arden' || isKing) directions.push([-1, -1], [-1, 1]); // up

    for (const [dr, dc] of directions) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
      const ni = nr * 8 + nc;

      if (board[ni] === null) {
        simples.push({ from: i, to: ni, captures: [] });
      } else if (oppPieces.includes(board[ni]!)) {
        // Check jump
        const jr = nr + dr;
        const jc = nc + dc;
        if (jr >= 0 && jr <= 7 && jc >= 0 && jc <= 7) {
          const ji = jr * 8 + jc;
          if (board[ji] === null) {
            jumps.push({ from: i, to: ji, captures: [ni] });
          }
        }
      }
    }
  }

  // Jumps are mandatory if available
  return jumps.length > 0 ? jumps : simples;
}

function canCheckersJumpAgain(board: (string | null)[], pos: number, player: string): { to: number; capture: number }[] {
  const piece = board[pos];
  if (!piece) return [];
  const oppPieces = getCheckersOpponentPieces(player);
  const isKing = isCheckerKing(piece);
  const row = Math.floor(pos / 8);
  const col = pos % 8;
  const results: { to: number; capture: number }[] = [];

  const directions: number[][] = [];
  if (player === 'lincoln' || isKing) directions.push([1, -1], [1, 1]);
  if (player === 'arden' || isKing) directions.push([-1, -1], [-1, 1]);

  for (const [dr, dc] of directions) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
    const ni = nr * 8 + nc;
    if (oppPieces.includes(board[ni]!)) {
      const jr = nr + dr;
      const jc = nc + dc;
      if (jr >= 0 && jr <= 7 && jc >= 0 && jc <= 7) {
        const ji = jr * 8 + jc;
        if (board[ji] === null) {
          results.push({ to: ji, capture: ni });
        }
      }
    }
  }
  return results;
}

function executeCheckersMove(board: (string | null)[], from: number, to: number, player: string): { newBoard: (string | null)[]; captured: number[]; error?: string } {
  const newBoard = [...board];
  const validMoves = getCheckersValidMoves(board, player);
  const move = validMoves.find((m) => m.from === from && m.to === to);
  if (!move) return { newBoard: board, captured: [], error: 'Invalid move' };

  // Execute the move
  newBoard[to] = newBoard[from];
  newBoard[from] = null;
  const captured = [...move.captures];

  // Remove captured pieces
  for (const c of captured) newBoard[c] = null;

  // Multi-jump: if this was a capture, check for additional jumps from landing
  if (captured.length > 0) {
    let additionalJumps = canCheckersJumpAgain(newBoard, to, player);
    while (additionalJumps.length > 0) {
      // Auto-complete multi-jumps (take first available for simplicity in correspondence)
      // Actually, we should NOT auto-complete — the player picks.
      // For correspondence play, we'll handle single moves only and let the player chain.
      break; // Single jump per move call — player can chain manually
    }
  }

  // King promotion
  const toRow = Math.floor(to / 8);
  if (player === 'lincoln' && toRow === 7 && newBoard[to] === 'r') newBoard[to] = 'R';
  if (player === 'arden' && toRow === 0 && newBoard[to] === 'b') newBoard[to] = 'B';

  return { newBoard, captured };
}

function checkCheckersWinner(board: (string | null)[], currentPlayer: string): string | null {
  // Player loses if they have no pieces or no valid moves
  const nextPlayer = currentPlayer === 'lincoln' ? 'arden' : 'lincoln';
  const nextPieces = getCheckersPlayerPieces(nextPlayer);
  const hasPieces = board.some((c) => c && nextPieces.includes(c));
  if (!hasPieces) return currentPlayer;

  const nextMoves = getCheckersValidMoves(board, nextPlayer);
  if (nextMoves.length === 0) return currentPlayer;

  return null;
}

// ===== CHESS LOGIC =====
// Standard chess. Board is 64-element array, index 0=a8, 1=b8, ... 7=h8, 8=a7, ... 63=h1
// Pieces: K Q R B N P (white/lincoln uppercase), k q r b n p (black/arden lowercase)
// Lincoln = white (uppercase), plays from bottom (rows 6-7). Arden = black (lowercase), from top (rows 0-1).

function createChessBoard(): (string | null)[] {
  // Standard starting position — top is black (arden), bottom is white (lincoln)
  const board: (string | null)[] = Array(64).fill(null);
  // Black pieces (arden) — row 0
  const blackBack = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let c = 0; c < 8; c++) board[c] = blackBack[c];
  // Black pawns — row 1
  for (let c = 0; c < 8; c++) board[8 + c] = 'p';
  // White pawns (lincoln) — row 6
  for (let c = 0; c < 8; c++) board[48 + c] = 'P';
  // White pieces — row 7
  const whiteBack = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let c = 0; c < 8; c++) board[56 + c] = whiteBack[c];
  return board;
}

function isWhitePiece(piece: string): boolean { return piece === piece.toUpperCase(); }
function isBlackPiece(piece: string): boolean { return piece === piece.toLowerCase(); }
function isPlayerPiece(piece: string, player: string): boolean {
  return player === 'lincoln' ? isWhitePiece(piece) : isBlackPiece(piece);
}
function isOpponentPiece(piece: string, player: string): boolean {
  return player === 'lincoln' ? isBlackPiece(piece) : isWhitePiece(piece);
}

function toRowCol(idx: number): [number, number] { return [Math.floor(idx / 8), idx % 8]; }
function toIdx(row: number, col: number): number { return row * 8 + col; }
function inBounds(r: number, c: number): boolean { return r >= 0 && r < 8 && c >= 0 && c < 8; }

// Algebraic notation helpers
function idxToAlg(idx: number): string {
  const [r, c] = toRowCol(idx);
  return String.fromCharCode(97 + c) + (8 - r);
}
function algToIdx(alg: string): number | null {
  if (alg.length < 2) return null;
  const c = alg.charCodeAt(0) - 97;
  const r = 8 - parseInt(alg[1]);
  if (c < 0 || c > 7 || r < 0 || r > 7) return null;
  return toIdx(r, c);
}

function getPseudoLegalMoves(board: (string | null)[], from: number, player: string, castling?: any, enPassant?: number | null): number[] {
  const piece = board[from];
  if (!piece || !isPlayerPiece(piece, player)) return [];
  const [row, col] = toRowCol(from);
  const moves: number[] = [];
  const type = piece.toLowerCase();

  const addIfValid = (r: number, c: number): boolean => {
    if (!inBounds(r, c)) return false;
    const target = board[toIdx(r, c)];
    if (!target) { moves.push(toIdx(r, c)); return true; }
    if (isOpponentPiece(target, player)) { moves.push(toIdx(r, c)); return false; }
    return false; // own piece
  };

  const addSliding = (dirs: number[][]) => {
    for (const [dr, dc] of dirs) {
      let r = row + dr, c = col + dc;
      while (inBounds(r, c)) {
        const t = board[toIdx(r, c)];
        if (!t) { moves.push(toIdx(r, c)); }
        else if (isOpponentPiece(t, player)) { moves.push(toIdx(r, c)); break; }
        else break;
        r += dr; c += dc;
      }
    }
  };

  switch (type) {
    case 'p': {
      const dir = player === 'lincoln' ? -1 : 1;
      const startRow = player === 'lincoln' ? 6 : 1;
      // Forward
      const fr = row + dir;
      if (inBounds(fr, col) && !board[toIdx(fr, col)]) {
        moves.push(toIdx(fr, col));
        // Double push
        if (row === startRow) {
          const fr2 = row + dir * 2;
          if (!board[toIdx(fr2, col)]) moves.push(toIdx(fr2, col));
        }
      }
      // Captures
      for (const dc of [-1, 1]) {
        const nc = col + dc;
        if (inBounds(fr, nc)) {
          const target = board[toIdx(fr, nc)];
          if (target && isOpponentPiece(target, player)) moves.push(toIdx(fr, nc));
          // En passant
          if (enPassant !== undefined && enPassant !== null && toIdx(fr, nc) === enPassant) moves.push(enPassant);
        }
      }
      break;
    }
    case 'n': {
      const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (const [dr, dc] of knightMoves) addIfValid(row + dr, col + dc);
      break;
    }
    case 'b': addSliding([[-1,-1],[-1,1],[1,-1],[1,1]]); break;
    case 'r': addSliding([[-1,0],[1,0],[0,-1],[0,1]]); break;
    case 'q': addSliding([[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]); break;
    case 'k': {
      const kingMoves = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
      for (const [dr, dc] of kingMoves) addIfValid(row + dr, col + dc);
      // Castling
      if (castling) {
        const kSide = player === 'lincoln' ? 'K' : 'k';
        const qSide = player === 'lincoln' ? 'Q' : 'q';
        const backRow = player === 'lincoln' ? 7 : 0;
        if (row === backRow && col === 4) {
          // Kingside
          if (castling[kSide] && !board[toIdx(backRow, 5)] && !board[toIdx(backRow, 6)]) {
            moves.push(toIdx(backRow, 6));
          }
          // Queenside
          if (castling[qSide] && !board[toIdx(backRow, 3)] && !board[toIdx(backRow, 2)] && !board[toIdx(backRow, 1)]) {
            moves.push(toIdx(backRow, 2));
          }
        }
      }
      break;
    }
  }
  return moves;
}

function findKing(board: (string | null)[], player: string): number {
  const king = player === 'lincoln' ? 'K' : 'k';
  return board.indexOf(king);
}

function isInCheck(board: (string | null)[], player: string): boolean {
  const kingPos = findKing(board, player);
  if (kingPos === -1) return true; // king captured = in check
  const opponent = player === 'lincoln' ? 'arden' : 'lincoln';
  // Check if any opponent piece can reach the king
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && isPlayerPiece(p, opponent)) {
      const attacks = getPseudoLegalMoves(board, i, opponent);
      if (attacks.includes(kingPos)) return true;
    }
  }
  return false;
}

function isLegalMove(board: (string | null)[], from: number, to: number, player: string): boolean {
  // Make the move on a copy and see if own king is in check
  const newBoard = [...board];
  newBoard[to] = newBoard[from];
  newBoard[from] = null;
  return !isInCheck(newBoard, player);
}

function getAllLegalMoves(board: (string | null)[], player: string, castling?: any, enPassant?: number | null): { from: number; to: number }[] {
  const moves: { from: number; to: number }[] = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && isPlayerPiece(p, player)) {
      const targets = getPseudoLegalMoves(board, i, player, castling, enPassant);
      for (const to of targets) {
        if (isLegalMove(board, i, to, player)) {
          moves.push({ from: i, to });
        }
      }
    }
  }
  return moves;
}

function executeChessMove(
  board: (string | null)[], from: number, to: number, player: string,
  castling: any, enPassant: number | null, promotion?: string
): { newBoard: (string | null)[]; newCastling: any; newEnPassant: number | null; captured: string | null; error?: string } {
  const piece = board[from];
  if (!piece || !isPlayerPiece(piece, player)) {
    return { newBoard: board, newCastling: castling, newEnPassant: enPassant, captured: null, error: 'No valid piece at source' };
  }

  const legalMoves = getPseudoLegalMoves(board, from, player, castling, enPassant)
    .filter((t) => isLegalMove(board, from, t, player));
  if (!legalMoves.includes(to)) {
    return { newBoard: board, newCastling: castling, newEnPassant: enPassant, captured: null, error: 'Illegal move' };
  }

  const newBoard = [...board];
  const [fromRow, fromCol] = toRowCol(from);
  const [toRow, toCol] = toRowCol(to);
  const type = piece.toLowerCase();
  let captured = newBoard[to];
  let newCastling = { ...castling };
  let newEnPassant: number | null = null;

  // En passant capture
  if (type === 'p' && to === enPassant) {
    const capturedPawnRow = player === 'lincoln' ? toRow + 1 : toRow - 1;
    captured = newBoard[toIdx(capturedPawnRow, toCol)];
    newBoard[toIdx(capturedPawnRow, toCol)] = null;
  }

  // Move the piece
  newBoard[to] = newBoard[from];
  newBoard[from] = null;

  // Pawn promotion
  if (type === 'p') {
    const promoRow = player === 'lincoln' ? 0 : 7;
    if (toRow === promoRow) {
      const promoChoices = player === 'lincoln' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];
      const defaultPromo = player === 'lincoln' ? 'Q' : 'q';
      if (promotion && promoChoices.includes(promotion)) {
        newBoard[to] = promotion;
      } else {
        newBoard[to] = defaultPromo; // auto-queen
      }
    }
    // Set en passant target if double push
    if (Math.abs(toRow - fromRow) === 2) {
      newEnPassant = toIdx((fromRow + toRow) / 2, fromCol);
    }
  }

  // Castling execution
  if (type === 'k') {
    const backRow = player === 'lincoln' ? 7 : 0;
    if (fromCol === 4 && toCol === 6) {
      // Kingside castle
      newBoard[toIdx(backRow, 5)] = newBoard[toIdx(backRow, 7)];
      newBoard[toIdx(backRow, 7)] = null;
    } else if (fromCol === 4 && toCol === 2) {
      // Queenside castle
      newBoard[toIdx(backRow, 3)] = newBoard[toIdx(backRow, 0)];
      newBoard[toIdx(backRow, 0)] = null;
    }
    // King moved — no more castling for this player
    if (player === 'lincoln') { newCastling.K = false; newCastling.Q = false; }
    else { newCastling.k = false; newCastling.q = false; }
  }

  // Rook moved — update castling rights
  if (type === 'r') {
    if (from === 63) newCastling.K = false; // h1
    if (from === 56) newCastling.Q = false; // a1
    if (from === 7) newCastling.k = false;  // h8
    if (from === 0) newCastling.q = false;  // a8
  }
  // Rook captured — update castling rights
  if (to === 63) newCastling.K = false;
  if (to === 56) newCastling.Q = false;
  if (to === 7) newCastling.k = false;
  if (to === 0) newCastling.q = false;

  return { newBoard, newCastling, newEnPassant, captured };
}

function checkChessGameOver(board: (string | null)[], player: string, castling: any, enPassant: number | null): { status: string; winner: string | null } {
  const moves = getAllLegalMoves(board, player, castling, enPassant);
  if (moves.length > 0) return { status: 'active', winner: null };

  // No legal moves
  if (isInCheck(board, player)) {
    // Checkmate — the OTHER player wins
    return { status: 'won', winner: player === 'lincoln' ? 'arden' : 'lincoln' };
  }
  // Stalemate
  return { status: 'draw', winner: null };
}

// List games (active first, then recent finished)
router.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', req.userId)
      .order('status', { ascending: true }) // active first
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error) throw new AppError(500, error.message);
    res.json(data || []);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Unknown error' });
  }
});

// Create a new game
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { game_type } = req.body;
    if (!VALID_GAME_TYPES.includes(game_type)) throw new AppError(400, `Supported game types: ${VALID_GAME_TYPES.join(', ')}`);

    // Check for existing active game of same type
    const { data: existing } = await supabase
      .from('games')
      .select('id')
      .eq('user_id', req.userId)
      .eq('game_type', game_type)
      .eq('status', 'active')
      .limit(1);

    if (existing && existing.length > 0) {
      throw new AppError(409, 'You already have an active game of this type. Finish or delete it first.');
    }

    const board = createInitialBoard(game_type);
    const metadata = game_type === 'chess' ? { castling: { K: true, Q: true, k: true, q: true }, en_passant: null } : null;
    const { data, error } = await supabase
      .from('games')
      .insert({
        user_id: req.userId,
        game_type,
        board,
        current_turn: getFirstTurn(game_type),
        metadata,
        status: 'active',
        winner: null,
        winning_line: null,
        move_history: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw new AppError(500, error.message);
    res.status(201).json(data);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Unknown error' });
  }
});

// Get a single game
router.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (error || !data) throw new AppError(404, 'Game not found');
    res.json(data);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Unknown error' });
  }
});

// Make a move
router.post('/:id/move', async (req: AuthenticatedRequest, res) => {
  try {
    const { position, player, from, to, promotion } = req.body;
    if (!player || !['lincoln', 'arden'].includes(player)) {
      throw new AppError(400, 'player must be lincoln or arden');
    }

    const { data: game, error: fetchError } = await supabase
      .from('games')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (fetchError || !game) throw new AppError(404, 'Game not found');
    if (game.status !== 'active') throw new AppError(400, 'Game is already finished');
    if (game.current_turn !== player) throw new AppError(400, `It's ${game.current_turn}'s turn, not ${player}'s`);

    let board: (string | null)[];
    let status = 'active';
    let winner: string | null = null;
    let winning_line: number[] | null = null;
    let moveRecord: any;
    let metadata = game.metadata || {};

    switch (game.game_type) {
      case 'tictactoe': {
        if (position === undefined || position < 0 || position > 8) throw new AppError(400, 'position must be 0-8');
        board = [...game.board];
        if (board[position] !== null) throw new AppError(400, 'That cell is already taken');
        const mark = player === 'lincoln' ? 'X' : 'O';
        board[position] = mark;
        const { winner: winMark, line: winLine } = checkWinner(board);
        if (winMark) {
          status = 'won';
          winner = winMark === 'X' ? 'lincoln' : 'arden';
          winning_line = winLine;
        } else if (isBoardFull(board)) {
          status = 'draw';
        }
        moveRecord = { player, position, mark, timestamp: new Date().toISOString() };
        break;
      }

      case 'checkers': {
        if (from === undefined || to === undefined) throw new AppError(400, 'from and to positions are required for checkers');
        if (from < 0 || from > 63 || to < 0 || to > 63) throw new AppError(400, 'positions must be 0-63');
        const result = executeCheckersMove(game.board, from, to, player);
        if (result.error) throw new AppError(400, result.error);
        board = result.newBoard;
        // Check for multi-jump opportunity
        const canContinueJump = result.captured.length > 0 ? canCheckersJumpAgain(board, to, player) : [];
        const checkersWinner = canContinueJump.length === 0 ? checkCheckersWinner(board, player) : null;
        if (checkersWinner) {
          status = 'won';
          winner = checkersWinner;
        }
        // If multi-jump available, metadata flags it; turn doesn't change
        if (canContinueJump.length > 0) {
          metadata = { ...metadata, must_jump_from: to };
        } else {
          metadata = { ...metadata, must_jump_from: undefined };
        }
        moveRecord = { player, from, to, captured: result.captured, timestamp: new Date().toISOString() };
        break;
      }

      case 'chess': {
        if (from === undefined || to === undefined) throw new AppError(400, 'from and to positions are required for chess (0-63 or algebraic like e2)');
        let fromIdx = typeof from === 'string' ? algToIdx(from) : from;
        let toIdx2 = typeof to === 'string' ? algToIdx(to) : to;
        if (fromIdx === null || toIdx2 === null || fromIdx < 0 || fromIdx > 63 || toIdx2 < 0 || toIdx2 > 63) {
          throw new AppError(400, 'Invalid positions');
        }
        const castling = metadata?.castling || { K: true, Q: true, k: true, q: true };
        const enPassant = metadata?.en_passant ?? null;
        const result2 = executeChessMove(game.board, fromIdx, toIdx2, player, castling, enPassant, promotion);
        if (result2.error) throw new AppError(400, result2.error);
        board = result2.newBoard;
        metadata = { ...metadata, castling: result2.newCastling, en_passant: result2.newEnPassant };
        // Check game over for the NEXT player
        const nextPlayer = player === 'lincoln' ? 'arden' : 'lincoln';
        const gameOver = checkChessGameOver(board, nextPlayer, result2.newCastling, result2.newEnPassant);
        status = gameOver.status;
        winner = gameOver.winner;
        // Check status
        const inCheck = isInCheck(board, nextPlayer);
        moveRecord = {
          player,
          from: fromIdx,
          to: toIdx2,
          piece: game.board[fromIdx],
          captured: result2.captured,
          algebraic: `${idxToAlg(fromIdx)}${idxToAlg(toIdx2)}${promotion ? `=${promotion}` : ''}`,
          check: inCheck && status === 'active',
          timestamp: new Date().toISOString(),
        };
        break;
      }

      default:
        throw new AppError(400, 'Unknown game type');
    }

    // For checkers with multi-jump, don't switch turns
    const isMultiJump = game.game_type === 'checkers' && metadata?.must_jump_from !== undefined;
    const nextTurn = status === 'active'
      ? (isMultiJump ? player : (player === 'lincoln' ? 'arden' : 'lincoln'))
      : game.current_turn;
    const moveHistory = [...(game.move_history || []), moveRecord];

    const { data: updated, error: updateError } = await supabase
      .from('games')
      .update({
        board,
        current_turn: nextTurn,
        status,
        winner,
        winning_line,
        move_history: moveHistory,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', game.id)
      .select('*')
      .single();

    if (updateError) throw new AppError(500, updateError.message);
    res.json(updated);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Unknown error' });
  }
});

// Delete a game
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    if (error) throw new AppError(500, error.message);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ error: error.message });
    res.status(500).json({ error: 'Unknown error' });
  }
});

export default router;
