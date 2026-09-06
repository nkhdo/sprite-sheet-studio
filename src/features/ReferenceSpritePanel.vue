<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useStudio } from "../studio/context";
import BaseButton from "../ui/BaseButton.vue";
import BaseStatus from "../ui/BaseStatus.vue";
import FileDropzone from "../ui/FileDropzone.vue";
import UiIcon from "../ui/UiIcon.vue";
import ColorPaletteField from "./ColorPaletteField.vue";
import AcquisitionGeometryFields from "./AcquisitionGeometryFields.vue";

const studio = useStudio();
const operation = computed(() => studio.state.operations.reference);
const styleOperation = computed(() => studio.state.operations.styleGuide);
const imageModel = computed(() => studio.imageModels.find(({ id }) => id === studio.state.draft.spriteModel));
const guideLimit = computed(() => Math.min(3, imageModel.value?.maxStyleGuideImages ?? 0));
const busy = computed(() => operation.value.phase === "running");
const previewView = ref<"transparent" | "source">("transparent");
const previewUrl = computed(() =>
  previewView.value === "transparent"
    ? studio.state.project?.transparentReferencePreviewUrl ?? studio.state.project?.spriteUrl
    : studio.state.project?.spriteUrl,
);
watch(() => studio.state.project?.spriteUrl, () => { previewView.value = "transparent"; });

function addStyleGuides(event: Event) {
  const input = event.target as HTMLInputElement;
  void studio.actions.addStyleGuides([...(input.files ?? [])]);
  input.value = "";
}
</script>

<template>
  <section class="card accordion-item" :class="{ 'is-open': studio.activePanel === 'reference' }">
    <button class="accordion-trigger" type="button" :aria-expanded="studio.activePanel === 'reference'" @click="studio.actions.setPanel('reference')">
      <span>Reference Sprite</span><span class="accordion-trigger__icon" aria-hidden="true" />
    </button>
    <div class="panel-body">
      <div class="mode-switch" role="group" aria-label="Reference Sprite Acquisition method">
        <button class="mode-switch__button" :class="{ 'is-active': studio.state.draft.spriteAcquisitionMode === 'generate' }" type="button" @click="studio.state.draft.spriteAcquisitionMode = 'generate'">Generate</button>
        <button class="mode-switch__button" :class="{ 'is-active': studio.state.draft.spriteAcquisitionMode === 'upload' }" type="button" @click="studio.state.draft.spriteAcquisitionMode = 'upload'">Upload</button>
      </div>

      <div v-if="studio.state.draft.spriteAcquisitionMode === 'generate'" class="acquisition-panel">
        <div class="field" data-form-row="prompt">
          <label class="field__label" for="sprite-prompt">Reference Sprite Prompt</label>
          <textarea id="sprite-prompt" v-model="studio.state.draft.spritePrompt" class="textarea" rows="3" placeholder="Describe the character or object…" />
        </div>
        <div class="field" data-form-row="model"><label class="field__label" for="sprite-model">Model</label><select id="sprite-model" v-model="studio.state.draft.spriteModel" class="select"><option v-for="model in studio.imageModels" :key="model.id" :value="model.id">{{ model.label }}</option></select></div>
        <AcquisitionGeometryFields data-form-row="geometry" hide-palette />
        <div class="style-guide-field" data-form-row="style-guides">
          <div class="style-guide-field__header">
            <span class="field__label">Style Guide Images · optional</span>
            <span class="style-guide-field__count">{{ studio.state.project?.styleGuides.length ?? 0 }}/{{ guideLimit }}</span>
          </div>
          <div class="style-guide-list">
            <div v-for="guide in studio.state.project?.styleGuides" :key="guide.id" class="style-guide-thumb">
              <img :src="guide.url" alt="" />
              <button class="style-guide-thumb__remove" type="button" :disabled="busy || styleOperation.phase === 'running'" :aria-label="`Remove ${guide.originalFilename}`" @click="studio.actions.removeStyleGuide(guide.id)">×</button>
            </div>
            <label
              v-if="(studio.state.project?.styleGuides.length ?? 0) < guideLimit"
              class="style-guide-add"
              :class="{ 'is-disabled': styleOperation.phase === 'running' }"
              for="style-guides"
              aria-label="Add Style Guide Images"
            >
              <input
                id="style-guides"
                class="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                :disabled="styleOperation.phase === 'running' || busy"
                @change="addStyleGuides"
              />
              <UiIcon name="plus" />
            </label>
          </div>
          <BaseStatus :message="styleOperation.message" :kind="styleOperation.phase === 'error' ? 'error' : styleOperation.phase === 'success' ? 'success' : 'info'" :busy="styleOperation.phase === 'running'" />
        </div>
        <ColorPaletteField />
        <BaseButton data-form-row="generate" variant="primary" block :busy="busy" :disabled="!studio.hasApiKey || styleOperation.phase === 'running'" @click="studio.actions.generateReference">Generate Reference Sprite</BaseButton>
      </div>
      <div v-else class="acquisition-panel">
        <FileDropzone input-id="reference-upload" accept="image/png,image/jpeg,image/webp" label="Drop an image here or choose a file" hint="PNG, JPEG, or WebP · max 10 MB" :disabled="busy" @files="studio.actions.uploadReference" />
        <AcquisitionGeometryFields />
      </div>
      <BaseStatus v-if="!studio.hasApiKey && studio.state.draft.spriteAcquisitionMode === 'generate'" message="OPENROUTER_API_KEY is missing. Upload still works without it." kind="error" />
      <BaseStatus :message="operation.message" :kind="operation.phase === 'error' ? 'error' : operation.phase === 'success' ? 'success' : 'info'" :busy="busy" />
      <div class="preview">
        <div class="preview__header">
          <div class="preview__label">Reference Sprite</div>
          <div v-if="studio.state.project?.spriteUrl" class="preview__switch" role="group" aria-label="Reference Sprite view">
            <button type="button" :class="{ 'is-active': previewView === 'transparent' }" :disabled="!studio.state.project.transparentReferencePreviewUrl" @click="previewView = 'transparent'">Transparent</button>
            <button type="button" :class="{ 'is-active': previewView === 'source' }" @click="previewView = 'source'">Chroma source</button>
          </div>
        </div>
        <div class="preview__box"><img v-if="previewUrl" :src="previewUrl" :alt="previewView === 'transparent' ? 'Transparent Reference Preview' : 'Reference Sprite chroma source'" /><span v-else class="preview__placeholder">No sprite yet</span></div>
        <div class="preview__caption">{{ studio.state.project?.spriteDimensions ? `${studio.state.project.spriteDimensions.w} × ${studio.state.project.spriteDimensions.h} px` : "—" }}</div>
        <div v-if="studio.state.project?.backgroundSuitability === 'warning'" class="background-warning">Background may not key cleanly. Use a flat #00b140 background.</div>
        <div v-else-if="studio.state.project?.spriteUrl && !studio.state.project.transparentReferencePreviewUrl" class="background-warning">
          Transparent preview is unavailable.
          <BaseButton variant="link" :busy="busy" @click="studio.actions.regenerateTransparentReferencePreview">Regenerate transparent preview</BaseButton>
        </div>
      </div>
    </div>
  </section>
</template>
