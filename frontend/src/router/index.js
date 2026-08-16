import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../supabase'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import StudentDashboard from '../views/student/StudentDashboard.vue'
import TeacherDashboard from '../views/teacher/TeacherDashboard.vue'

const routes = [
  { path: '/login', name: 'login', component: Login, meta: { public: true } },
  { path: '/register', name: 'register', component: Register, meta: { public: true } },
  { path: '/student-dashboard', component: StudentDashboard, meta: { role: 'student' } },
  { path: '/teacher-dashboard', component: TeacherDashboard, meta: { role: 'teacher' } },
  { path: '/ai-tutor', name: 'ai-tutor', component: () => import('../views/student/AiTutor.vue') },
  { path: '/', redirect: '/login' },
  { path: '/classrooms/:id', name: 'classroom-detail', component: () => import('../views/ClassroomDetail.vue') },
  { path: '/classrooms/:id/assignments/:assignmentId', name: 'assignment-detail', component: () => import('../views/AssignmentDetail.vue') },
  { path: '/profile', name: 'profile', component: () => import('../views/Profile.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})



router.beforeEach(async (to) => {
  // ใช้ getSession() ไม่ใช่ getUser() ตอนเช็คตอน guard
  // เพราะ getSession() อ่านจาก local storage ตรงๆ ไม่ต้องรอ network round-trip ไป verify กับ server
  const { data: { session } } = await supabase.auth.getSession()
  const isLoggedIn = !!session

  if (!to.meta.public && !isLoggedIn) {
    // หน้านี้ต้อง login แต่ยังไม่ login -> เด้งไป login
    return '/login'
  }

  if (to.meta.public && isLoggedIn) {
    // login อยู่แล้วแต่ดันเข้าหน้า login/register -> เด้งไป dashboard ตาม role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
    return profile?.role === 'teacher' ? '/teacher-dashboard' : '/student-dashboard'
  }

  if (to.meta.role && isLoggedIn) {
    // เข้าถูกทาง แต่เช็ค role ให้ตรงห้อง (กันนักเรียนเข้า teacher-dashboard)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()
    if (profile?.role !== to.meta.role) {
      return profile?.role === 'teacher' ? '/teacher-dashboard' : '/student-dashboard'
    }
  }

  // ไม่ return อะไร = อนุญาตให้ไปต่อ (เทียบเท่า next() เดิม)
})

export default router