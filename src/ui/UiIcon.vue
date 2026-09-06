<script setup lang="ts">
defineProps<{ name: "plus" | "minus" | "play" | "pause" | "previous" | "next" | "expand" | "collapse" | "sun" | "moon" | "chevron-down" | "edit" | "trash" | "settings" }>();
</script>

<template>
  <svg
    class="ui-icon"
    :data-icon="name"
    aria-hidden="true"
    viewBox="0 0 16 16"
    width="16"
    height="16"
  >
    <path
      v-if="name === 'plus'"
      d="M8 3v10M3 8h10"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <path
      v-else-if="name === 'minus'"
      d="M3 8h10"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <path
      v-else-if="name === 'play'"
      d="M5.5 3.5 12 8l-6.5 4.5z"
      fill="currentColor"
    />
    <path
      v-else-if="name === 'previous'"
      d="m10.5 3.5-6 4.5 6 4.5z"
      fill="currentColor"
    />
    <path
      v-else-if="name === 'next'"
      d="m5.5 3.5 6 4.5-6 4.5z"
      fill="currentColor"
    />
    <path
      v-else-if="name === 'expand'"
      d="M6 3H3v3m7-3h3v3M6 13H3v-3m7 3h3v-3"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      v-else-if="name === 'collapse'"
      d="M3 6h3V3m7 3h-3V3M3 10h3v3m7-3h-3v3"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <g v-else-if="name === 'sun'" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5v1.3M8 13.2v1.3M1.5 8h1.3M13.2 8h1.3M3.4 3.4l.9.9m7.4 7.4.9.9m0-9.2-.9.9m-7.4 7.4-.9.9" />
    </g>
    <path
      v-else-if="name === 'moon'"
      d="M12.8 10.4A5.3 5.3 0 0 1 5.6 3.2 5.4 5.4 0 1 0 12.8 10.4Z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.35"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      v-else-if="name === 'chevron-down'"
      d="m4 6 4 4 4-4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      v-else-if="name === 'edit'"
      d="m3.5 11.8.7-2.7 5.9-5.9a1.2 1.2 0 0 1 1.7 0l1 1a1.2 1.2 0 0 1 0 1.7l-5.9 5.9-2.7.7zM9.2 4.1l2.7 2.7"
      fill="none"
      stroke="currentColor"
      stroke-width="1.35"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      v-else-if="name === 'trash'"
      d="M3.5 4.5h9M6 4.5V3h4v1.5m-5.5 0 .6 8h5.8l.6-8M6.8 6.5v4M9.2 6.5v4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.35"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <g v-else-if="name === 'settings'" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round">
      <path d="M6.6 1.5h2.8l.4 1.8 1.4.8 1.8-.5 1.4 2.4L13 7.2v1.6l1.4 1.3-1.4 2.4-1.8-.5-1.4.8-.4 1.8H6.6l-.4-1.8-1.4-.8-1.8.5-1.4-2.4L3 8.8V7.2L1.6 5.9 3 3.5l1.8.5 1.4-.8z" />
      <circle cx="8" cy="8" r="2.2" />
    </g>
    <template v-else>
      <path d="M5 3.5h2.2v9H5zM8.8 3.5H11v9H8.8z" fill="currentColor" />
    </template>
  </svg>
</template>
