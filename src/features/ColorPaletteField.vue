<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { CHROMA_WARNING, conflictsWithChroma } from "../lib/color-palettes";
import { paletteLibrary, refreshColorPalettes } from "../studio/color-palettes";
import { useStudio } from "../studio/context";
import BaseStatus from "../ui/BaseStatus.vue";

const studio = useStudio();
const notice = ref("");
const selected = computed(() => paletteLibrary.palettes.find(({ id }) => `palette:${id}` === studio.state.draft.color_palette));
const conflicting = computed(() => selected.value?.colors.filter(conflictsWithChroma) ?? []);
const busy = computed(() => studio.state.operations.reference.phase === "running" || studio.state.operations.styleGuide.phase === "running");
function changedSelection() {
  notice.value = "";
  if (studio.state.project) studio.state.project.colorPaletteNotice = "";
}
function reconcileSelection() {
  const setting = studio.state.draft.color_palette;
  if ((setting === "style-guides" && !studio.state.project?.styleGuides.length) ||
      (setting.startsWith("palette:") && paletteLibrary.loaded && !paletteLibrary.error && !selected.value)) {
    studio.state.draft.color_palette = "unrestricted";
    notice.value = "The selected palette is unavailable. Color palette switched to Unrestricted.";
  }
}
// Only a completed library read can invalidate a named selection. A cached list
// from another Project may predate a palette created in another tab.
watch(() => paletteLibrary.palettes, reconcileSelection);
watch(() => studio.state.project?.styleGuides.length, () => {
  if (studio.state.draft.color_palette === "style-guides") reconcileSelection();
});
watch(() => studio.state.project?.id, () => { notice.value = ""; refresh(); });
async function refresh() {
  await refreshColorPalettes();
  if (!paletteLibrary.error) reconcileSelection();
}
onMounted(() => { refresh(); window.addEventListener("focus", refresh); });
onUnmounted(() => window.removeEventListener("focus", refresh));
</script>

<template>
  <div class="field" data-form-row="color-palette">
    <label class="field__label" for="color-palette">Color palette</label>
    <select id="color-palette" v-model="studio.state.draft.color_palette" class="select" :disabled="busy" @change="changedSelection" @focus="refresh">
      <option value="unrestricted">Unrestricted</option>
      <option v-for="count in [4, 8, 16, 32]" :key="count" :value="`count:${count}`">{{ count }} subject colors</option>
      <option value="style-guides" :disabled="!studio.state.project?.styleGuides.length">From Style Guide Images</option>
      <optgroup label="Saved palettes">
        <option v-for="palette in paletteLibrary.palettes" :key="palette.id" :value="`palette:${palette.id}`">{{ palette.name }} · {{ palette.colors.length }} colors</option>
      </optgroup>
    </select>
    <div v-if="selected" class="palette-swatches" :aria-label="`${selected.name} colors`">
      <span v-for="color in selected.colors" :key="color" class="palette-swatch" :style="{ backgroundColor: color }" :title="color" role="img" :aria-label="color" />
    </div>
    <BaseStatus :message="notice || studio.state.project?.colorPaletteNotice || ''" />
    <BaseStatus v-if="conflicting.length" :message="`${conflicting.join(', ')}: ${CHROMA_WARNING}`" />
    <BaseStatus :message="paletteLibrary.error || (paletteLibrary.loading ? 'Loading palettes…' : '')" :kind="paletteLibrary.error ? 'error' : 'info'" :busy="paletteLibrary.loading" />
    <button v-if="paletteLibrary.error" class="btn btn--secondary btn--sm" type="button" @click="refresh">Retry loading palettes</button>
  </div>
</template>
