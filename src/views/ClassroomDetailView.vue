<script setup>
import { useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import TeacherClassroomDetail from './teacher/ClassroomDetail.vue'
import StudentClassroomDetail from './student/ClassroomDetail.vue'

const route = useRoute()
const { profile } = useAuth()
</script>

<template>
  <TeacherClassroomDetail
    v-if="profile?.role === 'teacher'"
    :classroom-id="route.params.id"
  />
  <StudentClassroomDetail
    v-else
    :classroom-id="route.params.id"
  />
</template>