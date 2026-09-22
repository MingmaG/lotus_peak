# Working on this repo together

Two people build Lotus Peak day to day, and a third may join:

| Who | Mainly owns | Also touches |
| --- | --- | --- |
| Web developer | `apps/web`, `packages/seo`, `packages/media` | `packages/api-contracts` (reading it) |
| Admin developer | `apps/admin`, `apps/admin/prisma`, `packages/email` | `apps/web`, to wire the site to the panel |

The overlap is real and it is where every merge conflict will come from. Everything
below exists to make that overlap boring.

---

## 1. The branches

```
main       production. What the server runs. Nobody commits to it directly.
develop    integration. The latest working code. Everyone branches from it and
           merges back into it. This is "the latest code" the team shares.
feature/*  one person, one change, a few days at most.
fix/*      same, for a defect.
chore/*    same, for dependencies, config, tidying.
hotfix/*   branched from main, not develop. Production is on fire.
```

`develop` is the default branch for day-to-day work. `main` only ever moves by merging
`develop` into it (or a `hotfix/*`), and that merge is a deliberate release, not a
side-effect of someone's afternoon.

Branch names are lowercase, hyphenated, and say what the change is:

```
feature/journey-gallery-lightbox
fix/enquiry-form-clears-on-500
chore/bump-next-15.5
```

Not `feature/abhishek`, not `feature/work`, not `test2`. One branch per change, not one
branch per person — a long-lived personal branch is the thing that turns into a
three-day merge.

---

## 2. One-time setup, on each person's machine

```bash
git clone https://github.com/MingmaG/lotus_peak.git
cd lotus_peak

# Who you are — this goes into every commit, so get it right once.
git config user.name  "Your Name"
git config user.email "you@example.com"

# The commit template (types and scopes live in .gitmessage).
git config commit.template .gitmessage

# Pull by rebasing, never by making a merge bubble. This is the single most
# important setting here: it is what keeps develop's history readable and
# stops "Merge branch 'develop' of github.com..." commits appearing forty times.
git config pull.rebase true
git config rebase.autoStash true

# Remember how you resolved a conflict, and resolve it the same way next time.
# It pays for itself the second time you rebase a long-lived branch.
git config rerere.enabled true

# Push creates the upstream branch without --set-upstream, and pushes only the
# branch you are on.
git config push.default simple
git config push.autoSetupRemote true

# Delete local copies of branches that were deleted on GitHub, on every fetch.
git config fetch.prune true
```

Then the project itself — see `README.md` for the full version:

```bash
npm install
cp apps/admin/.env.example apps/admin/.env   # then fill in the secrets
cp apps/web/.env.example   apps/web/.env
npm run db:up && npm run db:deploy && npm run db:seed
npm run dev
```

`.env` files are not in git and never will be. Secrets are shared between the three of
you out of band, once, not committed "just for now".

---

## 3. The daily loop

### Start of the day — get the latest code

```bash
git checkout develop
git pull                 # rebases, because of pull.rebase=true
```

Then, **before you start typing**, look at what arrived:

```bash
git log --oneline -15
git diff --stat HEAD@{1} HEAD    # what actually changed in that pull
```

and react to it:

| If the pull touched | Run |
| --- | --- |
| `package-lock.json` or any `package.json` | `npm install` |
| `apps/admin/prisma/migrations/` | `npm run db:deploy` |
| `apps/admin/prisma/schema.prisma` | `npm run db:generate` |
| `packages/api-contracts/` | `rm -rf apps/web/.next/cache` — see `CLAUDE.md` §7 |

Skipping that table is how you spend an hour debugging a bug that is actually a stale
node_modules or yesterday's cached API payload.

### Start a change

```bash
git checkout develop
git pull
git checkout -b feature/journey-gallery-lightbox
```

Always branch from a freshly pulled `develop`. Branching from a stale `develop`, or from
another feature branch, is how you end up rebasing someone else's commits.

### While you work

Commit small and often. A commit is one idea, and its message explains *why* —
`.gitmessage` has the types and scopes:

```bash
git add -p                     # stage deliberately, read your own diff
git commit                     # the template opens; write the why
```

Push at least once a day, even mid-feature. Work that exists only on your laptop is work
nobody can see, review, or recover:

```bash
git push
```

### Stay close to develop while you work

Once a day, and always before you open a pull request, replay your work on top of the
latest `develop`:

```bash
git fetch origin
git rebase origin/develop
```

A one-day-old branch rebases in silence. A ten-day-old branch is a negotiation. This
single habit prevents more merge pain than everything else on this page.

If you have already pushed the branch, the rebase rewrote its commits, so the push needs
to say so:

```bash
git push --force-with-lease
```

`--force-with-lease`, never bare `--force`. It refuses if someone else pushed to your
branch in the meantime, which is exactly the accident you want refused.

### Before you open the pull request

```bash
npm run typecheck && npm run lint
npm run build:web        # read the route table: every route must be ○ or ●, never ƒ
```

and open the thing in a browser if it has a form in it. `CLAUDE.md` §6 is not decoration
— the build succeeds with a missing paragraph and `undefined` where a price was.

### Open the pull request

```bash
gh pr create --base develop --fill
# or push and use the link GitHub prints
```

**The base branch is `develop`, never `main`.** GitHub defaults to the repository's
default branch, so check that field every single time.

The PR description says what changed and why, and names anything the other person needs
to do after merging — a new migration, a new environment variable, a contract change.

### Review and merge

- Every PR gets one reviewer: the other developer. Reviewing the web person's work does
  not require being the web person; you are looking for "will this break my half", and
  for the rules in `CLAUDE.md` §1 (hardcoded content, a database import in `apps/web`,
  a route gone `ƒ`).
- A PR that only touches your own app and is under ~200 lines can be approved quickly.
  A PR touching `packages/*` or `prisma/` gets read properly by both of you.
- Merge with **Rebase and merge** so `develop` keeps a linear, readable history and your
  carefully written commit messages survive. Use **Squash and merge** if the branch is
  full of `wip` and `fix typo` commits.
- Delete the branch on merge. GitHub offers the button; take it.
- The author merges their own PR after approval, and tells the other person in chat if
  it contains a migration, a contract change or a dependency bump.

### After the merge

```bash
git checkout develop
git pull
git branch -d feature/journey-gallery-lightbox
```

---

## 4. The overlap: how the two of you avoid colliding

Most conflicts are avoidable by *when* you change a file, not *how*.

**Shared ground is `packages/api-contracts`, `apps/admin/prisma/`, the root
`package.json` and `package-lock.json`.** A change to any of those:

1. goes in its own small PR, by itself,
2. gets merged into `develop` first, before the work that depends on it,
3. and gets announced — one message, "contracts changed, pull develop".

The person who then builds against it branches from the `develop` that already has it.
This is what stops the two of you writing the same field in two different shapes; the
whole point of `packages/api-contracts` is that both sides fail to compile when they
disagree, and that only works if you are both compiling against the same version of it.

**Never edit the other person's app without telling them.** The admin developer wiring
the site to the panel will touch `apps/web` — that is expected. Say so in the PR title
(`feat(web): read journeys from the panel`) so the web developer knows to look.

**Nobody edits an already-pushed Prisma migration.** A migration that is on `develop`
has run on someone else's database. Correcting it means a new migration.

**Two migrations created on the same day will not conflict as text, but they will
conflict in order.** Prisma names them by timestamp; if you both add one and yours
merges second, run `npm run db:deploy` and confirm it applies cleanly on a fresh
database (`npm run db:reset`) before you merge.

---

## 5. When a conflict happens anyway

A conflict is not an error. It is git saying "two people changed the same lines, you
decide". The general shape, mid-rebase:

```bash
git status                  # git lists exactly which files are conflicted
# edit the files, removing the <<<<<<< ======= >>>>>>> markers
git add <file>
git rebase --continue
```

and if it goes wrong at any point:

```bash
git rebase --abort          # you are exactly back where you started. Nothing is lost.
```

### `package-lock.json`

Never hand-merge it. Take the incoming one and regenerate:

```bash
# during a rebase onto develop, "ours" is develop's version:
git checkout --ours package-lock.json
npm install
git add package-lock.json
git rebase --continue
```

(During a `merge` rather than a rebase, the sides are reversed — `--theirs` is the branch
being merged in. If you are ever unsure, `git checkout origin/develop -- package-lock.json`
then `npm install` is unambiguous and always right.)

### `apps/admin/prisma/schema.prisma`

Resolve it by hand — usually both of your model changes belong, one after the other.
Then check the generated client still matches and that the migrations still apply:

```bash
npm run db:generate
npm run db:reset            # scratch database, applies every migration from zero
```

If your change had a migration and you had to alter the schema while resolving, delete
your not-yet-merged migration folder and generate it again with `npm run db:migrate`.
Only ever do that to a migration that has not been pushed.

### `apps/admin/prisma/migrations/migration_lock.toml`

Take either side; the contents are identical.

### `packages/api-contracts`

Stop and talk to the other person. Do not resolve a contract conflict by guessing which
shape is right — the whole boundary depends on both sides agreeing, and a plausible
wrong guess compiles.

### Generated or ignored files

`.next/`, `node_modules/`, `out/`, `.env`, `storage/`, `.DS_Store` are all in
`.gitignore` and should never appear in a conflict. If one does, someone committed it by
mistake: remove it from the index (`git rm --cached <file>`) and say so.

---

## 6. Releasing to production

`main` is what the server runs. It moves only on purpose.

```bash
git checkout develop
git pull
npm run typecheck && npm run lint && npm run build     # both apps must build
gh pr create --base main --head develop --title "release: <what is in it>"
```

Both developers look at that PR — it is the last point at which production is still the
old code. After it merges:

```bash
git checkout main
git pull
git tag -a v1.2.0 -m "Bookings, payments and coupons"
git push --tags
```

then deploy per `deploy/`. The tag is what you roll back to.

**`main` currently holds only the initial commit** — the 40 commits of real work live on
`develop`. The first release will therefore be a large one; do it when the server is
genuinely ready for it, and pin a tag on it.

### Hotfixes

Production is broken and `develop` has half-finished work in it, so you cannot ship
`develop`:

```bash
git checkout main
git pull
git checkout -b hotfix/enquiry-500
# fix, commit
gh pr create --base main --fill
```

After it merges into `main`, **merge `main` back into `develop` immediately**, or the
next release quietly reverts the fix:

```bash
git checkout develop
git pull
git merge origin/main
git push
```

This is the one place a merge commit is correct rather than a rebase: it records that
`develop` now contains the hotfix.

---

## 7. Rules, in one list

1. Never commit directly to `main`. Never commit directly to `develop` — go through a PR.
2. Never `git push --force` to `main` or `develop`. On your own branch, use
   `--force-with-lease`.
3. Branch from a freshly pulled `develop`, every time.
4. Rebase onto `origin/develop` at least once a day, and always before opening a PR.
5. One change per branch, and merge it within a few days. Long branches are the disease;
   everything else here is a symptom.
6. `npm run typecheck && npm run lint && npm run build:web` before you ask for review.
7. After every pull, run the table in §3 — `npm install`, `db:deploy`, clear the web
   cache — according to what actually changed.
8. A change to `packages/*` or `prisma/` is its own PR, merged first, announced.
9. Push every day, even unfinished. Local-only work is invisible and unrecoverable.
10. Never commit `.env`, `node_modules/`, `.next/` or anything else in `.gitignore`.

---

## 8. Getting out of trouble

Nothing in git is lost for thirty days. `git reflog` is the undo history of everything
your repository has done.

**I committed on `develop` by accident (not yet pushed).** Move the commits to a branch:

```bash
git branch feature/what-it-was      # keep the work
git reset --hard origin/develop     # put develop back
git checkout feature/what-it-was
```

**I need to undo my last commit but keep the changes.**

```bash
git reset --soft HEAD~1
```

**My working tree is a mess and I want the last commit back.**

```bash
git stash              # keep it, just in case
git checkout -- .      # or: git reset --hard HEAD
```

**My rebase went wrong.** `git rebase --abort`. If you already finished it:

```bash
git reflog             # find the hash from before the rebase
git reset --hard <hash>
```

**Someone else's commit broke `develop`.** Do not fix it silently on your branch. Say so,
and either they push a fix or you revert their merge:

```bash
git revert -m 1 <merge-commit>
```

**I pushed something secret.** Tell the other two immediately, rotate the secret, *then*
worry about the history. A rotated secret in an old commit is harmless; an un-rotated one
removed from history is not, because it was already cloned.

---

## 9. Settings the repository owner should switch on

On GitHub, `MingmaG/lotus_peak` → Settings:

- **Set the default branch to `develop`.** New PRs then default to the right base, and a
  clone lands on the working branch.
- **Branches → add a ruleset for `main`:** require a pull request, require one approval,
  block force pushes, block deletions.
- **The same for `develop`,** with one approval.
- **General → Pull Requests:** allow rebase merging and squash merging, disallow plain
  merge commits, and tick "Automatically delete head branches".

Until branch protection is on, rule 1 above is honour-system. Turn it on.
