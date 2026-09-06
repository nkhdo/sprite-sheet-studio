# Color Palettes for Reference Sprite generation

Status: Implemented and verified.

## Confirmed decisions

- A Color Palette is a named set of explicitly chosen colors, distinct from the Subject Palette actually present in a Reference Sprite.
- Color Palettes live in a shared library available across Projects. Each Project remembers its selection.
- Generation receives the selected colors as guidance; post-processing enforces exact subject colors. The chroma-green background is separate.
- Initial authoring supports editable swatches, a color picker, and pasting a list of hex colors. Palette file import and image extraction are deferred.
- Step 1 uses one unified `color_palette` setting with color-count options, colors from Style Guide Images (available only with a Style Guide Selection), and named Color Palettes. It replaces the separate generation color-count and guide-based Palette Lock controls.
- Listed colors are allowed colors; not every palette color must appear in the generated subject.
- Named Color Palettes apply to generation only in this version. Upload mode remembers but does not apply the selection.
- Shared palette edits affect future generations only. The current Reference Sprite retains an Applied Color Palette snapshot. Deletion clears draft selections referencing that palette and leaves acquired artifacts intact; show the number of selecting Projects before deletion.
- Chroma-conflicting colors produce a warning during palette creation, not rejection.
- Allow 1–256 unique opaque RGB colors. Accept short and full hex notation, normalize and deduplicate entries, and flag invalid values without silently discarding them.
- Palette management lives in a Color Palettes tab of a Settings modal opened from the top navigation. Create, edit/rename, and duplicate open a separate palette editor modal above Settings; Save or Cancel returns to the library. Deletion remains in Settings.
- The unified selector offers Unrestricted, 4 / 8 / 16 / 32 colors, From Style Guide Images, and named library palettes. New Projects default to 16 colors. Upload retains its existing color-count control.
- Count modes limit subject colors only; the chroma-green background is additional. Style Guide mode constrains subject colors to the guide colors without a later color-count reduction.
- The library initially contains only user-created palettes; bundled presets are deferred.
- Removing the last Style Guide Image while its color mode is selected, or deleting a selected library palette, switches the draft setting to Unrestricted with an explanation near the selector.
- Migration gives an existing enabled Style Guide Palette Lock precedence over the old color-count setting; other Projects retain their count choice. Migration does not reprocess acquired artifacts.
- Chroma-conflicting colors remain selectable and are used unchanged during generation. Repeat the warning near Generate; exact color enforcement does not guarantee those subject regions survive later background removal.
- Color Palettes is the only initial Settings tab. Additional tabs are outside this feature.
- Palette creation and editing use explicit Save / Cancel. Closing the palette editor with unsaved edits asks whether to discard them. Settings stays open behind the editor and cannot close until the editor is dismissed. Project palette selection continues to autosave.
- Generation freezes the selected palette colors when the request starts. The request and its resulting Applied Color Palette use that snapshot even if the shared palette is edited or deleted before completion; subsequent requests use the updated library state.

## Confirmation

The user confirmed the complete design and requested implementation.

## Implementation notes

- Shared library entries are UUID-addressed and stored atomically in `projects/color-palettes.json`. Revision checks prevent stale editors from overwriting newer palette changes.
- The scalar `color_palette` draft setting participates in existing Project autosave and conflict detection; upload's `draftColorCount` remains independent.
- Deleted library selections resolve to Unrestricted when Projects are read and are persisted with the next Project write. This avoids rewriting a Project during an in-progress generation. The active generation UI also refreshes its selection after library changes.
- Palette colors are captured before the provider request and applied after geometry processing. Named palettes also supply exact hex colors to the prompt; Style Guide mode uses the supplied images as its color guidance.
- Settings and the separate palette editor use Vue Final Modal through a reusable `UiModal`. It handles stacking, focus containment, and Escape/backdrop dismissal; close guards preserve unsaved edits and prevent dismissal while saving.

## Verification results

- `pnpm test`: 59 server tests and 62 client tests passed. OpenRouter requests were mocked.
- `pnpm build`: passed.
- `git diff --check`: passed.
- No app, browser, or live provider verification was performed.

## Verification criteria

- Named palette colors reach the generation prompt; final subject pixels use only allowed palette colors, without requiring every listed color to appear.
- Subject count limits exclude the background; Style Guide and named palette modes are not followed by count quantization.
- Generation color choices and upload color-count controls persist independently.
- Library edits/deletions and selection changes preserve acquired Reference Sprites and Downstream Artifacts; successful acquisition retains the existing invalidation behavior.
- Applied colors remain available after library edits/deletion and Project reload.
- Canceling library edits leaves the saved palette unchanged; closing Settings with unsaved edits offers a discard decision.
- Library edits or deletion during generation cannot change the request's frozen colors or its resulting Applied Color Palette.
- Invalid hex entries are visible; duplicate colors normalize; chroma warnings permit saving and generation.
- Settings supports keyboard navigation, modal focus management, Escape/close, and focus return to its trigger. Loading, success, retry, and error states stay near their actions.
- Implementation verification uses mocked provider tests, `pnpm test`, `pnpm build`, and `git diff --check`; no live app or provider verification.

## Behavior before this feature

- The current color-count selector performs post-generation quantization and includes background colors; it does not inject colors into the model prompt.
- Reference Sprite Palette Lock derives colors from applied Style Guide Images. Subsequent color-count quantization can change those colors.
- Projects distinguish draft acquisition controls from values applied to the current Reference Sprite.
- Replacing a Reference Sprite invalidates Downstream Artifacts; editing acquisition controls alone does not replace it.
- Preview removal, Subject Palette extraction, and FFmpeg chromakey use different color-distance rules. A warning is advisory, not a guarantee that all remaining greens survive extraction; the preview can preserve green details that Movement Frame extraction removes.

## Comments

- User accepted all first-round recommendations: exact enforcement plus prompt guidance, shared library with Project selection, and manual authoring with hex-list paste.
- Second round: user requested one unified color setting and a top-nav Settings modal with a Color Palettes tab; accepted allowed-color semantics, generation-only scope, shared-library lifecycle, and authoring limits; chose warnings instead of rejecting chroma-conflicting colors.
- Third round: user accepted all recommendations for selector options/defaults, subject-only count semantics, user-created palettes only, unavailable-selection fallback and migration, warning-only generation with conflicting greens, and initial Settings scope.
- Fourth round: user accepted explicit Save / Cancel for library authoring, autosaved Project selection, confirmation before discarding unsaved edits on close, and palette snapshots frozen at generation start.
