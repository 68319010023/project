<script setup>
import { ref, computed, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'
import { getClassroomColorById } from '../lib/classroomColors'
import ClassroomCard from './ClassroomCard.vue'
import DeleteModal from './teacher/DeleteModal.vue'
import EditClassroomModal from './teacher/EditModal.vue'
import { deleteClassroom } from '../composables/classroomActions.js'
import { Trash2, Pencil } from 'lucide-vue-next'
const hoveredDeleteId = ref(null)
const hoveredEditId = ref(null)
const emit = defineEmits(['open-create', 'open-join'])
const { profile } = useAuth()
const props = defineProps({
    searchQuery: { type: String, default: '' }
})
const classrooms = ref([])
const loading = ref(true)


const filteredClassrooms = computed(() => {
    if (!props.searchQuery.trim()) return classrooms.value
    const q = props.searchQuery.toLowerCase()
    return classrooms.value.filter(room => room.name.toLowerCase().startsWith(q))
})

// --- แก้ไขห้องเรียน (ครูเท่านั้น) ---
const showEditModal = ref(false)
const classroomToEdit = ref(null)

function openEditModal(room) {
    hoveredEditId.value = null
    classroomToEdit.value = room
    showEditModal.value = true
}

async function handleEditSaved() {
    showEditModal.value = false
    classroomToEdit.value = null
    await loadClassrooms()
}

async function loadTeacherClassrooms() {
    const { data: rooms, error } = await supabase.rpc('get_teacher_classrooms')

    if (error) {
        console.error('loadTeacherClassrooms error:', error)
        return []
    }

    return rooms.map((room) => {
        const badges = []
        if (room.ungraded > 0) badges.push({ label: `รอตรวจงาน ${room.ungraded}`, type: 'pending' })
        if (room.pending_requests > 0) badges.push({ label: `คำขอเข้าร่วม ${room.pending_requests}`, type: 'alert' })

        return {
            id: room.id,
            name: room.name,
            gradeLevel: room.grade_level,
            teacherName: `${profile.value.name} ${profile.value.lastname}`,
            avatarImg: profile.value.img,
            memberCount: room.member_count ?? 0,
            badges,
            emptyLabel: 'ไม่มีงานให้ตรวจ',
            ...getColorPair(room.id)
        }
    })
}

async function loadStudentClassrooms() {
    const { data: rooms, error } = await supabase.rpc('get_student_classrooms')

    if (error) {
        console.error('loadStudentClassrooms error:', error)
        return []
    }

    return rooms.map((room, index) => {
        const badges = room.pending_count > 0
            ? [{ label: `งานที่ต้องส่ง ${room.pending_count}`, type: 'pending' }]
            : [{ label: 'ส่งครบแล้ว', type: 'done' }]

        return {
            id: room.id,
            name: room.name,
            gradeLevel: room.grade_level,
            teacherName: room.teacher_name,
            avatarImg: room.teacher_img,
            memberCount: room.member_count ?? 0,
            badges,
            emptyLabel: 'ไม่มีงานให้ส่ง',
            ...getColorPair(room.id)
        }
    })
}
function getColorPair(id) {
    const { from, to } = getClassroomColorById(id)
    return { colorFrom: from, colorTo: to }
}

async function loadClassrooms() {
    loading.value = true
    try {
        classrooms.value = profile.value.role === 'teacher'
            ? await loadTeacherClassrooms()
            : await loadStudentClassrooms()
    } catch (err) {
        console.error('loadClassrooms unexpected error:', err)
        classrooms.value = []
    } finally {
        loading.value = false
    }
}

watch(() => profile.value?.id, (id) => {
    if (!id) return
    loadClassrooms()
}, { immediate: true })

// --- ลบห้องเรียน (ครูเท่านั้น) ---
const showDeleteModal = ref(false)
const classroomToDelete = ref(null)
const deleting = ref(false)
const deleteError = ref('')

function openDeleteModal(room) {
    hoveredDeleteId.value = null
    classroomToDelete.value = room
    deleteError.value = ''
    showDeleteModal.value = true
}

function closeDeleteModal() {
    if (deleting.value) return
    showDeleteModal.value = false
}

async function handleDeleteConfirm() {
    if (!classroomToDelete.value) return

    deleting.value = true
    deleteError.value = ''

    try {
        const result = await deleteClassroom(classroomToDelete.value.id)

        if (!result.success) {
            deleteError.value = result.error
            return
        }

        showDeleteModal.value = false
        classroomToDelete.value = null
        await loadClassrooms()
    } catch (err) {
        console.error('handleDeleteConfirm error:', err)
        deleteError.value = 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'
    } finally {
        deleting.value = false
    }
}
</script>

<template>

    <div v-if="loading" class="grid gap-7 animate-pulse"
        style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
        <div v-for="n in 3" :key="n" class="h-[180px] border-3 border-dark rounded-2xl bg-gray-light"></div>
    </div>

    <template v-else>
        <div class="grid gap-7" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
            <div v-for="room in filteredClassrooms" :key="room.id"
                class="relative group transition-transform duration-200"
                :class="(hoveredDeleteId === room.id || hoveredEditId === room.id) ? '-translate-x-0.5 -translate-y-0.5' : ''">
                <router-link :to="`/classroom/${room.id}`" class="block">
                    <ClassroomCard v-bind="room" />
                </router-link>


                <div class="pointer-events-none absolute inset-0 z-[5] rounded-2xl border-4 border-red-500 bg-red-500/10
                shadow-[6px_6px_0_0_#ef4444] transition-opacity duration-200"
                    :class="hoveredDeleteId === room.id ? 'opacity-100' : 'opacity-0'" />

                <div class="pointer-events-none absolute inset-0 z-[5] rounded-2xl border-4 border-purple bg-purple-light/30
            transition-opacity duration-200" :class="hoveredEditId === room.id ? 'opacity-100' : 'opacity-0'" />

                <div v-if="profile?.role === 'teacher'" class="absolute top-3 right-3 z-10 flex gap-1.5">
                    <button type="button" title="แก้ไขห้องเรียน" @click="openEditModal(room)"
                        @mouseenter="hoveredEditId = room.id" @mouseleave="hoveredEditId = null"
                        @focus="hoveredEditId = room.id" @blur="hoveredEditId = null" class="w-8 h-8 rounded-full border-2 flex items-center justify-center
       md:opacity-0 md:translate-x-4
       md:group-hover:transition-all md:group-hover:duration-300 md:group-hover:ease-out md:group-hover:delay-75
       md:group-hover:opacity-100 md:group-hover:translate-x-0
        md:focus-visible:transition-all md:focus-visible:duration-300
       md:focus-visible:opacity-100 md:focus-visible:translate-x-0" :class="hoveredEditId === room.id
        ? 'bg-purple border-dark text-dark scale-110'
        : 'bg-white/70 border-dark text-dark'">
                        <Pencil :size="14" :stroke-width="2.5" class="transition-transform duration-200"
                            :class="hoveredEditId === room.id ? '-rotate-12' : ''" />
                    </button>

                    <button type="button" title="ลบห้องเรียน" @click="openDeleteModal(room)"
                        @mouseenter="hoveredDeleteId = room.id" @mouseleave="hoveredDeleteId = null"
                        @focus="hoveredDeleteId = room.id" @blur="hoveredDeleteId = null" class="w-8 h-8 rounded-full flex items-center justify-center border-dark border-2
       md:opacity-0 md:translate-x-4
       md:group-hover:transition-all md:group-hover:duration-300 md:group-hover:ease-out
       md:group-hover:opacity-100 md:group-hover:translate-x-0
        md:focus-visible:transition-all md:focus-visible:duration-300
       md:focus-visible:opacity-100 md:focus-visible:translate-x-0"" :class="hoveredDeleteId === room.id
        ? 'bg-red-500 text-white' : 'bg-white/70 text-dark'">
                        <Trash2 :size="15" :stroke-width="2.5" />
                    </button>
                </div>
            </div>

            <button v-if="classrooms.length === 0" type="button"
                @click="emit(profile?.role === 'teacher' ? 'open-create' : 'open-join')"
                class="border-3 border-dashed border-dark rounded-2xl min-h-[180px] flex flex-col items-center justify-center gap-2 text-gray hover:bg-purple-light transition">
                <span class="text-3xl">➕</span>
                <span class="text-[14px] font-semibold">
                    {{ profile?.role === 'teacher' ? 'สร้างห้องเรียนใหม่' : 'เข้าร่วมห้องเรียน' }}
                </span>
            </button>
        </div>

        <p v-if="filteredClassrooms.length === 0" class="text-center text-gray text-[14px] mt-8">
            {{ searchQuery.trim()
                ? 'ไม่พบห้องเรียนที่ค้นหา'
                : `ยังไม่มีห้องเรียน ${profile?.role === 'teacher' ? 'ลองสร้างห้องแรกของคุณเลย!' :
                    'ลองเข้าร่วมด้วยรหัสจากครูผู้สอน'}` }}
        </p>

        <DeleteModal v-if="showDeleteModal && classroomToDelete" :classroom="classroomToDelete" :loading="deleting"
            :error="deleteError" @confirm="handleDeleteConfirm" @close="closeDeleteModal" />
        <EditClassroomModal v-if="showEditModal && classroomToEdit" :classroom="classroomToEdit"
            @saved="handleEditSaved" @close="showEditModal = false" />
    </template>
</template>