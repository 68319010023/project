<script setup>
import { ref } from 'vue'
import { Check } from 'lucide-vue-next'

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
    <div class="grid grid-cols-2 min-[360px]:grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4 p-1">
        <button
            v-for="(avatar, i) in avatars"
            :key="avatar"
            type="button"
            @click="select(avatar)"
            :aria-pressed="modelValue === avatar"
            :aria-label="`อวตาร ${i + 1}`"
            class="relative rounded-xl border-2 overflow-hidden transition hover:-translate-y-0.5
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-purple"
            :class="modelValue === avatar
                ? 'border-dark ring-4 ring-orange'
                : 'border-dark/30 hover:border-dark'"
        >
            <img :src="avatar" class="w-full aspect-square object-cover" alt="" />
            <span
                v-if="modelValue === avatar"
                class="absolute top-1 right-1 bg-orange border-2 border-dark rounded-full p-0.5 flex items-center justify-center"
            >
                <Check :size="12" :stroke-width="3.5" class="text-dark" />
            </span>
        </button>
    </div>
</template>