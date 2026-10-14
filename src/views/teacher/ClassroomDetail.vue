<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth.js'
import { deleteClassroom } from '../../composables/classroomActions.js'
import DeleteModal from '../../components/teacher/DeleteModal.vue'
import EditClassroomModal from '../../components/teacher/EditModal.vue'
import { useClassroomDetail } from '../../composables/useClassroomDetail.js'
import AppNavbar from '../../components/AppNavbar.vue'
import HeroSection from '../../components/HeroSection.vue'
import TabNav from '../../components/TabNav.vue'
import Overview from '../../components/ClassroomOverview.vue'
import ClassroomMembers from '../../components/teacher/Members.vue'
import ClassroomAssignments from '../../components/teacher/Assignments.vue'

const props = defineProps({
  classroomId: { type: String, required: true },
})

const {
  classroom, loading,
  members, membersLoading, loadMembers,
  assignments, assignmentsLoading, loadAssignments,
  submissions, submissionsLoading, loadSubmissions,
  quizzes, quizzesLoading, loadQuizzes,
  quizSubmissions, quizSubmissionsLoading, loadQuizSubmissions,
  memberCount, assignmentCount, submittedCount, dueSoonCount,
  loadAll, fetchSubmissionItems,
  getSubmissionUrl, formatDate, isLate,
} = useClassroomDetail(props.classroomId)

const route = useRoute()
const router = useRouter()

const VALID_TABS = ['overview', 'members', 'assignments']
const initialTab = VALID_TABS.includes(route.query.tab) ? route.query.tab : 'overview'
const activeTab = ref(initialTab)

onMounted(async () => {
  await loadAll()
  await loadQuizzes()
  await loadQuizSubmissions()
})
const { profile } = useAuth()

// เฉพาะครูเจ้าของห้องเท่านั้นที่เห็นปุ่ม
const canManage = computed(
  () => !!classroom.value && classroom.value.teacher_id === profile.value?.id
)

// EditModal ใช้ชื่อ gradeLevel (camelCase) แต่ข้อมูลจาก DB เป็น grade_level
const classroomForModal = computed(() => classroom.value && {
  id: classroom.value.id,
  name: classroom.value.name,
  gradeLevel: classroom.value.grade_level,
})

// --- แก้ไข ---
const showEditModal = ref(false)

async function handleEditSaved() {
  showEditModal.value = false
  await loadAll() // โหลดชื่อ/ระดับชั้นใหม่ให้ส่วนหัวเปลี่ยนทันที
}

// --- ลบ ---
const showDeleteModal = ref(false)
const deleting = ref(false)
const deleteError = ref('')

function openDeleteModal() {
  deleteError.value = ''
  showDeleteModal.value = true
}

function closeDeleteModal() {
  if (deleting.value) return
  showDeleteModal.value = false
}

async function handleDeleteConfirm() {
  deleting.value = true
  deleteError.value = ''
  try {
    const result = await deleteClassroom(props.classroomId)
    if (!result.success) {
      deleteError.value = result.error
      return
    }
    showDeleteModal.value = false
    router.replace('/teacher') // ห้องนี้ไม่มีอยู่แล้ว กลับหน้ารวม
  } catch (err) {
    console.error('handleDeleteConfirm error:', err)
    deleteError.value = 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'
  } finally {
    deleting.value = false
  }
}

</script>

<template>
  <div class="bg-gray-light min-h-screen font-mitr">
    <AppNavbar :show-search="false" :breadcrumb="[
      { label: 'หน้ารวมห้องเรียน', to: '/teacher' },
      { label: classroom?.name ?? '...' }
    ]" />

    <div v-if="loading" class="text-gray text-center py-20">กำลังโหลด...</div>
    <div v-else-if="!classroom" class="text-gray text-center py-20">ไม่พบห้องเรียนนี้</div>

    <template v-else>
      <HeroSection :classroom="classroom" :classroom-id="classroomId" :can-manage="canManage"
        @edit="showEditModal = true" @delete="openDeleteModal" />

      <TabNav v-model:active-tab="activeTab" />

      <Overview v-if="activeTab === 'overview'" :classroom-id="classroomId" :member-count="memberCount"
        :assignment-count="assignmentCount" :submitted-count="submittedCount" :due-soon-count="dueSoonCount"
        submitted-label="งานที่ส่งเข้ามา"
        :loading="loading || membersLoading || assignmentsLoading || submissionsLoading" @go-tab="activeTab = $event" />

      <ClassroomMembers v-else-if="activeTab === 'members'" :classroom-id="classroomId"
        :class-code="classroom.class_code" :members="members" :members-loading="membersLoading"
        @reload-members="loadMembers" />

      <ClassroomAssignments v-else-if="activeTab === 'assignments'" :classroom-id="classroomId"
        :assignments="assignments" :assignments-loading="assignmentsLoading" :submissions="submissions"
        :submissions-loading="submissionsLoading" :quizzes="quizzes" :quizzes-loading="quizzesLoading"
        :quiz-submissions="quizSubmissions" :member-count="memberCount" :get-submission-url="getSubmissionUrl"
        :fetch-submission-items="fetchSubmissionItems" :format-date="formatDate" :is-late="isLate"
        @reload-assignments="loadAssignments" @reload-submissions="loadSubmissions"
        @reload-quizzes="() => { loadQuizzes(); loadQuizSubmissions() }" />
    </template>
    <EditClassroomModal v-if="showEditModal && classroomForModal" :classroom="classroomForModal"
      @saved="handleEditSaved" @close="showEditModal = false" />
    <DeleteModal v-if="showDeleteModal && classroomForModal" :classroom="classroomForModal" :loading="deleting"
      :error="deleteError" @confirm="handleDeleteConfirm" @close="closeDeleteModal" />
  </div>
</template>