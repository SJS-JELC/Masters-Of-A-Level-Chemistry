# Five OCR A organic mechanism questions

Select **Mechanisms** in `index.html`. Each stage starts blank. Pupils draw reactants, the intermediate where needed, and products; they add charges, relevant dipoles, electron pairs and curly arrows. **Check whole mechanism** awards practice marks across every stage and lists missed points. **Show worked mechanism** displays the complete checked diagrams and explanations.

## Curriculum and audience

Stage previews use the same viewport as the selected drawing canvas, keeping molecule size and position stable when changing stages. Clean up keeps nitrile carbons linear. Drag the belly of an existing curly arrow to adjust its curve with live feedback, including while the curly-arrow tool is selected. Its electron source and destination stay attached. No visible handles or selection boxes are added; Undo restores the previous curve.

Authority: [OCR Chemistry A H432 specification](https://www.ocr.org.uk/images/171720-specification-accredited-a-level-gce-chemistry-a-h432.pdf), **version 3.1**, read directly on **6 September 2026**. The downloaded PDF's SHA-256, page count and verified topic locations are recorded in `development/alevel/validation/molecule-builder/mechanism-specification-provenance.json`; the copyrighted PDF is not included in this repository. The older indexed version-2.9 source used for the original molecule activity has not been represented as the current specification.

Audience: Year 12 pupils who have studied electrophilic addition and haloalkane hydrolysis, and Year 13 pupils revisiting these topics alongside nitrile formation and carbonyl reduction. Prerequisites are structural/skeletal formulae, implicit hydrogen counts, bond polarity, heterolytic fission, nucleophiles and electrophiles. The last two content areas should be used after their corresponding teaching, not as assumed Year 12 knowledge.

Common objectives: draw all relevant species; assign charges and dipoles; identify the electron source and destination of each curly arrow; relate intermediate connectivity to product connectivity. Question-specific objectives are stored with the source bank.

| Question | OCR reference | Stages | Practice marks |
| --- | --- | --- | --- |
| Hydrolysis of chloroethane by hydroxide | 4.2.2(c) | Reactants → products | 9 |
| Chloroethane with cyanide | 6.2.4(b)(i) | Reactants → products | 9 |
| Ethene with hydrogen chloride | 4.1.3(h) | Reactants → carbocation → product | 11 |
| Propene with hydrogen chloride, major pathway | 4.1.3(h–i) | Reactants → secondary carbocation → product | 11 |
| Ethanal reduction by NaBH₄ | 6.1.2(c) | Carbonyl + H⁻ → alkoxide + water → products | 15 |

These are five original questions covering three mechanism types. They are not a claim to cover every OCR organic mechanism, and the 55 practice marks are not an official OCR mark scheme. Full-headed electron-pair arrows and relevant dipoles follow 4.1.1(h–i). Radical, aromatic and stereochemical mechanisms are outside this bank.

## Checked teacher answers

1. **Hydrolysis:** an oxygen electron pair from OH⁻ goes to the carbon bonded to chlorine; the C–Cl pair goes to chlorine. Reactant C is δ+ and Cl is δ−. Products: ethanol and Cl⁻. Overall charge −1.
2. **Cyanide substitution:** an electron pair from the negatively charged carbon of C≡N⁻ goes to the carbon bonded to chlorine; the C–Cl pair goes to chlorine. Products: propanenitrile and Cl⁻. Attacking through nitrogen is rejected.
3. **Ethene addition:** the C=C π pair goes to H of H–Cl; the H–Cl pair goes to Cl. H is δ+, Cl δ−. Show CH₃CH₂⁺ and Cl⁻, then an electron pair from chloride to the cationic carbon. Product: chloroethane. Either symmetry-equivalent end of ethene is accepted.
4. **Propene addition:** the alkene π pair goes to H, with H–Cl breaking towards Cl. Show the secondary CH₃CH⁺CH₃ intermediate and Cl⁻, then chloride attack at the middle carbon. Product: 2-chloropropane. The primary carbocation/1-chloropropane pathway does not answer this explicitly major-product question.
5. **Carbonyl reduction:** H⁻ donates to the carbonyl carbon while the C=O π pair moves to oxygen. Carbonyl C is δ+, O δ−. Show CH₃CH₂O⁻, add water, and draw the oxygen electron pair to H of water, with that O–H bond pair returning to water oxygen. Products: ethanol and OH⁻. The proton-transfer O–H bond is shown explicitly with its dipole. OCR permits H⁻ as the NaBH₄ nucleophile with subsequent protonation from water. This is the formal H⁻/water teaching model, not the complete reagent-level borohydride equation.

The generator checks mass and charge across every transition, including the explicitly introduced water before protonation. Sodium, potassium and boron spectator/reagent species are excluded by the question wording. Conditions are given as context; this activity is not a practical procedure.

## Editing and checking conventions

- Formal charges are 0, +1 or −1. The supported closed-shell valence table includes carbon cations/anions, oxygen ions, nitrogen ions, halide ions and H⁺/H⁻. Incorrect drafts remain editable and lose the relevant marks when checked.
- Auto hydrogens use the atom's supported charge and bonding state. Changing charge recalculates the displayed H count. Explicit H atoms are also available. Opposite formal charges cancel to neutral; opposite partial charges remove the dipole. There may be 20 non-hydrogen atoms and at most 100 atoms including explicit H.
- A displayed lone pair is a pair of dots attached to one atom. Only electron-source pairs need to be shown; extra chemically available pairs are accepted. More pairs than the closed-shell electron count allows are rejected. Negative-charge origins are accepted as alternatives to lone-pair origins.
- Arrow origins attach to an atom's displayed pair/negative charge or a bond. Destinations attach to atoms or bonds. Each stage allows up to twelve arrows. These questions expect atom destinations; unmatched arrows do not earn credit. Curve direction and geometry are not marked.
- Matching compares element-labelled connectivity, bond orders and hydrogen counts after expanding implicit H for comparison. Formal charges and relevant dipoles are marked separately. It searches symmetry-equivalent mappings, so atom IDs, insertion order, rotation and reflection do not determine correctness.
- Explicit and implicit spectator hydrogens are equivalent. Reactive hydrogens must be explicit when an arrow targets the H or its bond. Both explicit hydrogens of water are supported. Correct optional dipoles on the neutral H–O, H–Cl, C–O, C–Cl and C–N bonds in this bank are accepted; required dipoles still have to be present.
- Every stage earns a structure point, a formal-charge point only when the reference contains formal charges, one point per required arrow, a dipole point where required, and one point for absence of extra/invalid annotations. The annotation-validity point is shown in the feedback only when incorrect; incorrect points use red crosses. Unexpected charges in otherwise neutral stages are still rejected by the annotation-validity check. This last check prevents drawings containing all possible arrows from receiving full marks. All stages, including leaving ions and proton-transfer by-products, are required for full credit.
- With an element selected, drag lone pairs or arrows directly to adjust them; Alt-drag repositions atoms. Arrow keys adjust focused annotations. **Clean up** preserves chemical attachments, but crowded annotations may still need manual positioning. **Erase** or Delete removes a symbol or arrow. **Clear structure** clears the current stage. Undo is local to each stage and restores exact prior state.

Drawings and Undo histories survive switching stages, questions and activity modes during the current visit. They are not saved after reload. The tool does not simulate reactions or mark arbitrary mechanisms outside the five stated pathways.

## Sources, regeneration and validation

Source questions, mapped SMILES, arrow endpoints, dipoles, explanations and objectives: `scripts/generate_mechanism_builder.py`. It generates `mechanism-data.js` and `development/alevel/validation/molecule-builder/mechanism-validation.json`. RDKit validates every species, records formulae/canonical SMILES, produces deterministic coordinates and checks balanced transitions. Standard editable structural-notes SVGs are generated through `scripts/render_structure_presets.py` into `development/shared/structures/molecule-builder/mechanisms/`.

The standard renderer now preserves formal charges in custom labels and does not double-count explicit neighbouring H atoms. Mechanism references request its optional native heteroatom-label behaviour. Native worked-mechanism SVGs overlay the verified electron-flow model on RDKit-derived atom positions; charges, hydrogen labels and arrow attachments are inspected separately from the standard structure presets.

With Python 3.13 and the pinned versions in `scripts/mechanism-builder-requirements.txt`:

```powershell
python scripts/generate_mechanism_builder.py
node scripts/test_mechanism_builder.js
node scripts/test_molecule_builder.js
node scripts/review_mechanism_builder.js
node scripts/review_molecule_builder.js
node scripts/review_mechanism_visuals.js
```

The mechanism unit checks cover all five full mechanisms, 13 stages, 97 deliberate omissions/errors plus incorrect cyanide attack, missing products, explicit-H alternatives, symmetry and optional water dipoles. Browser checks draw all 13 stages through the real controls and mark each correct; they also test an incorrect arrow deletion, stage retention, Undo, Clear, movement, dragging arrow curves, touch arrows/cancellation, keyboard arrows, responsive widths, the source page. An offline copy is checked only with `--portable`, after an explicitly requested export using `node scripts/build_molecule_builder.js --portable`.

Reports and screenshots are in `.scratch/molecule-builder/`, including `mechanism-browser-review.json` and the two `mechanism-teacher-gallery-*.png` sheets. All 13 worked stages and all 13 RDKit presets have been visually inspected. Touch has been checked through Edge emulation; physical tablets and Safari have not been tested.

Lone pairs default to the largest angular gap between bonds, existing lone pairs, charges and dipoles. Existing pairs stay put. With Lone pair selected, drag from an atom to place a pair, or drag existing dots around the atom; the live preview also moves attached curly arrows. Placement uses a fixed distance from the atom for legibility. Escape or pointer cancellation discards the preview; Undo restores a completed drag.

Mechanisms open in skeletal view. Formal charges, partial charges, lone pairs and validation warnings never reveal connected carbon/hydrogen labels. All stages appear in separate boxes with solid reaction arrows between them; select a box to edit with the shared palette. Wide screens use the full available width, while narrow screens stack the boxes. Each stage retains its own Undo history. The introduction combines the question, conditions, spectator-ion instruction and OCR reference into one paragraph below the title. Curly arrows have no visible editing handles.

Formal and partial charges can be dragged around their parent atom with an element or charge tool selected. Their distance from the atom stays fixed, and attached electron arrows follow live. Arrow keys rotate a focused charge. A completed drag is one Undo step; Escape or pointer cancellation discards it. Stored angles affect presentation only and do not change marks. The curly-arrow tool continues to use negative charges as electron sources.

With a formal- or partial-charge tool selected, pressing an atom immediately previews its symbol. Drag before releasing to add and position it in one gesture, or tap for automatic placement. Opposite charges still cancel. Both mouse and touch placement are one undoable edit.

## Development workspace

Paths to `scripts/`, `development/alevel/validation/`, `development/tests/`, `apps/Masters-of-A-Level-Chemistry/src/assets/` and `development/shared/structures/` refer to the local OneDrive development project, not the website-only GitHub repository. Retained review records are in `development/alevel/validation/`; fresh screenshots and browser-run JSON are regenerated into `.scratch/`. Historical screenshots were pruned on 7 September 2026; historical review statements are not a new review.
