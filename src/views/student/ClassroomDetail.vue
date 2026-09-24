<script setup>
import { ref, onMounted } from 'vue'
import { useClassroomDetail } from '../../composables/useClassroomDetail.js'
import { useAuth } from '../../composables/useAuth.js'
import AppNavbar from '../../components/AppNavbar.vue'
import HeroSection from '../../components/HeroSection.vue'
import TabNav from '../../components/TabNav.vue'
import Overview from '../../components/ClassroomOverview.vue'
import Members from '../../components/student/Members.vue'
import Assignments from '../../components/student/Assignments.vue'

const props = defineProps({
  classroomId: { type: String, required: true },
})

const {
  classroom, loading,
  members, membersLoading,
  assignments, assignmentsLoading,
  submissions, submissionsLoading,
  quizzes, quizzesLoading,
  quizSubmissions, quizSubmissionsLoading,
  memberCount, assignmentCount, dueSoonCount,
  mySubmittedCount, upcomingAssignments, isLate,
  loadAll, loadQuizzes, loadQuizSubmissions,
  formatDate,
} = useClassroomDetail(props.classroomId)

const { user } = useAuth()

const activeTab = ref('overview')

function mySubmissionFor(assignmentId) {
  return submissions.value.find(
    (s) => s.assignment_id === assignmentId && s.student_id === user.value?.id
  )
}

function myQuizSubmissionFor(quizId) {
  return quizSubmissions.value.find(
    (s) => s.quiz_id === quizId && s.student_id === user.value?.id
  )
}

onMounted(async () => {
  loadAll()
  await loadQuizzes()
  await loadQuizSubmissions()
})
</script>

<template>
  <div class="bg-gray-light min-h-screen font-mitr">
    <AppNavbar :show-search="false" :breadcrumb="[
      { label: 'หน้ารวมห้องเรียน', to: '/student' },
      { label: classroom?.name ?? '...' }
    ]" />

    <!-- Skeleton loading: เลียนแบบโครงหน้าจริง (hero + tab + content) -->
    <div v-if="loading" class="animate-pulse">
      <div class="border-b-3 border-dark px-6 py-10 bg-gray-light">
        <div class="max-w-[1000px] mx-auto">
          <div class="h-8 w-48 bg-gray-300 rounded-lg"></div>
          <div class="h-5 w-24 bg-gray-300 rounded-full mt-3"></div>
        </div>
      </div>
      <div class="border-b-3 border-dark bg-white px-6 flex gap-6 max-w-[1000px] mx-auto">
        <div class="h-11 w-20 bg-gray-200 rounded my-3"></div>
        <div class="h-11 w-20 bg-gray-200 rounded my-3"></div>
        <div class="h-11 w-20 bg-gray-200 rounded my-3"></div>
      </div>
      <div class="max-w-[1000px] mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div v-for="n in 3" :key="n" class="h-[120px] border-3 border-dark rounded-xl bg-gray-light"></div>
      </div>
    </div>

    <div v-else-if="!classroom" class="flex flex-col items-center gap-4 text-center py-20">
      <p class="text-gray text-[15px]">ไม่พบห้องเรียนนี้</p>
      <router-link to="/student"
        class="px-5 py-2.5 rounded-lg border-2 border-dark bg-purple text-dark font-semibold text-[14px] shadow-offset-sm hover:-translate-y-0.5 transition">
        กลับหน้ารวมห้องเรียน
      </router-link>
    </div>

    <template v-else>

      <HeroSection :classroom="classroom" :classroom-id="classroomId" />

      <TabNav v-model:active-tab="activeTab" />
      <div v-reveal>
        <Overview v-if="activeTab === 'overview'" :classroom-id="classroomId" :member-count="memberCount"
          :assignment-count="assignmentCount" :submitted-count="user ? mySubmittedCount(user.id).value : 0"
          :due-soon-count="dueSoonCount" :upcoming-assignments="user ? upcomingAssignments(user.id).value : []"
          :loading="loading || membersLoading || assignmentsLoading || submissionsLoading"
          @go-tab="activeTab = $event" />

        <Members v-else-if="activeTab === 'members'" :classroom="classroom" :members="members"
          :members-loading="membersLoading" />

        <Assignments v-else-if="activeTab === 'assignments'" :classroom-id="classroomId" :assignments="assignments"
          :assignments-loading="assignmentsLoading" :submissions-loading="submissionsLoading"
          :my-submission-for="mySubmissionFor" :format-date="formatDate" :is-late="isLate" :quizzes="quizzes"
          :quizzes-loading="quizzesLoading || quizSubmissionsLoading" :my-quiz-submission-for="myQuizSubmissionFor" />
      </div>
    </template>
  </div>
</template>