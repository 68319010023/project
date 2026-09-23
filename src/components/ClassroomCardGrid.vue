<script setup>
import { ref, computed, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'
import { getClassroomColorByIndex } from '../lib/classroomColors'
import ClassroomCard from './ClassroomCard.vue'

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

async function loadTeacherClassrooms() {
    const { data: rooms, error } = await supabase.rpc('get_teacher_classrooms')

    if (error) {
        console.error('loadTeacherClassrooms error:', error)
        return []
    }

    return rooms.map((room, index) => {
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
            ...getColorPair(index)
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
            ...getColorPair(index)
        }
    })
}

function getColorPair(index) {
    const { from, to } = getClassroomColorByIndex(index)
    return { colorFrom: from, colorTo: to }
}

watch(() => profile.value?.id, async (id) => {
    if (!id) return
    loading.value = true
    classrooms.value = profile.value.role === 'teacher'
        ? await loadTeacherClassrooms()
        : await loadStudentClassrooms()
    loading.value = false
}, { immediate: true })
</script>

<template>
    <!-- Skeleton loading: กรอบการ์ดเปล่า ให้ pattern เดียวกับ ClassroomDetail -->
    <div v-if="loading" class="grid gap-7 animate-pulse" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
        <div v-for="n in 3" :key="n" class="h-[180px] border-3 border-dark rounded-2xl bg-gray-light"></div>
    </div>

    <template v-else>
        <div class="grid gap-7" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
            <router-link v-for="room in filteredClassrooms" :key="room.id" :to="`/classroom/${room.id}`">
                <ClassroomCard v-bind="room" />
            </router-link>

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
    </template>
</template>