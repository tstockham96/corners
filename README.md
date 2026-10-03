# CORNERS

**A daily logic puzzle.** Give every row and column its number of dots. **Never let four dots form a rectangle.**

```
    2 2 2
 2  ● ● ·      ✓  every count met, no rectangle
 2  ● · ●
 2  · ● ●

 2  ● ● ·      ✗  the four dots top-left are the corners of a rectangle
 2  ● ● ·
```

Rectangles of any size count, as long as their sides run along the grid. Every puzzle has exactly one answer, reachable by logic alone.

Play: https://tstockham96.github.io/corners/

## The daily
- **Board size:** 5×5 on Monday, 6×6 Tuesday–Thursday, 7×7 Friday–Sunday.
- **Difficulty ramps like the NYT crossword:**
  - Monday needs only the basic rules.
  - Wednesday introduces the **Squeeze**.
  - Thursday/Friday need the **Pair count**.
  - Saturday/Sunday add a short **What-if**.
- **Puzzle set:** 420 precomputed puzzles, 60 per weekday, in `src/core/puzzles.json`.
  - Puzzle #N is the same for everyone and flips at local midnight.
  - #1 = Sat Oct 3, 2026.
- **Controls:**
  - Tap a cell to cycle dot → ✕ → empty. Drag to ✕ many cells.
  - ✕ mode and Undo are available.
  - Rule breaks (rectangles, over-full or impossible lines) light up red instantly.
- **Hints** explain the next deduction in plain words and highlight it. "Show me" fills it in.
- **Score:** time, hints and slips. ⭐ = no hints, no slips.
  - Share text is spoiler-free: `CORNERS #12 ⭐ 3:41 · no hints`.
  - There are streaks and a challenge link (`#c=…`).

## Deductions the puzzles teach
| Name | What it says |
|---|---|
| Full line / Last spaces | Counting. |
| Corner | Three corners of a rectangle mean the fourth cell stays empty. |
| Squeeze | A line can use at most one of another line's dot positions. |
| Pair count | Two lines needing a and b dots must use a + b − 1 different positions. |
| What-if | A ≤ 3-step contradiction. |

## Dev
```
npm ci
npm test              # vitest: every stored puzzle is brute-force unique and logic-solvable; weekday difficulty; hints valid
npm run build         # dist/ (Pages) + dist-single/index.html (opens from disk)
npm run e2e           # Playwright, 390x844 touch: solves full puzzles by tapping -> shots/
npm run trace -- 2    # human-readable solve path of puzzle #2
npm run precompute -- 7 60 && npm run merge   # regenerate a weekday pool
```

**Code layout:**
| File | Contents |
|---|---|
| `src/core/model.ts` | rules and conflicts |
| `src/core/solver.ts` | logical solver with plain-words steps |
| `src/core/brute.ts` | independent uniqueness checker |
| `src/core/gen.ts`, `src/core/levels.ts` | generator and weekday ladder |
| `src/core/hint.ts` | hints |
| `src/ui/app.ts` | UI |
