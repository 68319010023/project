<script setup>
defineProps({
  activeTab: { type: String, required: true },
})

const emit = defineEmits(['update:activeTab'])

const tabs = [
  { id: 'overview', label: 'ภาพรวม' },
  { id: 'members', label: 'สมาชิก' },
  { id: 'assignments', label: 'การบ้าน' },
]
</script>

<template>
  <div class="border-b-3 border-dark bg-white sticky top-0 z-20">
    <div class="max-w-[1000px] mx-auto px-6 flex gap-1 overflow-x-auto overflow-y-hidden">
      <button v-for="tab in tabs" :key="tab.id" type="button"
              @click="emit('update:activeTab', tab.id)"
              class="px-4 py-3.5 text-[14px] font-semibold whitespace-nowrap border-b-3 -mb-[3px] transition"
              :class="activeTab === tab.id
                ? 'border-dark text-dark'
                : 'border-transparent text-gray hover:text-dark'">
        {{ tab.label }}
      </button>
    </div>
  </div>
</template>