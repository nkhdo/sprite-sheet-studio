<script setup lang="ts">
import { onMounted, ref } from "vue";
import { colorPaletteUsage, deleteColorPalette } from "../lib/api/color-palettes";
import type { ColorPalette } from "../lib/color-palettes";
import { paletteLibrary, refreshColorPalettes, reloadColorPalettes } from "../studio/color-palettes";
import BaseStatus from "../ui/BaseStatus.vue";
import UiModal from "../ui/UiModal.vue";
import PaletteEditorModal from "./PaletteEditorModal.vue";

const emit = defineEmits<{ close: [] }>();
const editor = ref<{ palette?: ColorPalette; duplicate?: boolean } | null>(null);
const busy = ref(false);
const message = ref("");
const error = ref("");
function edit(palette?: ColorPalette, duplicate = false) {
  editor.value = { palette, duplicate };
  error.value = "";
  message.value = "";
}
async function remove(palette: ColorPalette) {
  busy.value = true;
  error.value = "";
  try {
    const { count } = await colorPaletteUsage(palette.id);
    if (!window.confirm(`Delete “${palette.name}”? ${count} Project${count === 1 ? '' : 's'} select it and will switch to Unrestricted. Existing sprites and Animations stay intact.`)) return;
    await deleteColorPalette(palette);
    message.value = "Palette deleted.";
    await reloadColorPalettes();
  } catch (problem) { error.value = (problem as Error).message; }
  finally { busy.value = false; }
}
onMounted(() => { void refreshColorPalettes(); });
</script>

<template>
  <UiModal title="Settings" :blocked="busy || !!editor" @close="emit('close')">
    <div role="tablist" aria-label="Settings sections">
      <button id="palette-settings-tab" class="btn btn--secondary" role="tab" aria-selected="true" aria-controls="palette-settings-panel" type="button">Color Palettes</button>
    </div>
    <section id="palette-settings-panel" role="tabpanel" aria-labelledby="palette-settings-tab">
      <p>Share named palettes across Projects. Changes apply to future generations.</p>
      <BaseStatus :message="paletteLibrary.error || (paletteLibrary.loading ? 'Loading palettes…' : '')" :kind="paletteLibrary.error ? 'error' : 'info'" :busy="paletteLibrary.loading" />
      <button v-if="paletteLibrary.error" type="button" class="btn btn--secondary" @click="reloadColorPalettes">Retry loading palettes</button>
      <fieldset :disabled="busy || !!editor" class="settings-modal__fields">
        <div class="palette-library">
          <div v-for="palette in paletteLibrary.palettes" :key="palette.id" class="palette-library__item">
            <strong>{{ palette.name }}</strong>
            <div class="palette-swatches" :aria-label="`${palette.name} colors`">
              <span v-for="color in palette.colors" :key="color" class="palette-swatch" :style="{ backgroundColor: color }" :title="color" role="img" :aria-label="color" />
            </div>
            <div class="palette-actions">
              <button type="button" class="btn btn--secondary btn--sm" :aria-label="`Edit ${palette.name}`" @click="edit(palette)">Edit</button>
              <button type="button" class="btn btn--secondary btn--sm" :aria-label="`Duplicate ${palette.name}`" @click="edit(palette, true)">Duplicate</button>
              <button type="button" class="btn btn--secondary btn--sm" :aria-label="`Delete ${palette.name}`" @click="remove(palette)">Delete</button>
            </div>
          </div>
          <p v-if="!paletteLibrary.palettes.length && !paletteLibrary.loading">No palettes yet. Create your first palette below.</p>
        </div>
        <button type="button" class="btn btn--primary" @click="edit()">Create palette</button>
      </fieldset>
      <BaseStatus :message="error || (busy ? 'Deleting palette…' : message)" :kind="error ? 'error' : busy ? 'info' : 'success'" :busy="busy" />
    </section>
  </UiModal>
  <PaletteEditorModal v-if="editor" v-bind="editor" @close="editor = null" @saved="message = 'Palette saved.'" />
</template>

<style scoped>
.settings-modal__fields { padding: 0; border: 0; margin: 0; min-width: 0; }
.palette-library { display: grid; gap: 1rem; margin: 1rem 0; }
.palette-library__item { padding: 1rem; border: 1px solid var(--border); border-radius: 8px; overflow-wrap: anywhere; }
.palette-actions { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .5rem; }
</style>
