<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Pencil, Check, X, LogOut, School } from 'lucide-vue-next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { profile, signOut, updateProfile } = useAuth()

const profileImageBucket = 'profile-images'
const maxAvatarSize = 5 * 1024 * 1024

// --- แก้ไขชื่อ-นามสกุล ---
const isEditingName = ref(false)
const editName = ref('')
const editLastname = ref('')
const savingName = ref(false)

function startEditName() {
    editName.value = profile.value.name
    editLastname.value = profile.value.lastname
    isEditingName.value = true
}
function cancelEditName() {
    isEditingName.value = false
}
async function saveEditName() {
    if (!editName.value.trim() || !editLastname.value.trim()) return
    savingName.value = true
    await updateProfile({
        name: editName.value.trim(),
        lastname: editLastname.value.trim()
    })
    savingName.value = false
    isEditingName.value = false
}

// --- เปลี่ยนรูปโปรไฟล์ ---
const uploadingAvatar = ref(false)
const avatarError = ref('')

async function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        avatarError.value = 'กรุณาเลือกรูป JPG, PNG หรือ WebP'
        event.target.value = ''
        return
    }
    if (file.size > maxAvatarSize) {
        avatarError.value = 'รูปโปรไฟล์ต้องมีขนาดไม่เกิน 5 MB'
        event.target.value = ''
        return
    }

    avatarError.value = ''
    uploadingAvatar.value = true

    try {
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

        const { data } = supabase.storage.from(profileImageBucket).getPublicUrl(filePath)
        await updateProfile({ img: data.publicUrl })
    } catch (err) {
        console.error('handleAvatarChange error:', err)
        avatarError.value = 'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    } finally {
        uploadingAvatar.value = false
        event.target.value = ''
    }
}

// --- ห้องเรียนที่เข้าร่วม/สอนอยู่ ---
const classrooms = ref([])
const loadingClassrooms = ref(true)

async function loadClassrooms() {
    const rpcName = profile.value.role === 'teacher' ? 'get_teacher_classrooms' : 'get_student_classrooms'
    const { data, error } = await supabase.rpc(rpcName)

    if (!error) {
        classrooms.value = data
    } else {
        console.error('loadClassrooms error:', error)
    }
    loadingClassrooms.value = false
}

async function handleSignOut() {
    await signOut()
    router.push('/login')
}

onMounted(loadClassrooms)
</script>

<template>
    <div class="bg-gray-light min-h-screen font-mitr">
        <div class="sticky top-0 z-30 bg-dark border-b-4 border-purple h-[90px] flex items-center gap-4 px-6">
            <button type="button" @click="router.back()"
                class="w-10 h-10 rounded-lg border-2 border-gray-500 flex items-center justify-center text-white hover:border-white hover:scale-110 transition-transform duration-200 shrink-0">
                <ArrowLeft :size="20" :stroke-width="2.5" />
            </button>
            <span class="font-mali font-bold text-lg text-white whitespace-nowrap">โปรไฟล์ของฉัน</span>
        </div>

        <main class="max-w-[600px] mx-auto px-6 py-10">
            <!-- การ์ดข้อมูลผู้ใช้ -->
            <div class="bg-white border-3 border-dark rounded-xl shadow-offset p-6 mb-6">
                <div class="flex flex-col items-center text-center mb-5">
                    <label class="relative cursor-pointer group">
                        <div
                            class="w-24 h-24 rounded-full border-3 border-dark overflow-hidden bg-purple-light shrink-0">
                            <img v-if="profile?.img" :src="profile.img" class="w-full h-full object-cover"
                                alt="avatar" />
                        </div>
                        <div
                            class="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Pencil :size="20" :stroke-width="2.5" class="text-white" />
                        </div>
                        <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only"
                            :disabled="uploadingAvatar" @change="handleAvatarChange" />
                    </label>
                    <p v-if="uploadingAvatar" class="text-[12px] text-gray-400 mt-2">กำลังอัปโหลด...</p>
                    <p v-if="avatarError" class="text-[12px] text-danger mt-2">{{ avatarError }}</p>

                    <div class="mt-4 w-full">
                        <div v-if="!isEditingName" class="flex items-center justify-center gap-2">
                            <h2 class="font-mali font-bold text-xl">{{ profile?.name }} {{ profile?.lastname }}</h2>
                            <button type="button" @click="startEditName"
                                class="w-7 h-7 rounded-full border-2 border-dark flex items-center justify-center hover:bg-gray-light shrink-0">
                                <Pencil :size="13" :stroke-width="2.5" />
                            </button>
                        </div>
                        <div v-else class="flex flex-col gap-2 items-center">
                            <div class="flex gap-2 w-full">
                                <input v-model="editName" type="text" placeholder="ชื่อ"
                                    class="flex-1 min-w-0 px-3 py-2 rounded-lg border-2 border-dark text-[14px] text-center" />
                                <input v-model="editLastname" type="text" placeholder="นามสกุล"
                                    class="flex-1 min-w-0 px-3 py-2 rounded-lg border-2 border-dark text-[14px] text-center" />
                            </div>
                            <div class="flex gap-2">
                                <button type="button" @click="saveEditName" :disabled="savingName"
                                    class="w-9 h-9 rounded-full border-2 border-dark bg-purple flex items-center justify-center hover:bg-purple-light disabled:opacity-50">
                                    <Check :size="16" :stroke-width="3" />
                                </button>
                                <button type="button" @click="cancelEditName"
                                    class="w-9 h-9 rounded-full border-2 border-dark bg-white flex items-center justify-center hover:bg-gray-light">
                                    <X :size="16" :stroke-width="3" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <span
                        class="mt-2 px-3 py-1 rounded-full bg-purple-light border-2 border-dark text-[12px] font-semibold">
                        {{ profile?.role === 'teacher' ? '🧑‍🏫 ครู' : '🎓 นักเรียน' }}
                    </span>
                    <p class="text-[13px] text-gray-400 mt-2">{{ profile?.email }}</p>
                </div>
            </div>

            <!-- รายชื่อห้องเรียน -->
            <div class="bg-white border-3 border-dark rounded-xl shadow-offset p-5 mb-6">
                <h3 class="font-mali font-bold text-[16px] mb-3">
                    {{ profile?.role === 'teacher' ? 'ห้องเรียนที่สอนอยู่' : 'ห้องเรียนที่เข้าร่วม' }}
                </h3>

                <div v-if="loadingClassrooms" class="text-center text-gray-400 text-[13px] py-4">กำลังโหลด...</div>
                <div v-else-if="classrooms.length === 0" class="text-center text-gray-400 text-[13px] py-4">
                    ยังไม่มีห้องเรียน
                </div>
                <ul v-else class="flex flex-col gap-2">
                    <li v-for="c in classrooms" :key="c.id"
                        class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-light border-2 border-gray-200">
                        <School :size="16" :stroke-width="2.5" class="text-purple shrink-0" />
                        <span class="text-[14px] font-medium truncate">{{ c.name }}</span>
                        <span v-if="c.grade_level" class="text-[12px] text-gray-400 whitespace-nowrap ml-auto">
                            {{ c.grade_level }}
                        </span>
                    </li>
                </ul>
            </div>

            <!-- ออกจากระบบ -->
            <button type="button" @click="handleSignOut"
                class="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border-3 border-dark bg-white shadow-offset text-red-600 font-semibold hover:bg-red-50 transition-colors">
                <LogOut :size="18" :stroke-width="2.5" />
                ออกจากระบบ
            </button>
        </main>
    </div>
</template>