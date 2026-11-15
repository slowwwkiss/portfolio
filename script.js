/* Mini chess board (hero) + scroll reveal.
   No dependencies. Board rules are simplified on purpose:
   pseudo legal moves only, no check, no castling, no en passant.
   Pawns promote to queen automatically. */
(function () {
  "use strict";

  /* ---------- Scroll reveal ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("visible"); });
  }

  /* ---------- Chess board ---------- */
  var GLYPH = {
    K: "\u2654", Q: "\u2655", R: "\u2656", B: "\u2657", N: "\u2658", P: "\u2659",
    k: "\u265A", q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E", p: "\u265F"
  };
  var NAME = {
    K: "white king", Q: "white queen", R: "white rook", B: "white bishop",
    N: "white knight", P: "white pawn",
    k: "black king", q: "black queen", r: "black rook", b: "black bishop",
    n: "black knight", p: "black pawn"
  };
  var FILES = "abcdefgh";
  var START = [
    "rnbqkbnr",
    "pppppppp",
    "........",
    "........",
    "........",
    "........",
    "PPPPPPPP",
    "RNBQKBNR"
  ];

  var boardEl = document.getElementById("chessboard");
  var statusEl = document.getElementById("board-status");
  var resetBtn = document.getElementById("board-reset");
  if (!boardEl || !statusEl) return;

  var board, turn, selected, legal;

  function freshBoard() {
    return START.map(function (row) { return row.split(""); });
  }

  function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function isWhite(p) { return p >= "A" && p <= "Z"; }
  function isEmpty(p) { return p === "."; }
  function isEnemy(p, white) { return !isEmpty(p) && isWhite(p) !== white; }

  function slideMoves(r, c, dirs, white, out) {
    dirs.forEach(function (d) {
      var nr = r + d[0], nc = c + d[1];
      while (inBounds(nr, nc)) {
        var p = board[nr][nc];
        if (isEmpty(p)) { out.push([nr, nc]); }
        else {
          if (isEnemy(p, white)) out.push([nr, nc]);
          break;
        }
        nr += d[0]; nc += d[1];
      }
    });
  }

  function movesFor(r, c) {
    var p = board[r][c];
    if (isEmpty(p)) return [];
    var white = isWhite(p);
    var type = p.toUpperCase();
    var out = [];
    var dir, startRow, nr, nc, i;

    if (type === "P") {
      dir = white ? -1 : 1;
      startRow = white ? 6 : 1;
      nr = r + dir;
      if (inBounds(nr, c) && isEmpty(board[nr][c])) {
        out.push([nr, c]);
        var nr2 = r + 2 * dir;
        if (r === startRow && isEmpty(board[nr2][c])) out.push([nr2, c]);
      }
      [-1, 1].forEach(function (dc) {
        nc = c + dc;
        if (inBounds(nr, nc) && isEnemy(board[nr][nc], white)) out.push([nr, nc]);
      });
    } else if (type === "N") {
      [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
        .forEach(function (m) {
          nr = r + m[0]; nc = c + m[1];
          if (inBounds(nr, nc) && (isEmpty(board[nr][nc]) || isEnemy(board[nr][nc], white))) {
            out.push([nr, nc]);
          }
        });
    } else if (type === "B") {
      slideMoves(r, c, [[-1, -1], [-1, 1], [1, -1], [1, 1]], white, out);
    } else if (type === "R") {
      slideMoves(r, c, [[-1, 0], [1, 0], [0, -1], [0, 1]], white, out);
    } else if (type === "Q") {
      slideMoves(r, c, [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]], white, out);
    } else if (type === "K") {
      for (i = -1; i <= 1; i++) {
        for (var j = -1; j <= 1; j++) {
          if (i === 0 && j === 0) continue;
          nr = r + i; nc = c + j;
          if (inBounds(nr, nc) && (isEmpty(board[nr][nc]) || isEnemy(board[nr][nc], white))) {
            out.push([nr, nc]);
          }
        }
      }
    }
    return out;
  }

  function squareName(r, c) { return FILES[c] + (8 - r); }

  function render() {
    boardEl.innerHTML = "";
    for (var r = 0; r < 8; r++) {
      for (var c = 0; c < 8; c++) {
        (function (r, c) {
          var p = board[r][c];
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "square " + (((r + c) % 2 === 0) ? "light" : "dark");
          btn.setAttribute("role", "gridcell");
          var label = squareName(r, c);
          if (!isEmpty(p)) label += ", " + NAME[p];
          btn.setAttribute("aria-label", label);
          if (!isEmpty(p)) btn.textContent = GLYPH[p];
          if (selected && selected[0] === r && selected[1] === c) {
            btn.classList.add("selected");
          }
          if (legal) {
            legal.forEach(function (m) {
              if (m[0] === r && m[1] === c) {
                btn.classList.add(isEmpty(board[r][c]) ? "legal" : "capture");
              }
            });
          }
          btn.addEventListener("click", function () { onSquare(r, c); });
          boardEl.appendChild(btn);
        })(r, c);
      }
    }
  }

  function setStatus(text) { statusEl.textContent = text; }

  function onSquare(r, c) {
    var p = board[r][c];

    if (selected) {
      var isLegal = legal.some(function (m) { return m[0] === r && m[1] === c; });
      if (isLegal) {
        var piece = board[selected[0]][selected[1]];
        var captured = board[r][c];
        board[r][c] = piece;
        board[selected[0]][selected[1]] = ".";
        if (piece === "P" && r === 0) board[r][c] = "Q";
        if (piece === "p" && r === 7) board[r][c] = "q";
        var note = "";
        if (!isEmpty(captured)) note = " " + NAME[piece] + " takes " + NAME[captured] + " on " + squareName(r, c) + ".";
        selected = null; legal = null;
        turn = turn === "w" ? "b" : "w";
        setStatus((turn === "w" ? "White" : "Black") + " to move." + note);
        render();
        return;
      }
      if (!isEmpty(p) && isWhite(p) === (turn === "w")) {
        select(r, c);
        return;
      }
      selected = null; legal = null;
      setStatus((turn === "w" ? "White" : "Black") + " to move.");
      render();
      return;
    }

    if (!isEmpty(p) && isWhite(p) === (turn === "w")) select(r, c);
  }

  function select(r, c) {
    selected = [r, c];
    legal = movesFor(r, c);
    setStatus(NAME[board[r][c]] + " on " + squareName(r, c) + " selected. " +
      (legal.length ? legal.length + " move" + (legal.length > 1 ? "s" : "") + " available." : "No moves available."));
    render();
  }

  function reset() {
    board = freshBoard();
    turn = "w";
    selected = null;
    legal = null;
    setStatus("White to move.");
    render();
  }

  if (resetBtn) resetBtn.addEventListener("click", reset);
  reset();
})();
