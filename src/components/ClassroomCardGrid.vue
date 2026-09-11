<script setup>
import { ref, watch } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuth } from '../composables/useAuth'
import { getClassroomColor } from '../lib/classroomColors'
import ClassroomCard from './ClassroomCard.vue'

const emit = defineEmits(['open-create', 'open-join'])
const { profile } = useAuth()

const classrooms = ref([])
const loading = ref(true)

async function loadTeacherClassrooms() {
    const { data: rooms } = await supabase
        .from('classrooms')
        .select('id, name, class_code')
        .eq('teacher_id', profile.value.id)
        .order('created_at', { ascending: false })

    if (!rooms) return []

    return Promise.all(rooms.map(async (room) => {
        const [{ count: memberCount }, { count: pendingRequests }] = await Promise.all([
            supabase.from('classroom_enrollments').select('*', { count: 'exact', head: true })
                .eq('classroom_id', room.id).eq('status', 'accepted'),
            supabase.from('classroom_enrollments').select('*', { count: 'exact', head: true })
                .eq('classroom_id', room.id).eq('status', 'pending'),
        ])

        // นับงานที่ยังไม่ได้ตรวจ (score IS NULL) ของห้องนี้
        const { count: ungraded } = await supabase
            .from('assignment_submissions')
            .select('id, assignments!inner(classroom_id)', { count: 'exact', head: true })
            .is('score', null)
            .eq('assignments.classroom_id', room.id)

        const badges = []
        if (ungraded > 0) badges.push({ label: `รอตรวจงาน ${ungraded}`, type: 'pending' })
        if (pendingRequests > 0) badges.push({ label: `คำขอเข้าร่วม ${pendingRequests}`, type: 'alert' })

        return {
            name: room.name,
            code: room.class_code,
            subLabel: `รหัสห้อง: ${room.class_code}`,
            memberCount: memberCount ?? 0,
            badges,
            ...getColorPair(room.id)
        }
    }))
}

async function loadStudentClassrooms() {
    const { data: enrollments } = await supabase
        .from('classroom_enrollments')
        .select('classroom_id, classrooms(id, name, class_code, profiles:teacher_id(name, lastname))')
        .eq('student_id', profile.value.id)
        .eq('status', 'accepted')

    if (!enrollments) return []

    return Promise.all(enrollments.map(async (enr) => {
        const room = enr.classrooms
        const [{ data: assignments }, { count: memberCount }] = await Promise.all([
            supabase.from('assignments').select('id').eq('classroom_id', room.id),
            supabase.from('classroom_enrollments').select('*', { count: 'exact', head: true })
                .eq('classroom_id', room.id).eq('status', 'accepted'),
        ])

        const assignmentIds = (assignments ?? []).map(a => a.id)
        let pendingCount = 0
        if (assignmentIds.length > 0) {
            const { data: submitted } = await supabase
                .from('assignment_submissions')
                .select('assignment_id')
                .eq('student_id', profile.value.id)
                .in('assignment_id', assignmentIds)
            const submittedIds = new Set((submitted ?? []).map(s => s.assignment_id))
            pendingCount = assignmentIds.filter(id => !submittedIds.has(id)).length
        }

        const badges = pendingCount > 0
            ? [{ label: `งานที่ต้องส่ง ${pendingCount}`, type: 'pending' }]
            : [{ label: 'ส่งครบแล้ว', type: 'done' }]

        const teacherName = room.profiles ? `ครู${room.profiles.name} ${room.profiles.lastname}` : ''

        return {
            name: room.name,
            code: room.class_code,
            subLabel: teacherName,
            memberCount: memberCount ?? 0,
            badges,
            ...getColorPair(room.id)
        }
    }))
}

function getColorPair(seed) {
    const { from, to } = getClassroomColor(seed)
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
    <div class="grid gap-7" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">
        <ClassroomCard v-for="room in classrooms" :key="room.code" v-bind="room" />

        <button type="button"
            @click="emit(profile?.role === 'teacher' ? 'open-create' : 'open-join')"
            class="border-3 border-dashed border-dark rounded-2xl min-h-[180px] flex flex-col items-center justify-center gap-2 text-gray hover:bg-purple-light transition">
            <span class="text-3xl">➕</span>
            <span class="text-[14px] font-semibold">
                {{ profile?.role === 'teacher' ? 'สร้างห้องเรียนใหม่' : 'เข้าร่วมห้องเรียน' }}
            </span>
        </button>
    </div>

    <p v-if="!loading && classrooms.length === 0" class="text-center text-gray text-[14px] mt-8">
        ยังไม่มีห้องเรียน {{ profile?.role === 'teacher' ? 'ลองสร้างห้องแรกของคุณเลย!' : 'ลองเข้าร่วมด้วยรหัสจากครูผู้สอน' }}
    </p>
</template>