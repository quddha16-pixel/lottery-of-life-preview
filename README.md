# Lottery of Life — DEVELOPMENT preview

This repository publishes only the free GitHub Pages preview. The game source stays in [quddha16-pixel/lottery-of-life](https://github.com/quddha16-pixel/lottery-of-life) on its existing development branches. No game code is merged into the production main branch.

Selected game commit: **ebff78983faa8e134fca900d93392b8ce922c3bc**. It includes all four Phase 3C milestones and the Phase 1/2/3/3B history.

Expected preview location: https://quddha16-pixel.github.io/lottery-of-life-preview/ — this is not a verified live URL until the publishing/verification workflow succeeds and browser play is checked.

## One-time setup

In this preview repository only, open Settings → Pages → Build and deployment → Source → **GitHub Actions**. No external hosting, account, API token, deployment secret, paid runner or custom domain is required. The original repository's production Pages workflow stays disabled.

The workflow runs on a push to this preview repository's main branch or a manual Actions dispatch. This main branch contains publishing tools, not the game's development history. Publishing tools check out the exact game SHA in `preview.json`, run its unit/lint/type/build/browser checks, build the preview and test the actual preview bundle before deploying.

## Save and asset isolation

GitHub Pages project sites on one account share an origin. The preview therefore uses `/lottery-of-life-preview/` for assets and `lottery-of-life-preview.save.v1` / `.backup` for browser saves. The production keys are neither loaded nor overwritten. The build adapter transforms only the save-key declaration in memory; source files and historical commits remain untouched. This hosting configuration is separately recorded from the exact game source SHA.

The DEVELOPMENT banner shows the full game SHA. `build-info.json` records the source/hosting identity and `preview-manifest.json` hashes every public app file. The workflow checks actual HTTPS bytes after publication. The targeted browser check also proves that invalid production-save sentinels cannot affect the preview, production keys are untouched after actions/reload, and assets never load from the production game path.

## Review standard

Implemented means the code/package passes its checks. Playable requires Quentin's personal iPhone review of the verified exact preview. Released requires separate approval and a verified production update. This preview does not release the game to production.

Future source changes require an explicitly selected/reviewed full SHA in `preview.json`; there is no automatic following of a moving game branch. Keep every historical game branch and commit.
