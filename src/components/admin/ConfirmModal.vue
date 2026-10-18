<script setup>
import { ref, watch, nextTick } from 'vue'
import { AlertTriangle, X } from 'lucide-vue-next'

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: 'ยืนยันการทำรายการ?' },
    confirmText: { type: String, default: 'ยืนยัน' },
    cancelText: { type: String, default: 'ยกเลิก' },
    danger: { type: Boolean, default: false },
    loading: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const cancelBtn = ref(null)

function close() {
    if (props.loading) return
    emit('update:modelValue', false)
}

// เปิดแล้วโฟกัสที่ปุ่ม "ยกเลิก" ก่อน กันเผลอกด Enter ยืนยัน
watch(
    () => props.modelValue,
    async (open) => {
        if (!open) return
        await nextTick()
        cancelBtn.value?.focus()
    }
)
</script>

<template>
    <Teleport to="body">
        <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0"
            enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100" leave-to-class="opacity-0">
            <div v-if="modelValue"
                class="fixed inset-0 z-50 bg-dark/50 backdrop-blur-[2px] flex items-center justify-center p-4"
                @click.self="close" @keydown.esc="close">

                <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"
                    class="relative w-full max-w-[400px] bg-white border-3 border-dark rounded-2xl shadow-offset
                           px-6 pt-8 pb-6 font-mitr text-center animate-[modalIn_0.2s_ease-out]">

                    <button type="button" @click="close" :disabled="loading" aria-label="ปิด"
                        class="absolute top-3.5 right-3.5 w-8 h-8 rounded-full border-2 border-dark bg-white
                               flex items-center justify-center hover:bg-gray-light disabled:opacity-50 transition">
                        <X :size="14" :stroke-width="3" />
                    </button>

                    <div class="mx-auto w-16 h-16 rounded-full border-3 border-dark shadow-offset flex items-center justify-center"
                        :class="danger ? 'bg-red-200' : 'bg-purple-light'">
                        <AlertTriangle :size="26" :stroke-width="2.5" :class="danger ? 'text-red-600' : 'text-dark'" />
                    </div>

                    <h3 id="confirm-title" class="font-mali font-bold text-[20px] text-dark mt-6">{{ title }}</h3>
                    <div class="text-[13px] text-gray mt-2 break-words">
                        <slot />
                    </div>

                    <div class="flex gap-3 mt-6">
                        <button ref="cancelBtn" type="button" @click="close" :disabled="loading"
                            class="flex-1 px-4 py-2.5 rounded-xl border-2 border-dark bg-white text-dark text-[13.5px] font-bold
                                   shadow-[3px_3px_0_0_#1a1a1a] hover:-translate-y-0.5 hover:bg-gray-light
                                   active:translate-y-0.5 active:shadow-none disabled:opacity-50 transition">
                            {{ cancelText }}
                        </button>
                        <button type="button" @click="emit('confirm')" :disabled="loading"
                            class="flex-1 px-4 py-2.5 rounded-xl border-2 border-dark text-[13.5px] font-bold
                                   shadow-[3px_3px_0_0_#1a1a1a] hover:-translate-y-0.5
                                   active:translate-y-0.5 active:shadow-none disabled:opacity-50 transition"
                            :class="danger
                                ? 'bg-red-600 text-white hover:bg-red-700'
                                : 'bg-purple text-dark hover:bg-purple-light'">
                            {{ loading ? 'กำลังดำเนินการ...' : confirmText }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>