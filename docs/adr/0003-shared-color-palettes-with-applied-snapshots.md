# Shared Color Palettes retain applied snapshots in Projects

Color Palettes belong to a shared library so multiple Projects can reuse the same authored colors. Each acquired Reference Sprite retains a frozen copy of its applied Color Palette, rather than depending on the live library entry; this duplicates a small amount of data but preserves the meaning of existing assets when shared palettes are edited or deleted. Library changes affect future acquisitions only, and deleting a selected palette moves affected draft settings to Unrestricted without changing acquired artifacts.

Colors are frozen when generation starts, so an edit or deletion during a request cannot change its output constraints or the applied colors recorded on success.
