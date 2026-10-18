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
  <div class="border-b-3 border-dark bg-dark sticky top-0 z-20">
    <div class="max-w-[1000px] mx-auto px-3 sm:px-6 flex gap-1 overflow-x-auto overflow-y-hidden">
      <button v-for="tab in tabs" :key="tab.id" type="button" @click="emit('update:activeTab', tab.id)"
        class="px-3 sm:px-4 py-2 my-2.5 text-[12.5px] sm:text-[14px] font-bold whitespace-nowrap rounded-lg transition" :class="activeTab === tab.id
          ? 'bg-purple text-dark border-2 border-white shadow-[3px_3px_0_rgba(255,255,255,0.3)]'
          : 'text-gray-400 border-2 border-transparent hover:text-white hover:bg-white/5'">
        {{ tab.label }}
      </button>
    </div>
  </div>
</template>