<script setup>
import { ref } from 'vue'

const props = defineProps({
    modelValue: { type: String, default: null }
})
const emit = defineEmits(['update:modelValue'])

// avatar1.jpg - avatar8.jpg ตามไฟล์จริงใน public/avatars/
const avatars = ref(
    Array.from({ length: 8 }, (_, i) => `/avatars/avatar${i + 1}.jpg`)
)

function select(path) {
    emit('update:modelValue', path)
}
</script>

<template>
    <div class="grid grid-cols-2 min-[360px]:grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4">
        <button
            v-for="avatar in avatars"
            :key="avatar"
            type="button"
            @click="select(avatar)"
            class="relative rounded-2xl border-3 overflow-hidden transition hover:-translate-y-1"
            :class="modelValue === avatar
                ? 'border-orange shadow-offset-sm'
                : 'border-dark shadow-offset-sm opacity-80 hover:opacity-100'"
        >
            <img :src="avatar" class="w-full aspect-square object-cover" alt="อวตาร" />
            <span
                v-if="modelValue === avatar"
                class="absolute top-1 right-1 bg-orange border-2 border-dark rounded-full text-[10px] font-bold px-1.5 py-0.5"
            >
                ✓
            </span>
        </button>
    </div>
</template>
