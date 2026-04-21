const PIECES = {
  white: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
  black: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' }
};

const PIECE_SYMBOLS = {
  'K': '♚', 'Q': '♛', 'R': '♜', 'B': '♝', 'N': '♞', 'P': '♟',
  'k': '♔', 'q': '♕', 'r': '♖', 'b': '♗', 'n': '♘', 'p': '♙'
};

const INITIAL_BOARD = [
  ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
  ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
  ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
];

let board = [];
let selectedSquare = null;
let currentTurn = 'white';
let moveCount = 0;
let castlingRights = { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } };
let enPassantSquare = null;
let halfMoveClock = 0;

const chaosRules = [
  { name: 'Pawns move like knights', apply: 'pawnKnightMove' },
  { name: 'Bishops move like rooks', apply: 'bishopRookMove' },
  { name: 'Rooks move like bishops', apply: 'rookBishopMove' },
  { name: 'Queens move like knights', apply: 'queenKnightMove' },
  { name: 'Knights move like queens', apply: 'knightQueenMove' },
  { name: 'No castling allowed', apply: 'noCastling' },
  { name: 'En passant disabled', apply: 'noEnPassant' },
  { name: 'King can jump 2 squares', apply: 'kingLongMove' },
  { name: 'Pawns can move sideways', apply: 'pawnSideMove' },
  { name: 'Only knights can give check', apply: 'onlyKnightsCheck' }
];

let currentChaosRules = [];

function initBoard() {
  board = JSON.parse(JSON.stringify(INITIAL_BOARD));
  currentTurn = 'white';
  moveCount = 0;
  castlingRights = { white: { kingSide: true, queenSide: true }, black: { kingSide: true, queenSide: true } };
  enPassantSquare = null;
  halfMoveClock = 0;
}

function getPieceColor(piece) {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? 'white' : 'black';
}

function getPieceType(piece) {
  return piece ? piece.toLowerCase() : null;
}

function isOwnPiece(piece, color) {
  return getPieceColor(piece) === color;
}

function isEnemyPiece(piece, color) {
  return getPieceColor(piece) === (color === 'white' ? 'black' : 'white');
}

function getOppPawn(color) {
  return color === 'white' ? 'p' : 'P';
}

function getValidMoves(row, col, checkCheck = true) {
  const piece = board[row][col];
  if (!piece) return [];
  const color = getPieceColor(piece);
  const type = getPieceType(piece);
  let moves = [];

  const baseMoves = getBaseMoves(type, row, col, color);
  moves = baseMoves.filter(([r, c]) => r >= 0 && r < 8 && c >= 0 && c < 8);

  if (currentChaosRules.some(r => r.apply === 'noCastling') && (type === 'k' || type === 'K')) {
    return moves;
  }

  if (checkCheck) {
    moves = moves.filter(([r, c]) => !wouldBeInCheck(row, col, r, c, color));
  }

  return moves;
}

function getBaseMoves(type, row, col, color) {
  const moves = [];
  const forward = color === 'white' ? -1 : 1;
  const startRow = color === 'white' ? 6 : 1;

  const pawnKnight = currentChaosRules.some(r => r.apply === 'pawnKnightMove');
  const pawnSide = currentChaosRules.some(r => r.apply === 'pawnSideMove');
  const bishopRook = currentChaosRules.some(r => r.apply === 'bishopRookMove');
  const rookBishop = currentChaosRules.some(r => r.apply === 'rookBishopMove');
  const queenKnight = currentChaosRules.some(r => r.apply === 'queenKnightMove');
  const knightQueen = currentChaosRules.some(r => r.apply === 'knightQueenMove');

  switch (type) {
    case 'p':
      if (pawnKnight) {
        const km = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (let [dr, dc] of km) {
          const nr = row + dr, nc = col + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            if (!isOwnPiece(board[nr][nc], color)) moves.push([nr, nc]);
          }
        }
      } else {
        if (board[row + forward]?.[col] === null) {
          moves.push([row + forward, col]);
          if (row === startRow && board[row + forward * 2]?.[col] === null) {
            moves.push([row + forward * 2, col]);
          }
        }
        for (let dc of [-1, 1]) {
          const nr = row + forward, nc = col + dc;
          if (nc >= 0 && nc < 8) {
            if (isEnemyPiece(board[nr]?.[nc], color)) moves.push([nr, nc]);
            if (currentChaosRules.some(r => r.apply !== 'noEnPassant') && enPassantSquare?.row === row && enPassantSquare?.col === col + dc) {
              moves.push([row + forward, col + dc]);
            }
          }
        }
        if (pawnSide && board[row]?.[col - 1]) {
          if (!isOwnPiece(board[row][col - 1], color)) moves.push([row, col - 1]);
          if (isEnemyPiece(board[row][col - 1], color)) moves.push([row, col - 1]);
        }
        if (pawnSide && board[row]?.[col + 1]) {
          if (!isOwnPiece(board[row][col + 1], color)) moves.push([row, col + 1]);
          if (isEnemyPiece(board[row][col + 1], color)) moves.push([row, col + 1]);
        }
      }
      break;

    case 'r':
      if (rookBishop) {
        for (let dr of [-1, 1, -1, 1]) {
          for (let dc of [-1, 1, -1, 1]) {
            for (let i = 1; i < 8; i++) {
              const nr = row + dr * i, nc = col + dc * i;
              if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
              if (!board[nr][nc]) {
                moves.push([nr, nc]);
              } else if (isEnemyPiece(board[nr][nc], color)) {
                moves.push([nr, nc]);
                break;
              } else break;
            }
          }
        }
      } else {
        for (let dr of [-1, 1, 0, 0]) {
          for (let dc of [0, 0, -1, 1]) {
            for (let i = 1; i < 8; i++) {
              const nr = row + dr * i, nc = col + dc * i;
              if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
              if (!board[nr][nc]) {
                moves.push([nr, nc]);
              } else if (isEnemyPiece(board[nr][nc], color)) {
                moves.push([nr, nc]);
                break;
              } else break;
            }
          }
        }
      }
      break;

    case 'b':
      if (bishopRook) {
        for (let dr of [-1, 1, 0, 0]) {
          for (let dc of [0, 0, -1, 1]) {
            for (let i = 1; i < 8; i++) {
              const nr = row + dr * i, nc = col + dc * i;
              if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
              if (!board[nr][nc]) {
                moves.push([nr, nc]);
              } else if (isEnemyPiece(board[nr][nc], color)) {
                moves.push([nr, nc]);
                break;
              } else break;
            }
          }
        }
      } else {
        for (let dr of [-1, 1, -1, 1]) {
          for (let dc of [-1, 1, -1, 1]) {
            for (let i = 1; i < 8; i++) {
              const nr = row + dr * i, nc = col + dc * i;
              if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
              if (!board[nr][nc]) {
                moves.push([nr, nc]);
              } else if (isEnemyPiece(board[nr][nc], color)) {
                moves.push([nr, nc]);
                break;
              } else break;
            }
          }
        }
      }
      break;

    case 'n':
      if (knightQueen) {
        for (let dr of [-1, 0, 1]) {
          for (let dc of [-1, 0, 1]) {
            if (dr === 0 && dc === 0) continue;
            for (let i = 1; i < 8; i++) {
              const nr = row + dr * i, nc = col + dc * i;
              if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
              if (!board[nr][nc]) {
                moves.push([nr, nc]);
              } else if (isEnemyPiece(board[nr][nc], color)) {
                moves.push([nr, nc]);
                break;
              } else break;
            }
          }
        }
      } else {
        const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (let [dr, dc] of knightMoves) {
          const nr = row + dr, nc = col + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !isOwnPiece(board[nr][nc], color)) {
            moves.push([nr, nc]);
          }
        }
      }
      break;

    case 'q':
      if (queenKnight) {
        const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        for (let [dr, dc] of knightMoves) {
          const nr = row + dr, nc = col + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !isOwnPiece(board[nr][nc], color)) {
            moves.push([nr, nc]);
          }
        }
      } else {
        for (let dr of [-1, 0, 1]) {
          for (let dc of [-1, 0, 1]) {
            if (dr === 0 && dc === 0) continue;
            for (let i = 1; i < 8; i++) {
              const nr = row + dr * i, nc = col + dc * i;
              if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
              if (!board[nr][nc]) {
                moves.push([nr, nc]);
              } else if (isEnemyPiece(board[nr][nc], color)) {
                moves.push([nr, nc]);
                break;
              } else break;
            }
          }
        }
      }
      break;

    case 'k':
      const kingLong = currentChaosRules.some(r => r.apply === 'kingLongMove');
      for (let dr of [-1, 0, 1]) {
        for (let dc of [-1, 0, 1]) {
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr, nc = col + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !isOwnPiece(board[nr][nc], color)) {
            moves.push([nr, nc]);
          }
        }
      }
      if (kingLong) {
        for (let dr of [-2, 2]) {
          for (let dc of [-1, 1]) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !isOwnPiece(board[nr][nc], color)) {
              moves.push([nr, nc]);
            }
          }
        }
      }
      if (!currentChaosRules.some(r => r.apply === 'noCastling')) {
        if (canCastle(col, row, color, 'kingSide')) moves.push([row, col + 2]);
        if (canCastle(col, row, color, 'queenSide')) moves.push([row, col - 2]);
      }
      break;
  }

  return moves;
}

function canCastle(kingCol, kingRow, color, side) {
  if (color === 'white') {
    if (side === 'kingSide' && !castlingRights.white.kingSide) return false;
    if (side === 'queenSide' && !castlingRights.white.queenSide) return false;
  } else {
    if (side === 'kingSide' && !castlingRights.black.kingSide) return false;
    if (side === 'queenSide' && !castlingRights.black.queenSide) return false;
  }
  const targetRow = color === 'white' ? 7 : 0;
  const targetCol = side === 'kingSide' ? 6 : 2;
  const checkCol = side === 'kingSide' ? 5 : 3;
  if (board[targetRow][kingCol] !== (color === 'white' ? 'wk' : 'WK')) return false;
  if (board[targetRow][targetCol] !== null || board[targetRow][checkCol] !== null) return false;
  if (isSquareAttacked(targetRow, kingCol, color === 'white' ? 'black' : 'white')) return false;
  if (isSquareAttacked(targetRow, checkCol, color === 'white' ? 'black' : 'white')) return false;
  if (isSquareAttacked(targetRow, targetCol, color === 'white' ? 'black' : 'white')) return false;
  return true;
}

function isSquareAttacked(row, col, byColor) {
  const onlyKnightsCheck = currentChaosRules.some(r => r.apply === 'onlyKnightsCheck');

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || getPieceColor(piece) !== byColor) continue;
      const type = getPieceType(piece);

      if (onlyKnightsCheck && type !== 'n') continue;

      if (type === 'p') {
        const forward = byColor === 'white' ? -1 : 1;
        if (r + forward === row && (c - 1 === col || c + 1 === col)) return true;
      } else if (type === 'n') {
        const moves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        if (moves.some(([dr, dc]) => r + dr === row && c + dc === col)) return true;
      } else if (type === 'b' || type === 'q') {
        for (let dr of [-1, 1, -1, 1]) {
          for (let dc of [-1, 1, -1, 1]) {
            for (let i = 1; i < 8; i++) {
              const nr = r + dr * i, nc = c + dc * i;
              if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
              if (nr === row && nc === col) return true;
              if (board[nr][nc]) break;
            }
          }
        }
      } else if (type === 'r' || type === 'q') {
        for (let dr of [-1, 1, 0, 0]) {
          for (let dc of [0, 0, -1, 1]) {
            for (let i = 1; i < 8; i++) {
              const nr = r + dr * i, nc = c + dc * i;
              if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) break;
              if (nr === row && nc === col) return true;
              if (board[nr][nc]) break;
            }
          }
        }
      } else if (type === 'k') {
        for (let dr of [-1, 0, 1]) {
          for (let dc of [-1, 0, 1]) {
            if (dr === 0 && dc === 0) continue;
            if (r + dr === row && c + dc === col) return true;
          }
        }
      }
    }
  }
  return false;
}

function findKing(color) {
  const king = color === 'white' ? 'wk' : 'WK';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === king) return [r, c];
    }
  }
  return null;
}

function isInCheck(color) {
  const kingPos = findKing(color);
  if (!kingPos) return false;
  return isSquareAttacked(kingPos[0], kingPos[1], color === 'white' ? 'black' : 'white');
}

function wouldBeInCheck(fromRow, fromCol, toRow, toCol, color) {
  const piece = board[fromRow][fromCol];
  const captured = board[toRow][toCol];
  const epCapture = (getPieceType(piece) === 'p' && toCol !== fromCol && board[toRow][toCol] === null);

  board[fromRow][fromCol] = null;
  board[toRow][toCol] = piece;

  if (epCapture) {
    board[fromRow][toCol] = null;
  }

  const inCheck = isInCheck(color);

  board[fromRow][fromCol] = piece;
  board[toRow][toCol] = captured;

  if (epCapture) {
    board[fromRow][toCol] = color === 'white' ? 'bp' : 'BP';
  }

  return inCheck;
}

function hasValidMoves(color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || getPieceColor(piece) !== color) continue;
      if (getValidMoves(r, c, true).length > 0) return true;
    }
  }
  return false;
}

function makeMove(fromRow, fromCol, toRow, toCol) {
  const piece = board[fromRow][fromCol];
  const type = getPieceType(piece);
  const color = getPieceColor(piece);
  const captured = board[toRow][toCol];

  board[fromRow][fromCol] = null;
  board[toRow][toCol] = piece;

  if (type === 'p' && Math.abs(toCol - fromCol) === 1 && board[toRow][toCol] === null) {
    board[fromRow][toCol] = null;
  }

  if (type === 'k' && Math.abs(toCol - fromCol) === 2) {
    if (toCol > fromCol) {
      board[toRow][5] = board[toRow][7];
      board[toRow][7] = null;
    } else {
      board[toRow][3] = board[toRow][0];
      board[toRow][0] = null;
    }
  }

  if (type === 'p' && (toRow === 0 || toRow === 7)) {
    board[toRow][toCol] = color === 'white' ? 'wq' : 'bq';
  }

  if (color === currentTurn) {
    if (type === 'k') {
      castlingRights[color].kingSide = false;
      castlingRights[color].queenSide = false;
    }
    if (type === 'r') {
      if (fromCol === 0) castlingRights[color].queenSide = false;
      if (fromCol === 7) castlingRights[color].kingSide = false;
    }
  }

  if (type === 'p' && Math.abs(toRow - fromRow) === 2) {
    enPassantSquare = { row: (fromRow + toRow) / 2, col: fromCol };
  } else {
    enPassantSquare = null;
  }

  if (!captured && type !== 'p') {
    halfMoveClock++;
  } else {
    halfMoveClock = 0;
  }

  moveCount++;
}

function addChaosRule() {
  const availableRules = chaosRules.filter(r => !currentChaosRules.includes(r));
  if (availableRules.length === 0) return;

  const newRule = availableRules[Math.floor(Math.random() * availableRules.length)];
  currentChaosRules.push(newRule);

  const rulesList = document.getElementById('rules-list');
  const ruleDiv = document.createElement('div');
  ruleDiv.className = 'rule';
  ruleDiv.textContent = newRule.name;
  rulesList.appendChild(ruleDiv);
}

function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';

  const kingPos = currentTurn === 'white' ? findKing('white') : findKing('black');
  const inCheck = isInCheck(currentTurn);

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = document.createElement('div');
      square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
      square.dataset.row = row;
      square.dataset.col = col;

      if (inCheck && kingPos && row === kingPos[0] && col === kingPos[1]) {
        square.classList.add('check');
      }

      const piece = board[row][col];
      if (piece) {
        const pieceSpan = document.createElement('span');
        pieceSpan.className = `piece ${getPieceColor(piece)}`;
        let symbol = PIECE_SYMBOLS[piece];
        if (!symbol) symbol = piece.toUpperCase();
        pieceSpan.textContent = symbol;
        square.appendChild(pieceSpan);
      }

      if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
        square.classList.add('selected');
      }

      if (selectedSquare) {
        const moves = getValidMoves(selectedSquare.row, selectedSquare.col);
        for (const [mr, mc] of moves) {
          if (mr === row && mc === col) {
            const targetPiece = board[mr][mc];
            const isCapture = targetPiece && getPieceColor(targetPiece) !== currentTurn;
            square.classList.add(isCapture ? 'valid-capture' : 'valid-move');
          }
        }
      }

      square.addEventListener('click', () => handleSquareClick(row, col));
      boardEl.appendChild(square);
    }
  }
}

function handleSquareClick(row, col) {
  const piece = board[row][col];
  const color = getPieceColor(piece);

  if (selectedSquare) {
    const moves = getValidMoves(selectedSquare.row, selectedSquare.col);
    const isValidMove = moves.some(([r, c]) => r === row && c === col);

    if (isValidMove) {
      makeMove(selectedSquare.row, selectedSquare.col, row, col);
      selectedSquare = null;

      renderBoard();

      currentTurn = currentTurn === 'white' ? 'black' : 'white';
      updateTurnIndicator();

      if (!hasValidMoves(currentTurn)) {
        if (isInCheck(currentTurn)) {
          showGameOver(currentTurn === 'white' ? 'Black' : 'White');
        } else {
          showGameOver('Draw');
        }
        return;
      }

      addChaosRule();
      renderBoard();
      return;
    }
  }

  if (color === currentTurn) {
    selectedSquare = { row, col };
    renderBoard();
  }
}

function updateTurnIndicator() {
  const indicator = document.getElementById('turn-indicator');
  indicator.textContent = `${currentTurn === 'white' ? 'White' : 'Black'} to move (Turn ${moveCount + 1})`;
}

function showGameOver(winner) {
  const gameOverEl = document.getElementById('game-over');
  const winnerText = document.getElementById('winner-text');

  if (winner === 'Draw') {
    winnerText.textContent = 'Stalemate!';
  } else {
    winnerText.textContent = `${winner} wins!`;
  }

  gameOverEl.classList.add('show');
}

function restartGame() {
  document.getElementById('game-over').classList.remove('show');

  const rulesList = document.getElementById('rules-list');
  rulesList.innerHTML = `
    <div class="rule">Standard chess rules apply</div>
    <div class="rule">Checkmate the opponent to win</div>
  `;

  currentChaosRules = [];
  initBoard();
  renderBoard();
  updateTurnIndicator();
}

initBoard();
renderBoard();
updateTurnIndicator();