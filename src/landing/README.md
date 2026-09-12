# OCR A Level homepage

Physical and Organic panes show the selected teaching year. The Lower Sixth / Upper Sixth switch remembers the year under `masters-alevel-year-v1`; explicit gem/topic hashes override that preference. Both panes flip horizontally. Inactive faces are inert; reduced motion skips rotation. Narrow screens stack the panes. Topic sections retain compact gem rows and expand into named gems.

The source hierarchy has 31 topics and 154 stable gem IDs; 153 gems are shown. The U6 Electron Configurations gem is temporarily hidden and its old hash redirects to the L6 gem. Neighbouring IDs are unchanged.

The generated catalogue reads these workspace inputs:

- `resources/curriculum/ocr-a-level/a-level-mastery-branches.md`
- `development/alevel/data/alevel-activity-links.json`
- `development/alevel/data/alevel-display-settings.json`

Edit those inputs and run `node scripts/generate_alevel_catalog.js` from the workspace root. For unpublished changes, generate into an external draft and use `scripts/preview_draft.js`; verify source baselines before promotion.

## Mastery

Seven gems offer MASTERY and Levels 1-3: electron configurations and six U6 acid/base calculation gems. They use app-owned `assets/alevel-mastery.js` and `.css`. Each gem and level has independent first-attempt evidence. Fixed-level practice stays at that level; MASTERY selects the first level below threshold.

The score matches the current IGCSE calculation runtime:

```text
decay = 2 ** (-1 / 2)
score = previous_score * decay + question_score * (1 - decay)
initial_score = 0
mastered = score > 0.8
```

No evidence is unassessed. Five consecutive correct answers from zero exceed the threshold. Electron questions are binary. Acid/base questions score 1 when all required parts are correct, 0.5 when some are correct, and 0 otherwise. Incomplete submissions do not count. Corrections/rechecks cannot replace the first completed result. Question-review mode never awards mastery.

Yellow requires Level 1; green requires Levels 1 and 2; purple requires all three. Later weak results can reduce an award. Calendar age affects freshness styling, not the mastery calculation.

Results use `masters-alevel-results-v1` with `{id, leafId, level, score, completedAt}`. Validation, stable ordering and ID deduplication occur on read/write. Failed writes retain evidence in the current tab. Different browsers/site origins have separate histories. Legacy `sjs-electron-configurations-v1` records remain intact but are not converted: aggregate streaks cannot reconstruct first-attempt history. The old `landing/progress.js` adapter is source-only, not loaded or published.

Launch URLs use `?leaf=<gem>&practice=mastery` or `?leaf=<gem>&practice=level&level=1|2|3`. There is no IGCSE runtime dependency.

## Release boundaries

Learning mode / Flashcards and the full Molecule Builder are hidden and excluded from release selection. The Molecule Builder curriculum gem remains unlinked. Unavailable gems do not display invented progress. Calculation mastery does not certify practical methods or theoretical outcomes outside the numerical bank.

The specification map records OCR H432 v3.1 (May 2026). Its curriculum coverage is unchanged by the temporary display exclusion. Run the workspace catalogue/mastery/activity tests and homepage browser review, followed by the app release build/check. The manual Pages workflow publishes only `dist/` when separately authorised; ordinary pushes do not deploy.
