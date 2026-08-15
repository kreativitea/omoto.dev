# omoto.dev

Eleventy → static HTML → GitHub Pages. See `README.md` for build, deploy, and design notes.

## Work in a worktree

**Default to an isolated git worktree for any change to this repo.** Call `EnterWorktree` before the
first edit, and keep the main checkout at `/Users/toshi/Code/personal/omoto` clean for previewing
what's actually on `main`.

Skip the worktree only when the task is read-only (answering questions, reading code), or when Mike
explicitly says to work in the main checkout.

Worktrees land in `.claude/worktrees/<name>/`, which is gitignored — they are separate checkouts,
never part of a commit here.

Configured in `.claude/settings.json` and `.worktreeinclude`:

- `worktree.baseRef: "head"` — new worktrees branch from the current local `HEAD`, not
  `origin/main`, so unpushed commits come along.
- `.worktreeinclude` copies `node_modules/` into each new worktree, so `npm run dev` runs
  immediately without a reinstall.

## Previewing from a worktree

`.claude/launch.json` defines the dev servers. Run them from inside the worktree — the `site` and
`demos` entries use relative paths, so they serve that worktree's files. If the main checkout is
already serving on 8080, start the worktree's server on a different port rather than fighting over
it.

## Before finishing

Commit inside the worktree and open a PR. Don't merge to `main` without asking — `main` deploys to
the live site on push.
