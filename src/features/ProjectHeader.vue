<script setup lang="ts">
import SettingsModal from "./SettingsModal.vue";
import { paletteLibrary } from "../studio/color-palettes";
import { useStudio } from "../studio/context";
import { currentTheme, toggleTheme } from "../theme";
import UiIcon from "../ui/UiIcon.vue";
import UiDropdown from "../ui/UiDropdown.vue";

const studio = useStudio();
</script>

<template>
  <header class="app-header">
    <div class="app-header__brand">
      <img class="app-header__logo" src="/logo.png" alt="" />
      <span class="app-header__title">SpriteSheetStudio</span>
      <UiDropdown trigger-class="btn btn--secondary btn--sm project-select" menu-class="load-menu" data-project-select>
        <template #trigger="{ open }">
          <span class="project-select__label">{{ studio.state.project?.label ?? "Loading…" }}</span>
          <UiIcon
            name="chevron-down"
            class="project-select__chevron"
            :class="{ 'is-open': open }"
            data-project-chevron
          />
        </template>
        <template #default="{ close }">
          <div
            v-for="project in studio.projects"
            :key="project.id"
            class="load-menu__row"
            role="none"
            :class="{ 'is-current': project.id === studio.state.project?.id }"
          >
            <button
              class="load-menu__item"
              role="menuitem"
              type="button"
              @click="studio.actions.switchProject(project.id); close()"
            >
              <span class="load-menu__name">{{ project.label }}</span>
              <span class="load-menu__time">{{ new Date(project.createdAt).toLocaleString() }}</span>
            </button>
            <button
              class="load-menu__rename"
              role="menuitem"
              type="button"
              :aria-label="`Rename ${project.label}`"
              @click="studio.actions.renameProject(project.id)"
            ><UiIcon name="edit" /></button>
            <button
              class="load-menu__delete"
              role="menuitem"
              type="button"
              :aria-label="`Delete ${project.label}`"
              @click="studio.actions.deleteProject(project.id)"
            ><UiIcon name="trash" /></button>
          </div>
          <div class="load-menu__separator" />
          <button
            class="load-menu__create"
            role="menuitem"
            type="button"
            @click="studio.actions.createProject(); close()"
          >
            <UiIcon name="plus" /> Create new
          </button>
        </template>
      </UiDropdown>
      <button
        v-if="studio.state.save.phase !== 'idle'"
        class="save-indicator"
        type="button"
        @click="studio.actions.retrySave"
      >
        {{ studio.state.save.phase === "saving"
          ? "Saving…"
          : studio.state.save.phase === "saved" ? "Saved" : "Not saved · Retry" }}
      </button>
    </div>
    <div class="app-header__actions">
      <button
        class="theme-toggle"
        type="button"
        aria-label="Dark mode"
        :aria-pressed="currentTheme === 'dark'"
        :title="currentTheme === 'dark' ? 'Use light mode' : 'Use dark mode'"
        @click="toggleTheme"
      >
        <UiIcon :name="currentTheme === 'dark' ? 'sun' : 'moon'" />
      </button>
      <button class="settings-button" type="button" aria-label="Settings" title="Settings" aria-haspopup="dialog" @click="paletteLibrary.settingsOpen = true"><UiIcon name="settings" /></button>
    </div>
  </header>
  <SettingsModal v-if="paletteLibrary.settingsOpen" @close="paletteLibrary.settingsOpen = false" />
</template>
