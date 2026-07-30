import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import StudentDashboard from '../views/student/StudentDashboard.vue'
import TeacherDashboard from '../views/teacher/TeacherDashboard.vue'
const routes = [
  { path: '/login', name: 'login', component: Login },
  { path: '/register', name: 'register', component: Register },
  { path: '/student-dashboard', component: StudentDashboard, meta: { role: 'student' } },
  { path: '/teacher-dashboard', component: TeacherDashboard, meta: { role: 'teacher' } }, 
  { path: '/ai-tutor',name: 'ai-tutor', component: () => import('../views/student/AiTutor.vue'),},
  { path: '/', redirect: '/login' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})


export default router