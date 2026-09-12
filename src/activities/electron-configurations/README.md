# Electron configurations: three-level mastery

This is the pupil-facing three-level route for the OCR A Level electron-configuration activity. It uses `index.html`, `levels.js` and `levels-app.js` with the checked `data.js`, `core.js` and existing stylesheet. The legacy `sjs-electron-configurations-v1` session remains untouched and is never read by this route.

The URL contract is:

- `?leaf=l6-t2-1-2&practice=mastery`
- `?leaf=l6-t2-1-2&practice=level&level=1`
- `?leaf=l6-t2-1-2&practice=level&level=2`
- `?leaf=l6-t2-1-2&practice=level&level=3`

Level 1 schedules main-group atoms with full notation and orbital boxes (`full`, `row`, `energy`). Level 2 schedules main-group atoms and ions with all four representations. Level 3 is cumulative and uses the deterministic group-kind cycle `matching`, `d-atoms`, `d-ions`, `main-atoms`, `main-ions`; nonmatching questions balance build and identify directions and select eligible representations. Matching is assessed and cannot be skipped.

Each electron-configuration level uses a question-recency half-life of 3 and a mastery threshold strictly above 0.8. From zero evidence, six correct first attempts give 0.75 and seven give approximately 0.802. Existing evidence is retained and reweighted; this is weighted mastery, not a strict consecutive-answer counter.

Sessions are open-ended. An invalid entry is retained in the in-tab session and receives no result. The first accepted submission for a question records 1 or 0 through `ALevelMastery.record` using the question's unique attempt ID; reviewing a question records no evidence. The attempt ID is saved before marking so a reload cannot create a duplicate first result. Fixed level practice keeps generating questions on its selected level. MASTERY asks `ALevelMastery.nextLevel` at each Next action, advances to the lowest unmet level, and finishes only when the common API reports all three levels mastered.

The runtime uses `ElectronCore.mark`, preserving the existing checked answers, chemical feedback, `EC` question IDs and `ECB` matching IDs, periodic-table reference and orbital keyboard controls. The unchanged legacy `session.js` is loaded only to decode old `ECB` review IDs; no legacy session save is read or written. The common `alevel-mastery.js` and `alevel-mastery.css` assets are owned by this app under `assets/`.

## Content and marking conventions

There are **71 checked entries**: all 36 neutral atoms H–Kr, 17 main-group ions and 18 d-block ions. `data.js` contains the complete explicit configurations and charge list. It stores neutral chromium as [Ar] 3d⁵ 4s¹, copper as [Ar] 3d¹⁰ 4s¹, and nickel as the A-level/NIST ground-state entry [Ar] 3d⁸ 4s². Ions are separate records; they are not obtained by treating an ion as the neutral atom with the same electron count.

The selected ion bank is:

- Li⁺, Be²⁺, N³⁻, O²⁻, F⁻, Na⁺, Mg²⁺, Al³⁺, P³⁻, S²⁻, Cl⁻, K⁺, Ca²⁺, Ga³⁺, As³⁻, Se²⁻, Br⁻.
- Sc³⁺, Ti²⁺, Ti³⁺, Ti⁴⁺, V²⁺, V³⁺, Cr²⁺, Cr³⁺, Mn²⁺, Mn³⁺, Fe²⁺, Fe³⁺, Co²⁺, Co³⁺, Ni²⁺, Cu⁺, Cu²⁺, Zn²⁺.

These are isolated-species electron-count exercises, not claims that every ion is stable in water. Polyatomic ions and complexes are outside scope. There is no ligand-field splitting or high-/low-spin complex modelling. RDKit and PubChem are not needed for atomic orbital occupancy data.

- **Full notation:** fields identify subshells, so students supply electron counts rather than a string requiring typographical syntax. Blank and zero both mean unoccupied.
- **Abbreviation:** any fully contained, complete noble-gas core is accepted. The worked answer uses the largest valid core. Neutral noble gases must use a preceding noble gas (Ne → [He] 2s² 2p⁶; Kr → [Ar] 3d¹⁰ 4s² 4p⁶). An ion may consist of the core alone (Br⁻ → [Kr]). H and He atoms are excluded from abbreviated questions.
- **Boxes:** clicking or pressing Space cycles empty, one spin-up electron, an opposite-spin pair, then empty. Keys 1, 2 and 0 set one spin-up electron, a pair or an empty box respectively; U/D/P shortcuts are removed. Existing saved spin-down states remain readable and advance to a pair on the next click. Marking checks electron totals, subshell occupancies, singly occupied orbitals before pairing, and parallel unpaired spins. Permutations of equivalent orbitals and either overall spin direction are accepted.
- **Identity:** accepts names or symbols, ignoring case and surrounding whitespace. Aluminium/aluminum and sulfur/sulphur are accepted. Ionic charge is supplied; atomic number is not revealed in the identification prompt. Answers ask for the element, so names such as “chlorine” rather than “chloride” are expected.
- **Checked answers:** become available after submission, showing the identity, electron arithmetic, explanatory points and all applicable representations. There is no inference from the student's wrong answer when generating the teacher answer.

## Orbital energy diagrams

Horizontal boxes use principal-shell notation order (…3p, 3d, 4s, 4p); this is not labelled as an energy order. Both common written orders for 3d/4s express the same occupancy. Structured input avoids marking an order preference as a chemical error.

Energy diagrams use the schematic Aufbau filling ladder, placing 4s below 3d for every atom and ion. This is a consistent teaching layout, not a species-specific orbital-energy model or numerical energy scale. Ground-state occupancies are checked independently, including the Cr/Cu exceptions and removal of 4s electrons before 3d when forming transition-metal ions. Every species shows the complete ladder from 1s to 4p, including empty subshells, in construction questions, identification questions and checked answers. All five d orbitals have equal height.

The s, p and d subshells occupy separate horizontal columns with 36px gaps. Quarter-height steps allow boxes in different columns to overlap vertically. Both s and p columns have evenly spaced levels; 3d sits halfway between 4s and 4p. Levels in the same column retain enough separation for their boxes and focus outlines. The full eight-level diagram is 256.5px high (previously 456px); checked-answer diagrams use proportionally smaller spacing. Narrow screens scroll horizontally rather than shrinking the orbital boxes.

The MIT lecture linked below provides background on the distinction between filling order and species-dependent orbital energies. The activity's teacher notes state the filling-ladder convention explicitly. Abbreviation and isoelectronic matching are teaching formats, not assertions that OCR accepts shorthand in every exam response.

In energy diagrams, Tab starts at 1s and follows the displayed ladder, moving left to right through the boxes within each subshell and visiting 4s before 3d. Shift+Tab reverses this sequence; the separate s/p/d columns do not determine keyboard order.

## Periodic-table reference

The header opens the shared OCR-style periodic table using a miniature table icon.
It includes the supplied OCR 2020 data sheet's 114 named elements, atomic numbers,
names, relative atomic masses, group numbers and separated lanthanoid/actinoid
rows. Values and blank entries follow that edition. Question-bank coverage is
still H-Kr. The shared component and regeneration instructions are documented in
`development/shared/design/periodic-table.md` at the workspace root.

## Curriculum and provenance

Access date: **4 September 2026**.

| Reference | Use |
| --- | --- |
| [OCR H432 specification](https://www.ocr.org.uk/Images/171720-specification-accredited-a-level-gce-chemistry-a-h432.pdf), 2.2.1(b–d) | Orbital capacities/spins, filling, box representations, atoms through Z = 36 and s-/p-block ions. |
| Same specification, 5.3.1(a), with 5.3.1(b) for terminology | Period-four d-block atoms and ions, given atomic number and charge; distinction between d-block and transition elements. |
| [OCR June 2023 H432/01 mark scheme, question 22(a)](https://www.ocr.org.uk/Images/704036-mark-scheme-periodic-table-elements-and-physical-chemistry.pdf) | Independent OCR examples for Fe²⁺, Sc³⁺ and Zn²⁺ and the distinction between d-block and transition elements. |
| [NIST atomic reference configurations](https://www.nist.gov/pml/atomic-reference-data-electronic-structure-calculations/atomic-reference-data-electronic-8) | Neutral ground-state configurations and named exceptions. |
| [MIT 5.112, lecture 9 transcript](https://ocw.mit.edu/courses/5-112-principles-of-chemical-science-fall-2005/84c77b5139905b7b8156288d0dd31219_KUVB9S0QX-I.pdf) | 3d/4s energy crossover from Sc, distinction between orbital and total energy, alternative notation order. |

Version note: the retrieved OCR search extract for 5.3.1 identifies **version 3.0 (2025)**. The electron-structure extract retrieved from OCR's lowercase `/images/` URL identifies **version 2.9 (2025)**. The full PDF exceeded the browsing tool's size limit, so this is a targeted curriculum check using official indexed extracts and an official mark scheme, not an audit of every page of the latest PDF. The source metadata preserves that distinction.

The resource contains original question generation, explanations and layout; no exam questions or document pages are reproduced. Atomic occupancy facts are transcribed with provenance. Comfortaa Bold is the existing SIL Open Font License master (`development/shared/fonts/OFL-Comfortaa.txt` at the workspace root). The eagle is the repository's existing school branding. The arrow glyphs use system symbol fonts for legibility.


## Validation

From the containing chemistry workspace, run `node scripts/test_electron_configurations.js`, `node scripts/test_electron_levels.js` and `node scripts/review_alevel_mastery.js`. Browser review uses the pinned workspace Playwright dependency and installed Edge. These checks cover the canonical bank, level restrictions, marking, saved sessions, first-attempt scoring, automatic progression and responsive rendering. Build the app with its independent `scripts/release.js`; no portable activity is generated.
