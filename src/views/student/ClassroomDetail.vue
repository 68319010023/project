<script setup>
import { ref, onMounted } from 'vue'
import { useClassroomDetail } from '../../composables/useClassroomDetail.js'
import { useAuth } from '../../composables/useAuth.js'
import SubmitModal from '../../components/student/SubmitModal.vue'

const props = defineProps({
  classroomId: { type: String, required: true },
})

const {
  classroom, loading,
  members, membersLoading,
  assignments, assignmentsLoading,
  submissions, submissionsLoading,
  loadAll, loadSubmissions,
  formatDate,
} = useClassroomDetail(props.classroomId)

const { user } = useAuth()
const submittingAssignmentId = ref(null)

function mySubmissionFor(assignmentId) {
  return submissions.value.find(
    (s) => s.assignment_id === assignmentId && s.student_id === user.value?.id
  )
}

async function handleSubmitted() {
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
      <p class="text-gray text-sm mt-1">
        ครูผู้สอน: {{ classroom.profiles?.name }} {{ classroom.profiles?.lastname }}
      </p>

      <section class="mt-8">
        <h2 class="font-mali text-xl font-bold mb-3">เพื่อนร่วมห้อง</h2>

        <div v-if="membersLoading">กำลังโหลดรายชื่อ...</div>
        <div v-else-if="members.length === 0" class="text-gray">
          ยังไม่มีเพื่อนในห้องนี้
        </div>
        <ul v-else class="space-y-2">
          <li
            v-for="member in members"
            :key="member.student_id"
            class="border-2 border-black rounded-lg px-4 py-2"
          >
            {{ member.profiles?.name }} {{ member.profiles?.lastname }}
          </li>
        </ul>
      </section>

      <section class="mt-8">
        <h2 class="font-mali text-xl font-bold mb-3">การบ้าน</h2>

        <div v-if="assignmentsLoading || submissionsLoading">กำลังโหลดการบ้าน...</div>
        <div v-else-if="assignments.length === 0" class="text-gray">
          ยังไม่มีการบ้านในห้องนี้
        </div>
        <ul v-else class="space-y-3">
          <li
            v-for="assignment in assignments"
            :key="assignment.id"
            class="border-2 border-black rounded-lg p-4 flex items-center justify-between"
          >
            <div>
              <p class="font-bold">{{ assignment.title }}</p>
              <p v-if="assignment.description" class="text-sm text-gray mt-1">
                {{ assignment.description }}
              </p>
              <p class="text-sm text-gray mt-1">
                กำหนดส่ง: {{ formatDate(assignment.due_date) }}
              </p>
              <p v-if="mySubmissionFor(assignment.id)" class="text-sm text-green-700 font-bold mt-1">
                ✓ ส่งแล้ว ({{ mySubmissionFor(assignment.id).original_filename }})
              </p>
            </div>
            <button
              @click="submittingAssignmentId = assignment.id"
              class="border-2 border-black rounded-lg px-4 py-1 font-bold whitespace-nowrap"
            >
              {{ mySubmissionFor(assignment.id) ? 'ส่งใหม่' : 'ส่งการบ้าน' }}
            </button>
          </li>
        </ul>
      </section>
    </div>

    <SubmitModal
      v-if="submittingAssignmentId"
      :assignment-id="submittingAssignmentId"
      @close="submittingAssignmentId = null"
      @submitted="handleSubmitted"
    />
  </div>
</template>