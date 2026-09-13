<script setup>
import { useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import TeacherClassroomDetailView from './teacher/TeacherClassroomDetailView.vue'
import StudentClassroomDetailView from './student/StudentClassroomDetailView.vue'

const route = useRoute()
const { profile } = useAuth()
</script>

<template>
  <TeacherClassroomDetailView
    v-if="profile?.role === 'teacher'"
    :classroom-id="route.params.id"
  />
  <StudentClassroomDetailView
    v-else
    :classroom-id="route.params.id"
  />
</template>