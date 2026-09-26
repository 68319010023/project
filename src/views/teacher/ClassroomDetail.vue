<script setup>
import { ref, onMounted } from 'vue'
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

const activeTab = ref('overview')

onMounted(async () => {
  await loadAll()
  await loadQuizzes()
  await loadQuizSubmissions()
})
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
      <HeroSection :classroom="classroom" :classroom-id="classroomId" />

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
  </div>
</template>