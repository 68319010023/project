<script setup>
defineProps({
  size: { type: Number, default: 32 },
  color: { type: String, default: '#FF6B4A' },
  label: { type: String, default: '' },
})
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3">
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
      class="animate-spin"
      style="animation-duration: 0.7s;"
    >
      <circle
        cx="12" cy="12" r="9"
        fill="none"
        :stroke="color"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-dasharray="42"
        stroke-dashoffset="14"
        opacity="0.9"
      />
    </svg>
    <p v-if="label" class="text-xs text-[#14213D]/40">{{ label }}</p>
  </div>
</template>