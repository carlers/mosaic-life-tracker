# Session checkpoint

Updated: 2026-10-10
Current task: integrate user-approved #417 Settings cleanup with already promoted #402 sorting in dev.
Baseline dev: `6e8a65d32a458734441d33df5b11bf06e0f8f6f1`, v0.9.0, [dev promotion 37962105759](https://github.com/carlers/mosaic-life-tracker/actions/runs/37962105759) SUCCESS.
Task branch: `chatgpt/settings-clarity-integration`.
Stable Preview target: `feature/settings-clarity-integrated`.
Candidate version: **0.10.1** (existing separately accepted v0.10.0 Preview cannot be merged unchanged over already-promoted v0.9.0 because its independent tree lacks #402). Exact new combined tree requires new full canonical+Vercel acceptance.

## Approved behavior

- Keep #402 synced completion status sorting, unrestricted within/cross-category dragging, canonical/manual order safety and clipboard output unchanged.
- Bring in #417 accepted SettingsPage and behavioral DOM regressions from Preview `5637241d33d91874460477d47801e8ae76913d9b`: clear account/upcoming/data/about/deletion headings, future-only labels, icons, backup activity placement, preserved app routes/actions/version disclosure/destructive confirmations.
- Preserve higher #402 size budget ceilings (appAssetsRaw 2300600, gzip 707900, precacheUnique 2383100); do not replace with lower independent #417 budgets.
- Merge both PROJECT_REFERENCE feature contract sections and include version in three files. Frontend-only, no new backend project, schema or Appwrite change.
- The preexisting separate #410/#416 navigation/trackpad v0.8.0 Preview is **not** to enter dev yet. Following these promotions, investigate and polish animated browser Back/Escape/Android Back and trackpad gesture continuity and calendar integration in a newly versioned independent Preview.

## Next action

Commit coherent combination on task branch with focused verification; squash into dedicated integration Preview after focused-green; verify exact Preview SHA canonical and Vercel READY, then promote this accepted combined Preview to dev under explicit approval. Main stays unchanged. Device checks are user-approved for #402/#417 (do not claim personally performed); navigation device acceptance remains required.
