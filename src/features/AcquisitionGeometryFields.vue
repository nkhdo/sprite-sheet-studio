<script setup lang="ts">
import { useStudio } from "../studio/context";

defineProps<{ hidePalette?: boolean }>();
const studio = useStudio();
</script>

<template>
  <div class="geometry-row">
    <div class="field">
      <label class="field__label">Frame Size</label>
      <select v-model.number="studio.state.draft.frameSize" class="select">
        <option v-for="size in [32, 64, 128, 192, 256, 384, 512]" :key="size" :value="size">{{ size }} × {{ size }}</option>
      </select>
    </div>
    <div class="field">
      <label class="field__label">Subject Fill</label>
      <select v-model.number="studio.state.draft.subjectFillPct" class="select">
        <option v-for="fill in [50, 70, 85]" :key="fill" :value="fill">{{ fill }}%</option>
      </select>
    </div>
    <div v-if="!hidePalette" class="field">
      <label class="field__label">Palette</label>
      <select v-model="studio.state.draft.colorCount" class="select">
        <option :value="null">Off</option>
        <option v-for="count in [4, 8, 16, 32]" :key="count" :value="count">{{ count }} colors</option>
      </select>
    </div>
  </div>
</template>
