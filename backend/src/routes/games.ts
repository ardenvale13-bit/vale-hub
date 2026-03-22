import { Router } from 'express';
import { getSupabaseClient } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();
const supabase = getSupabaseClient();

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
    if (game_type !== 'tictactoe') throw new AppError(400, 'Only tictactoe is supported right now');

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

    const board = Array(9).fill(null);
    const { data, error } = await supabase
      .from('games')
      .insert({
        user_id: req.userId,
        game_type,
        board,
        current_turn: 'lincoln', // X goes first
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
    const { position, player } = req.body;
    if (position === undefined || position < 0 || position > 8) {
      throw new AppError(400, 'position must be 0-8');
    }
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

    const board = [...game.board];
    if (board[position] !== null) throw new AppError(400, 'That cell is already taken');

    // Place the piece
    const mark = player === 'lincoln' ? 'X' : 'O';
    board[position] = mark;

    // Check for winner or draw
    const { winner: winMark, line: winLine } = checkWinner(board);
    let status = 'active';
    let winner: string | null = null;
    let winning_line: number[] | null = null;

    if (winMark) {
      status = 'won';
      winner = winMark === 'X' ? 'lincoln' : 'arden';
      winning_line = winLine;
    } else if (isBoardFull(board)) {
      status = 'draw';
    }

    const nextTurn = status === 'active' ? (player === 'lincoln' ? 'arden' : 'lincoln') : game.current_turn;
    const moveHistory = [...(game.move_history || []), { player, position, mark, timestamp: new Date().toISOString() }];

    const { data: updated, error: updateError } = await supabase
      .from('games')
      .update({
        board,
        current_turn: nextTurn,
        status,
        winner,
        winning_line,
        move_history: moveHistory,
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
