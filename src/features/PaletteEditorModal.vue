<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { saveColorPalette } from "../lib/api/color-palettes";
import { CHROMA_WARNING, conflictsWithChroma, normalizeColors, type ColorPalette } from "../lib/color-palettes";
import { reloadColorPalettes } from "../studio/color-palettes";
import BaseStatus from "../ui/BaseStatus.vue";
import UiModal from "../ui/UiModal.vue";

const props = defineProps<{ palette?: ColorPalette; duplicate?: boolean }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const modal = ref<InstanceType<typeof UiModal>>();
const original = props.palette && !props.duplicate ? { ...props.palette } : null;
const title = original ? "Edit palette" : props.duplicate ? "Duplicate palette" : "Create palette";
const name = ref(props.palette ? (props.duplicate ? `${props.palette.name} copy`.slice(0, 80) : props.palette.name) : "");
const colors = ref(props.palette ? [...props.palette.colors] : ["#000000", "#ffffff"]);
const pasted = ref("");
const busy = ref(false);
const saved = ref(false);
const error = ref("");
const serialized = computed(() => JSON.stringify([name.value, colors.value, pasted.value]));
const baseline = serialized.value;
const dirty = computed(() => !saved.value && serialized.value !== baseline);
const validation = computed(() => {
  try { normalizeColors(colors.value); return ""; }
  catch (problem) { return (problem as Error).message; }
});
const conflicting = computed(() => colors.value.filter((color) => {
  try { return conflictsWithChroma(normalizeColors([color])[0]); } catch { return false; }
}));
function discard(): boolean {
  return !dirty.value || window.confirm("Discard unsaved palette edits?");
}
function pasteColors() {
  try {
    const entries = pasted.value.trim().split(/[\s,;]+/).filter(Boolean);
    colors.value = normalizeColors([...colors.value, ...entries]);
    pasted.value = "";
    error.value = "";
  } catch (problem) { error.value = (problem as Error).message; }
}
async function save() {
  if (busy.value) return;
  error.value = "";
  try {
    if (pasted.value.trim()) throw new Error("Add the pasted colors or clear the paste field before saving.");
    const normalized = normalizeColors(colors.value);
    if (!name.value.trim()) throw new Error("Enter a palette name.");
    busy.value = true;
    await saveColorPalette({
      ...(original ? { id: original.id, revision: original.revision } : {}),
      name: name.value.trim(), colors: normalized,
    });
    saved.value = true;
    await reloadColorPalettes();
    emit("saved");
  } catch (problem) { error.value = (problem as Error).message; }
  finally { busy.value = false; }
  if (saved.value) modal.value?.close();
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || busy.value) { event.preventDefault(); event.returnValue = ""; }
}
onMounted(() => window.addEventListener("beforeunload", beforeUnload));
onUnmounted(() => window.removeEventListener("beforeunload", beforeUnload));
</script>

<template>
  <UiModal ref="modal" :title="title" :blocked="busy" :can-close="discard" @close="emit('close')">
    <fieldset :disabled="busy" class="palette-editor__fields">
        <form class="palette-editor" @submit.prevent="save">
          <label class="field">Name<input v-model="name" class="input" maxlength="80" required aria-label="Palette name" /></label>
          <div class="palette-editor__colors">
            <div v-for="(color, index) in colors" :key="index" class="palette-editor__color">
              <input type="color" :value="/^#[0-9a-f]{6}$/i.test(color) ? color : '#000000'" :aria-label="`Pick color ${index + 1}`" @input="colors[index] = ($event.target as HTMLInputElement).value" />
              <input v-model="colors[index]" class="input" :aria-label="`Hex color ${index + 1}`" spellcheck="false" />
              <button class="btn btn--secondary btn--sm" type="button" :aria-label="`Remove color ${index + 1}`" @click="colors.splice(index, 1)">×</button>
            </div>
          </div>
          <button class="btn btn--secondary btn--sm" type="button" :disabled="colors.length >= 256" @click="colors.push('#000000')">Add color</button>
          <label class="field">Paste hex colors<textarea v-model="pasted" class="textarea" rows="2" placeholder="#112233, #abc" aria-label="Paste hex colors" /></label>
          <button class="btn btn--secondary btn--sm" type="button" :disabled="!pasted.trim()" @click="pasteColors">Add pasted colors</button>
          <p>1–256 unique colors. Duplicates are combined when saved.</p>
          <BaseStatus v-if="validation" :message="validation" kind="error" />
          <BaseStatus v-if="conflicting.length" :message="`${conflicting.join(', ')}: ${CHROMA_WARNING}`" />
          <div class="palette-actions">
            <button class="btn btn--primary" type="submit" :disabled="!!validation || !name.trim()">Save palette</button>
            <button class="btn btn--secondary" type="button" @click="modal?.close()">Cancel</button>
          </div>
        </form>
    </fieldset>
    <BaseStatus :message="error || (busy ? 'Saving palette…' : '')" :kind="error ? 'error' : 'info'" :busy="busy" />
  </UiModal>
</template>

<style scoped>
.palette-editor__fields { padding: 0; border: 0; margin: 0; min-width: 0; }
.palette-actions { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .5rem; }
.palette-editor { display: grid; gap: .75rem; margin-top: 1rem; }
.palette-editor__colors { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: .5rem; }
.palette-editor__color { display: flex; align-items: center; gap: .5rem; min-width: 0; }
.palette-editor__color input[type=color] { width: 2.5rem; height: 2rem; flex-shrink: 0; }
.palette-editor__color .input { min-width: 0; width: 100%; }
</style>
