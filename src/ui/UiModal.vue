<script setup lang="ts">
import { ref, useId } from "vue";
import { VueFinalModal } from "vue-final-modal";

const props = withDefaults(defineProps<{
  title: string;
  blocked?: boolean;
  canClose?: () => boolean;
}>(), { blocked: false, canClose: () => true });
const emit = defineEmits<{ close: [] }>();
const open = ref(true);
const titleId = useId();
const fallbackFocus = ref<HTMLElement>();
let closing = false;
function beforeClose(event: { stop: () => void }) {
  // Vue Final Modal also reconciles its internal close with v-model; a single
  // dismissal must ask about unsaved changes only once.
  if (closing) return;
  if (props.blocked || !props.canClose()) event.stop();
  else closing = true;
}
function close() { open.value = false; }
defineExpose({ close });
</script>

<template>
  <VueFinalModal
    v-model="open"
    class="studio-modal"
    content-class="studio-modal__content"
    :content-transition="{ css: false }"
    :overlay-transition="{ css: false }"
    :aria-labelledby="titleId"
    :focus-trap="{ allowOutsideClick: true, escapeDeactivates: false, fallbackFocus: () => fallbackFocus! }"
    @before-close="beforeClose"
    @closed="emit('close')"
  >
    <header class="studio-modal__header">
      <h2 :id="titleId">{{ title }}</h2>
      <button class="btn btn--secondary btn--sm" type="button" :disabled="blocked" :aria-label="`Close ${title}`" @click="close">Close</button>
    </header>
    <div ref="fallbackFocus" tabindex="-1"><slot /></div>
  </VueFinalModal>
</template>

<style>
.studio-modal { display: flex; align-items: center; justify-content: center; padding: 1rem; }
.studio-modal__content { width: min(760px, 100%); max-height: calc(100dvh - 2rem); padding: 1.5rem; border: 1px solid var(--border); border-radius: 12px; background: var(--card); color: var(--text); overflow: auto; }
.studio-modal__header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1rem; }
.studio-modal__header h2 { margin: 0; }
</style>
