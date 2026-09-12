# Molecule

Open **index.html** in Edge or Chrome, or follow the link from the OCR A Level homepage. This is the maintained website activity. Portable single-file exports are created only when explicitly requested.

`index.html` runs the same activity from editable source files and is linked from the OCR A Level homepage (`../../Masters of A Level Chemistry.html`).

## Styling

Both Molecules and Mechanisms use the full available screen width, with narrower margins on small screens. Matches the SJS mastery activities: navy gradient panels, mint/cyan controls, Comfortaa Bold and the shared SJS eagle. Live bonds and carbon labels are light for dark-background contrast. The unchanged black Notes teacher diagrams sit on white cards. An explicitly requested portable build embeds the eagle alongside its other assets.

## Drawing

Choose C, O, N, Cl, F or H, tap to place an atom, and drag from an atom to extend it. Dragging from empty space places the starting atom and its first bond in one edit (carbon with a single bond creates ethane). Carbon chain (3) draws a zigzag chain of single-bonded carbons from empty space or an existing atom. Drag distance controls length; pulling back shortens the preview. Chains stop before occupied space or the twenty-atom limit. Release commits the whole gesture as one undoable edit; Escape, pointer cancellation or release outside the canvas discards it. Clicking Chain again, pressing 3 again, or selecting an element exits chain mode. New atoms have a consistent bond length and snap to 30-degree increments. Drag onto an existing atom to close a ring or connect fragments; a highlighted endpoint previews the connection. Closure preserves the target element, works at the twenty-atom limit and does not create duplicate bonds. Tap an existing atom to apply the selected element. Each bond tap cycles single → double → triple → single. New bonds are single. Erase removes an atom and its attached bonds, or one bond. Undo reverses a completed edit, including closure and Clear, with up to 100 snapshots. Next question starts a fresh drawing.

The representation switch changes labels without changing the molecular graph. Skeletal view always omits connected carbon labels and carbon-bound hydrogens, including on charged atoms, atoms with lone pairs or dipoles, and invalid drafts. Isolated atoms remain visible. Structural view labels carbon atoms and shows hydrogen counts. Labels may read CH3 or H3C depending on the direction of neighbouring bonds. The live editor uses Comfortaa Bold with high-contrast coral oxygen, blue nitrogen and green halogen labels on a dark drawing surface; teacher-answer diagrams use the standard all-black Notes presets.

Keyboard controls are documented in the page's expandable Drawing help. C/O/N/F select those elements; L selects chlorine; 1/2 set new bonds; E selects Erase. Tab reaches the canvas, bonds and atoms. Enter on the canvas places an initial atom; arrows on a focused atom preview a new bond; Enter commits it, including closure onto an existing atom; Escape cancels. Enter on a focused atom applies the selected element; Enter on a bond toggles its order. Delete erases and Ctrl+Z undoes.

## Clean up

The toolbar's Clean up button changes coordinates only and is disabled until there are at least two atoms. It creates one undoable edit. Repeating cleanup on an unchanged graph is a no-op. Atom IDs, elements, bond endpoints and bond orders are preserved, including excessive-valence mistakes and disconnected fragments.

`layout.js` implements a deterministic, offline editor layout. Uncrowded trees use 74-unit bonds and zigzag chains; single rings use regular polygons with outward branches. Disconnected components are spaced apart. Crowded branches and multiple-ring components use a bounded spring/repulsion fallback. These fallback layouts are approximate: they do not guarantee equal bond lengths, crossing-free bonds or collision-free labels. This is a 2D drawing aid, not a prediction of molecular geometry or a chemical correction. RDKit remains the source of the published teacher-answer SVGs.

Checks cover topology preservation and repeatability across the RDKit fixtures, the lengths and angles of a 20-carbon chain, regular ring lengths and initially overlapping atoms. Browser checks cover the button, branching, rings, disabled state and exact Undo restoration; the rendered branch and ring examples have been visually inspected.

## Molecule mode: teaching and marking

Audience: OCR A Level Chemistry A pupils beginning organic representation, or revisiting simple compounds after learning carbonyl and carboxyl groups. Prerequisites: carbon valence four, oxygen valence two, single/double bonds, implicit hydrogens, and the functional groups in the five named compounds.

Objectives: construct the connectivity of a named simple molecule; interpret the same connectivity in skeletal and structural representations; diagnose excessive bonding after submission.

The five prompts are ethane, ethene, ethanol, ethanal and ethanoic acid. Each has an independently checked molecular formula, reference graph, SMILES input, canonical SMILES, accessible textual explanation and two RDKit-generated teacher diagrams. Questions are original; no exam questions are reproduced.

Curriculum reference: [official OCR H432 specification](https://www.ocr.org.uk/images/171720-specification-accredited-a-level-gce-chemistry-a-h432.pdf), **4.1.1(a)** nomenclature and **4.1.1(b)** structural/displayed/skeletal representation. The official indexed extract consulted on **5 September 2026** identifies **version 2.9 (2025)**. This records the extract used; it is not a whole-specification audit or a claim to have retrieved the latest complete PDF. The prototype covers only a small part of those outcomes.

In Molecules mode, the introductory bank uses a neutral molecule using C, O, N, Cl, F and H, with single, double or triple bonds, rings and at most twenty non-hydrogen atoms. Hydrogens fill ordinary valences automatically: C 4, N 3, O 2, Cl/F 1. Excessive bonding is permitted during editing: the offending atom has no inferred hydrogen label, the current formula representation is preserved, and Check highlights it with element-specific feedback. No automatic formal charge or bond correction occurs. This convention excludes charged species, radicals, hypervalent nitrogen/chlorine, isotopes and stereochemistry. The H tool (keyboard H) adds explicit hydrogen atoms; answer checking treats attached neutral H atoms as equivalent to implied hydrogens. The original five questions remain the introductory bank; the wider drawing tools can also be explored on their canvases.

Checking first handles empty answers, excessive bonding and disconnected fragments. Valid structures are compared by exact labelled-graph isomorphism, including cycles, all elements and literal bond orders. Candidate pruning uses element and local bond counts, then backtracking checks every edge and non-edge. Coordinates, atom IDs, insertion order and drawing direction do not affect the result. Different structures with the same formula are rejected. Aromatic/resonance forms are not normalised; the five current answers do not require this. The original molecule checker is separate from the mechanism marker described below. Neither assesses drawn bond angles or stereochemistry. Show answer becomes available after Check; the pupil can continue editing without a score penalty.

## Mechanism mode

Select **Mechanisms · 5 questions** above the exercise. It opens in structural view and adds formal charges, dipoles, lone pairs and anchored curly arrows. Draw every reactant, intermediate and product stage, then choose **Check whole mechanism**. Drafts and Undo histories are separate for each stage and question; they remain in memory until reload. The two activity modes retain separate drawings.

The five original questions cover chloroethane hydrolysis, cyanide substitution, HCl addition to ethene and propene, and ethanal reduction by NaBH4 followed by protonation from water. There are 13 stages in total. See [MECHANISMS.md](MECHANISMS.md) for the specification references, teacher answers, marking rules, accepted alternatives, limitations and validation commands.

The mechanism references were checked against the official **H432 specification version 3.1**, downloaded and read on **6 September 2026**. The older version-2.9 citation above records the original molecule prototype's source, not the current mechanism source. The PDF hash and verified topic locations are recorded in `development/alevel/validation/molecule-builder/mechanism-specification-provenance.json`.

## Sources and generation

- `questions.json`: original question content, reference SMILES, expected formulae and descriptions.
- `core.js`: pure graph editing, bounded validation and exact graph matching; supports CommonJS for tests.
- `app.js`, `styles.css`, `index.html`: interaction and presentation. Native SVG is the live editable surface, not a saved replacement for RDKit molecule assets.
- `mechanism-data.js`: generated mechanism bank; source is `scripts/generate_mechanism_builder.py`.
- `mechanism-core.js`, `mechanism-ui.js`: electron-state marking and mechanism interaction.
- `data.js`: generated bank and embedded teacher diagrams; do not edit directly.
- `molecule.html`: optional portable export, absent by default; generate only on explicit request and do not edit directly.

The original molecule fixtures record their RDKit version in their validation report. Mechanism generation is validated with Python 3.13 and `scripts/mechanism-builder-requirements.txt` (RDKit 2026.03.5). The current working Python is available as `python`; the previous embeddable runtime path is not required. Neither runtime is used by the browser.

From the repository root in PowerShell:

```powershell
python scripts/generate_molecule_builder.py
python scripts/generate_mechanism_builder.py
node scripts/test_molecule_builder.js
node scripts/test_mechanism_builder.js
node scripts/review_molecule_builder.js
node scripts/review_mechanism_builder.js
node scripts/review_mechanism_visuals.js
```

An existing Python with the same requirements can replace the local executable. To install them, run `python -m pip install -r scripts/molecule-builder-requirements.txt` in a suitable environment.

Generation uses `scripts/render_structure_presets.py`, requesting only skeletal-notes and structural-notes for each compound. Source SVGs are stored in `development/shared/structures/molecule-builder/`. The renderer's optional `label_padding` argument applies clearance before RDKit drawing; defaults for other callers are unchanged. All diagrams use the original Comfortaa Bold font measurements and vector glyph paths. The font's SIL Open Font License is embedded in the portable file and retained at `development/shared/fonts/OFL-Comfortaa.txt`.

## Validation

The Node checks cover all five references, forty permutations of atom IDs/order and coordinate transforms, deliberate isomers, graph integrity, immutable edits, ring closure, duplicate connections, repeated bond toggling and bonding errors for the added elements. Three hundred seeded graph cases plus eighteen explicit molecule fixtures are checked with RDKit, using the stated neutral-valence restriction. 10,404 pairwise comparisons of valid cases verify exact identity, including rings. Random fixture identity retains literal single/double bonds by disabling aromaticity perception; it does not test resonance normalisation. Additional synthetic regular graphs verify that identical degree counts do not falsely imply identical cyclic connectivity; these are technical tests, not proposed teaching compounds.

The headless Edge review draws and checks all five answers using real browser mouse events, tests tablet-emulated touch events, keyboard input, changes to elements and bonds, repeated toggling, erasure, Clear/Undo, cancelled touch gestures, valence feedback and responsive layouts. Rings close through mouse, touch and keyboard. A ring containing N with Cl/F substituents is built through the controls and compared with an independently validated RDKit reference. Every toolbar button stays visible at all tested widths. Reviews use `index.html` by default. With `--portable`, the review also opens a copied portable file away from its source assets and verifies zero external requests. Launching the browser may require sandbox approval. `MOLECULE_REVIEW_BROWSER` can override the Edge executable path.

Screenshots and machine-readable reports are in `.scratch/molecule-builder/`. Every teacher preset and the rendered editor have been visually inspected. Touch is tested through Edge emulation: a physical tablet and Safari have not been tested. A short classroom trial on the intended tablets remains useful before wider use.

Only when a portable version is explicitly requested, run `node scripts/build_molecule_builder.js --portable`. Add `--portable` to the browser review commands to check that export. Normal builds and reviews do not create or require it.

## Embedding interface

`window.MoleculeBuilder` exposes `getGraph()`, `setGraph(graph)`, `clear()` and `onChange(callback)`. Graphs contain `atoms: [{id, element, x, y}]` and `bonds: [{a, b, order}]`; IDs are unique integers and coordinates are finite numbers. Getters and notifications return independent copies. `setGraph` rejects unsupported topology but permits excessive valence so mistakes remain editable. Subscribing returns an unsubscribe function. Clear and setGraph are undoable; changing question resets undo history. There is no persistence or server API.

## Development workspace

Paths to `scripts/`, `development/alevel/validation/`, `development/tests/`, `apps/Masters-of-A-Level-Chemistry/src/assets/` and `development/shared/structures/` refer to the local OneDrive development project, not the website-only GitHub repository. Retained review records are in `development/alevel/validation/`; fresh screenshots and browser-run JSON are regenerated into `.scratch/`. Historical screenshots were pruned on 7 September 2026; historical review statements are not a new review.
