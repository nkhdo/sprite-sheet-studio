# SpriteSheetStudio

SpriteSheetStudio creates reusable game assets through project-based generation and composition workflows.

## Language

**Project**:
A durable, continuously saved workspace for creating a related Reference Sprite, Movement Frames, and Animations. Each Project has an immutable UUID identity; the studio always has an active Project.
_Avoid_: Saved project, snapshot, temporary project

**Project Label**:
The user-facing name of a Project. It is non-unique display metadata, may be changed freely, and is not the Project's storage identity.
_Avoid_: Project name, project ID

**Reference Sprite**:
The single authoritative, opaque source image used to generate a project's movement frames. It may be generated from a prompt or supplied by the user through an upload, and is expected to use the studio's chroma-green background.
_Avoid_: Generated sprite, source sprite

**Reference Sprite Acquisition**:
The act of establishing a project's Reference Sprite through either generation or upload. A successful acquisition replaces the prior Reference Sprite and invalidates all downstream artifacts.
_Avoid_: Sprite generation when referring to both methods

**Style Guide Image**:
An optional, project-scoped visual exemplar used during generation to influence the palette, linework, shading, texture, and proportions of a new Reference Sprite. It is not a source of subject identity, clothing, pose, or composition, although model adherence is best-effort. Selecting or removing one does not alter the current Reference Sprite or Downstream Artifacts.
_Avoid_: Reference image, style reference image

**Style Guide Selection**:
The unordered set of up to three Style Guide Images prepared for the next generated Reference Sprite Acquisition. It persists independently of the current Reference Sprite and is inactive when upload acquisition is selected.
_Avoid_: Selected references, active references

**Applied Style Guide Set**:
The Style Guide Images used by the most recent successful generated Reference Sprite Acquisition. It may differ from the Style Guide Selection; an uploaded Reference Sprite has no Applied Style Guide Set.
_Avoid_: Used references, previous references

**Acquisition Provenance**:
The method by which the current Reference Sprite was acquired: `generated` or `uploaded`.
_Avoid_: Source type, image type

**Background Suitability**:
A heuristic assessment of whether a Reference Sprite's outer background is sufficiently uniform and close to the studio's chroma green for reliable movement-frame extraction. It is advisory rather than a guarantee.
_Avoid_: Background validity, chroma validation

**Transparent Reference Preview**:
A regenerable, non-authoritative transparent derivative of the Reference Sprite used for display and optional download. It has the same dimensions and subject geometry as the Reference Sprite and is never an input to movement generation.
_Avoid_: Transparent Reference Sprite, transparent source, alpha source

**Downstream Artifacts**:
Movement Frames, Animations, spritesheets, and animated previews derived from the current Reference Sprite.
_Avoid_: Outputs when specifically referring to derived project artifacts

**Movement Frames**:
The replaceable sequence of images extracted from the project's current generated video. They are source material for Animation Drafts, not durable Animation content.
_Avoid_: Animation frames, source frames

**Animation Draft**:
The ordered Frame Sequence and playback rate currently being edited and previewed. It is transient until it creates or updates an Animation.
_Avoid_: Current selection, pending spritesheet

**Animation**:
A project-scoped, named game asset containing an ordered Frame Sequence, playback rate, spritesheet, and animated preview. It owns a frozen copy of its selected Movement Frames and therefore survives later video generation from the same Reference Sprite.
_Avoid_: Spritesheet when referring to the complete saved asset, animation clip

**Frame Sequence**:
The ordered list of Movement Frames in an Animation Draft or Animation. Order and repeated frames are meaningful.
_Avoid_: Frame selection, selected frame set

**Color Palette**:
A named set of explicitly chosen colors in a shared library available across Projects. A Project can select one to guide Reference Sprite generation and constrain the resulting subject to its exact colors, separately from the chroma-green background.
_Avoid_: Subject Palette when referring to user-defined colors, color count

**Color Palette Setting**:
The Project's choice of color constraints for its next generated Reference Sprite: unrestricted colors, a subject color-count limit, colors from its Style Guide Selection, or a named Color Palette. The chroma-green background is separate; Style Guide colors are available only when Style Guide Images are selected.
_Avoid_: Palette Lock when referring to the complete generation color setting

**Applied Color Palette**:
The copy of a selected Color Palette's colors frozen when generation starts and retained with the successfully acquired Reference Sprite. Later edits or deletion of the shared Color Palette do not alter it.
_Avoid_: Selected palette when referring to colors already applied

**Subject Palette**:
The set of colors present in the opaque, non-background pixels of the current Reference Sprite. The chroma-green background color is never part of the Subject Palette, regardless of how much of the image it covers.
_Avoid_: Sprite colors, image palette

**Palette Lock**:
A Movement Frame option that uses local visual context to constrain colors to the Reference Sprite's Subject Palette without altering alpha. Reference Sprite color constraints are expressed through the Color Palette Setting.
_Avoid_: Color fixing, color correction, palette matching

**Hard Alpha Edges**:
An optional Movement Frame treatment that permits only fully opaque or fully transparent pixels. It is independent of Palette Lock and does not alter the Reference Sprite.
_Avoid_: Alpha lock, transparency removal

**Target Frame Size**:
The requested pixel dimensions of the Reference Sprite. Acquisition guarantees the stored Reference Sprite exactly matches it, rescaling the image and extending the chroma-green background as needed rather than distorting the subject.
The acquired value is also authoritative for extracted Movement Frames, spritesheet cells, and the animated preview. A later change to the acquisition controls remains a draft until another Reference Sprite is acquired. Video providers may receive an in-memory nearest-neighbor enlargement when their registry entry declares a larger minimum input; this transport copy is never persisted.
_Avoid_: Output size, resolution, frame size when referring to animation frames

**Subject Fill**:
The fraction of the Reference Sprite's frame height occupied by the subject. It is requested during acquisition as generation guidance; the achieved fill is measured and reported, never enforced.
_Avoid_: Object target height, object height, sprite scale
