<script setup>
import { ref, computed, onMounted } from 'vue'
import { useClassroomDetail } from '../../composables/useClassroomDetail.js'
import AssignmentModal from '../../components/teacher/AssignmentModal.vue'
import { supabase } from '../../lib/supabase'

const props = defineProps({
  classroomId: { type: String, required: true },
})

const {
  classroom, loading,
  members, membersLoading,
  assignments, assignmentsLoading,
  submissions, submissionsLoading,
  loadAll, loadMembers, loadAssignments, loadSubmissions,
  getSubmissionUrl,
  formatDate,
} = useClassroomDetail(props.classroomId)

const removingStudentId = ref(null)

async function removeMember(studentId, studentName) {
  const confirmed = confirm(`ต้องการลบ "${studentName}" ออกจากห้องเรียนใช่ไหม?`)
  if (!confirmed) return

  removingStudentId.value = studentId

  const { error } = await supabase
    .from('classroom_enrollments')
    .delete()
    .eq('classroom_id', props.classroomId)
    .eq('student_id', studentId)

  removingStudentId.value = null

  if (error) {
    console.error('removeMember error:', error)
    alert('ลบสมาชิกไม่สำเร็จ ลองใหม่อีกครั้ง')
    return
  }

  await loadMembers()
}

async function openSubmission(filePath) {
  const url = await getSubmissionUrl(filePath)
  if (url) {
    window.open(url, '_blank')
  } else {
    alert('เปิดไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง')
  }
}

const showCreateModal = ref(false)
const expandedAssignmentId = ref(null)

function submissionsFor(assignmentId) {
  return submissions.value.filter((s) => s.assignment_id === assignmentId)
}

function toggleExpand(assignmentId) {
  expandedAssignmentId.value = expandedAssignmentId.value === assignmentId ? null : assignmentId
}

async function handleCreated() {
  await loadAssignments()
  await loadSubmissions()
}

onMounted(loadAll)
</script>

<template>
  <div class="p-8">
    <div v-if="loading">กำลังโหลด...</div>
    <div v-else-if="!classroom">ไม่พบห้องเรียนนี้</div>
    <div v-else>
      <h1 class="font-mali text-2xl font-bold">{{ classroom.name }}</h1>
      <p class="text-gray mt-1">รหัสห้อง: {{ classroom.class_code }}</p>

      <section class="mt-8">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-mali text-xl font-bold">สมาชิกในห้อง</h2>
          <span class="text-sm text-gray">{{ members.length }} คน</span>
        </div>

        <div v-if="membersLoading">กำลังโหลดรายชื่อสมาชิก...</div>
        <div v-else-if="members.length === 0" class="text-gray">
          ยังไม่มีสมาชิกในห้องนี้
        </div>
        <ul v-else class="space-y-2">
          <li v-for="member in members" :key="member.student_id"
            class="border-2 border-black rounded-lg px-4 py-2 flex items-center justify-between">
            <span>{{ member.profiles?.name }} {{ member.profiles?.lastname }}</span>
            <button @click="removeMember(member.student_id, `${member.profiles?.name} ${member.profiles?.lastname}`)"
              :disabled="removingStudentId === member.student_id"
              class="text-red-600 text-sm font-bold underline disabled:opacity-40">
              {{ removingStudentId === member.student_id ? 'กำลังลบ...' : 'ลบออก' }}
            </button>
          </li>
        </ul>
      </section>

      <section class="mt-8">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-mali text-xl font-bold">การบ้าน</h2>
          <button @click="showCreateModal = true" class="border-2 border-black rounded-lg px-4 py-1 font-bold">
            + สร้างการบ้าน
          </button>
        </div>

        <div v-if="assignmentsLoading || submissionsLoading">กำลังโหลดการบ้าน...</div>
        <div v-else-if="assignments.length === 0" class="text-gray">
          ยังไม่มีการบ้านในห้องนี้
        </div>
        <ul v-else class="space-y-3">
          <li v-for="assignment in assignments" :key="assignment.id" class="border-2 border-black rounded-lg p-4">
            <div class="flex items-center justify-between cursor-pointer" @click="toggleExpand(assignment.id)">
              <div>
                <p class="font-bold">{{ assignment.title }}</p>
                <p v-if="assignment.description" class="text-sm text-gray mt-1">
                  {{ assignment.description }}
                </p>
                <p class="text-sm text-gray mt-1">
                  กำหนดส่ง: {{ formatDate(assignment.due_date) }}
                </p>
              </div>
              <span class="text-sm font-bold whitespace-nowrap ml-4">
                ส่งแล้ว {{ submissionsFor(assignment.id).length }}/{{ members.length }}
              </span>
            </div>

            <div v-if="expandedAssignmentId === assignment.id" class="mt-3 pt-3 border-t border-black">
              <p v-if="submissionsFor(assignment.id).length === 0" class="text-sm text-gray">
                ยังไม่มีใครส่งการบ้านชิ้นนี้
              </p>
              <ul v-else class="space-y-1">
                <li v-for="sub in submissionsFor(assignment.id)" :key="sub.id"
                  class="text-sm flex justify-between items-center">
                  <span>{{ sub.profiles?.name }} {{ sub.profiles?.lastname }}</span>
                  <div class="flex items-center gap-3">
                    <span class="text-gray">{{ formatDate(sub.submitted_at) }}</span>
                    <button @click="openSubmission(sub.file_url)" class="text-purple underline font-bold">
                      เปิดไฟล์
                    </button>
                  </div>
                </li>
              </ul>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <AssignmentModal v-if="showCreateModal" :classroom-id="classroomId" @close="showCreateModal = false"
      @created="handleCreated" />
  </div>
</template>