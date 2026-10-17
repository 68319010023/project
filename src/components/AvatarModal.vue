<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { X, Upload, Camera } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'
import AvatarPicker from './AvatarPicker.vue'

const props = defineProps({
    modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const { profile, updateProfile } = useAuth()

const profileImageBucket = 'profile-images'
const maxAvatarSize = 5 * 1024 * 1024

const avatarInitials = computed(
    () => (profile.value?.name?.[0] ?? '') + (profile.value?.lastname?.[0] ?? '')
)

const pendingAvatar = ref(null) // path อวตาร หรือ blob URL ของรูปที่เพิ่งเลือก
const pendingFile = ref(null) // ไฟล์ที่อัปโหลดเอง (ถ้ามี)
const pendingPreview = ref(null) // blob URL สำหรับพรีวิว
const saving = ref(false)
const errorMsg = ref('')
const cancelBtn = ref(null)

const canSave = computed(
    () =>
        !!profile.value &&
        !!pendingAvatar.value &&
        pendingAvatar.value !== profile.value.img &&
        !saving.value
)

function revokePreview() {
    if (pendingPreview.value) {
        URL.revokeObjectURL(pendingPreview.value)
        pendingPreview.value = null
    }
}

function close() {
    if (saving.value) return // ปิดไม่ได้ระหว่างกำลังบันทึก
    emit('update:modelValue', false)
}

function onKeydown(e) {
    if (e.key === 'Escape') close()
}

// เปิด: เตรียมค่า + โฟกัสปุ่มยกเลิก / ปิด: ล้างค่า
watch(
    () => props.modelValue,
    async (open) => {
        if (open) {
            errorMsg.value = ''
            pendingFile.value = null
            revokePreview()
            pendingAvatar.value = profile.value?.img ?? null
            window.addEventListener('keydown', onKeydown)
            document.body.style.overflow = 'hidden'
            await nextTick()
            cancelBtn.value?.focus()
        } else {
            window.removeEventListener('keydown', onKeydown)
            document.body.style.overflow = ''
            revokePreview()
            pendingFile.value = null
            pendingAvatar.value = null
            errorMsg.value = ''
        }
    }
)

onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
    revokePreview()
})

function selectPresetAvatar(path) {
    pendingFile.value = null
    revokePreview()
    errorMsg.value = ''
    pendingAvatar.value = path
}

function handleCustomAvatarChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        errorMsg.value = 'กรุณาเลือกรูป JPG, PNG หรือ WebP'
        event.target.value = ''
        return
    }
    if (file.size > maxAvatarSize) {
        errorMsg.value = 'รูปโปรไฟล์ต้องมีขนาดไม่เกิน 5 MB'
        event.target.value = ''
        return
    }

    errorMsg.value = ''
    revokePreview()
    pendingFile.value = file
    pendingPreview.value = URL.createObjectURL(file)
    pendingAvatar.value = pendingPreview.value
    event.target.value = ''
}

async function save() {
    if (!canSave.value) return

    errorMsg.value = ''
    saving.value = true

    try {
        let url = pendingAvatar.value

        if (pendingFile.value) {
            const file = pendingFile.value
            const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
            const filePath = `${profile.value.id}/${crypto.randomUUID()}.${extension}`

            const { error: uploadError } = await supabase.storage
                .from(profileImageBucket)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    contentType: file.type,
                    upsert: false
                })
            if (uploadError) throw uploadError

            url = supabase.storage.from(profileImageBucket).getPublicUrl(filePath).data.publicUrl
        }

        const res = await updateProfile({ img: url })
        if (res?.error) throw res.error

        saving.value = false
        emit('update:modelValue', false)
    } catch (err) {
        console.error('save avatar error:', err)
        errorMsg.value = 'บันทึกรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    } finally {
        saving.value = false
    }
}
</script>

<template>
    <Teleport to="body">
        <div v-if="modelValue"
            class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            @click.self="close">
            <div role="dialog" aria-modal="true" aria-labelledby="avatar-modal-title"
                class="w-full max-w-[460px] max-h-[90vh] flex flex-col overflow-hidden bg-white border-3 border-dark
                       rounded-2xl shadow-offset font-mitr animate-[modalIn_0.2s_ease-out]">

                <!-- หัวข้อ -->
                <div class="shrink-0 flex items-center justify-between gap-3 px-6 py-4 bg-purple-light border-b-3 border-dark">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-9 h-9 shrink-0 rounded-xl border-2 border-dark bg-white flex items-center justify-center">
                            <Camera :size="18" :stroke-width="2.5" class="text-dark" />
                        </div>
                        <h2 id="avatar-modal-title" class="font-mali font-bold text-[17px] text-dark truncate">
                            เปลี่ยนรูปโปรไฟล์
                        </h2>
                    </div>
                    <button type="button" @click="close" :disabled="saving" aria-label="ปิด"
                        class="shrink-0 w-8 h-8 rounded-full border-2 border-dark bg-white flex items-center justify-center
                               hover:bg-orange disabled:opacity-40 disabled:pointer-events-none transition">
                        <X :size="14" :stroke-width="3" />
                    </button>
                </div>

                <!-- เนื้อหา (เลื่อนได้ถ้าจอเตี้ย) -->
                <div class="overflow-y-auto p-6 flex flex-col gap-5">

                    <!-- ตัวอย่าง -->
                    <div class="flex items-center gap-4">
                        <div class="w-20 h-20 shrink-0 rounded-full border-3 border-dark overflow-hidden bg-purple-light
                                    flex items-center justify-center font-mali font-bold text-xl text-dark">
                            <img v-if="pendingAvatar" :src="pendingAvatar" class="w-full h-full object-cover"
                                alt="ตัวอย่างรูปโปรไฟล์" />
                            <span v-else>{{ avatarInitials }}</span>
                        </div>
                        <div class="min-w-0">
                            <p class="font-semibold text-[14.5px] text-dark truncate">
                                {{ profile?.name }} {{ profile?.lastname }}
                            </p>
                            <p class="text-[12.5px] text-gray mt-0.5">
                                {{ pendingFile ? 'รูปที่คุณอัปโหลด' : 'ตัวอย่างรูปโปรไฟล์' }}
                            </p>
                        </div>
                    </div>

                    <!-- อวตาร -->
                    <div class="flex flex-col gap-2.5">
                        <p class="text-[12px] font-semibold text-dark">เลือกอวตาร</p>
                        <AvatarPicker :model-value="pendingAvatar" @update:model-value="selectPresetAvatar" />
                    </div>

                    <div class="flex items-center gap-3" aria-hidden="true">
                        <span class="flex-1 h-0.5 bg-dark/10"></span>
                        <span class="text-[11.5px] text-gray">หรือ</span>
                        <span class="flex-1 h-0.5 bg-dark/10"></span>
                    </div>

                    <!-- อัปโหลดเอง -->
                    <label class="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-dark cursor-pointer
                                  hover:bg-gray-light transition focus-within:ring-2 focus-within:ring-purple"
                        :class="saving && 'opacity-50 pointer-events-none'">
                        <img v-if="pendingPreview" :src="pendingPreview"
                            class="w-11 h-11 shrink-0 rounded-lg border-2 border-dark object-cover" alt="รูปที่อัปโหลด" />
                        <div v-else
                            class="w-11 h-11 shrink-0 rounded-lg border-2 border-dark bg-orange flex items-center justify-center">
                            <Upload :size="18" :stroke-width="2.5" class="text-dark" />
                        </div>
                        <div class="min-w-0 flex-1">
                            <p class="text-[13.5px] font-semibold text-dark">
                                {{ pendingPreview ? 'เลือกไฟล์อื่น' : 'อัปโหลดรูปของฉัน' }}
                            </p>
                            <p class="text-[11.5px] text-gray">JPG, PNG หรือ WebP ไม่เกิน 5 MB</p>
                        </div>
                        <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only"
                            :disabled="saving" @change="handleCustomAvatarChange" />
                    </label>

                    <p v-if="errorMsg" role="status"
                        class="text-[12.5px] text-red-600 border-2 border-red-600 bg-red-50 rounded-xl px-3.5 py-2.5">
                        {{ errorMsg }}
                    </p>
                </div>

                <!-- ปุ่ม -->
                <div class="shrink-0 flex gap-3 px-6 py-4 border-t-2 border-dark/10 bg-gray-light">
                    <button ref="cancelBtn" type="button" @click="close" :disabled="saving"
                        class="flex-1 px-5 py-2.5 rounded-xl border-2 border-dark bg-white text-dark text-[13px] font-bold
                               hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none transition">
                        ยกเลิก
                    </button>
                    <button type="button" @click="save" :disabled="!canSave"
                        class="flex-1 px-5 py-2.5 rounded-xl border-2 border-dark bg-purple text-dark text-[13px] font-bold
                               shadow-[3px_3px_0_0_#1a1a1a] hover:-translate-y-0.5
                               active:translate-y-0.5 active:shadow-none
                               disabled:opacity-40 disabled:shadow-none disabled:pointer-events-none transition">
                        {{ saving ? 'กำลังบันทึก...' : 'บันทึกรูป' }}
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>