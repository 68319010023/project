<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../supabase'

// *** หมายเหตุ: โค้ดนี้อ้างอิงโครงสร้างตารางที่สมมติไว้ (profiles, classrooms,
// classroom_students, assignments, submissions) ถ้าชื่อ table/column ของจริง
// ไม่ตรง ให้แก้ไขใน query ด้านล่างให้ตรงกับสคีมาจริงของคุณ ***

const router = useRouter()

const loading = ref(true)
const errorMsg = ref('')

const profile = ref(null)
const classrooms = ref([])
const pendingGradingCount = ref(0)
const totalStudents = ref(0)

const stats = computed(() => ({
  classroomCount: classrooms.value.length,
  studentCount: totalStudents.value,
  pendingGrading: pendingGradingCount.value,
}))

async function fetchDashboardData() {
  loading.value = true
  errorMsg.value = ''

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()
    if (profileError) throw profileError
    profile.value = profileData

    // ห้องเรียนที่สอนอยู่ พร้อมจำนวนนักเรียนในแต่ละห้อง
    const { data: classroomsData, error: classroomError } = await supabase
      .from('classrooms')
      .select('id, name, class_code, classroom_students(count)')
      .eq('teacher_id', user.id)
    if (classroomError) throw classroomError

    classrooms.value = (classroomsData || []).map((room) => ({
      ...room,
      studentCount: room.classroom_students?.[0]?.count ?? 0,
    }))

    totalStudents.value = classrooms.value.reduce((sum, r) => sum + r.studentCount, 0)

    // งานที่รอตรวจ (submissions ที่ยังไม่มีคะแนน ในห้องที่ครูคนนี้สอน)
    const classroomIds = classrooms.value.map((c) => c.id)
    if (classroomIds.length > 0) {
      const { data: assignmentsData } = await supabase
        .from('assignments')
        .select('id')
        .in('classroom_id', classroomIds)

      const assignmentIds = (assignmentsData || []).map((a) => a.id)

      if (assignmentIds.length > 0) {
        const { count } = await supabase
          .from('submissions')
          .select('id', { count: 'exact', head: true })
          .in('assignment_id', assignmentIds)
          .is('score', null)

        pendingGradingCount.value = count || 0
      }
    }
  } catch (err) {
    console.error(err)
    errorMsg.value = 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่'
  } finally {
    loading.value = false
  }
}

async function handleLogout() {
  await supabase.auth.signOut()
  router.push('/login')
}

onMounted(fetchDashboardData)
</script>

<template>
  <div class="relative min-h-screen overflow-hidden bg-white">
    <!-- decorative soft pink blobs -->
    <div class="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-pink-200/40 blur-3xl"></div>
    <div class="pointer-events-none absolute top-1/2 -right-24 h-72 w-72 rounded-full bg-rose-100/50 blur-3xl"></div>

    <!-- top nav -->
    <header class="relative border-b border-pink-100 bg-white/80 backdrop-blur">
      <div class="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400 to-rose-400 text-white text-lg">
            🎓
          </div>
          <span class="font-semibold text-gray-800">Smart Classroom</span>
        </div>
        <button
          @click="handleLogout"
          class="text-sm font-medium text-pink-500 hover:text-pink-600 hover:underline"
        >
          ออกจากระบบ
        </button>
      </div>
    </header>

    <main class="relative max-w-5xl mx-auto px-4 py-8">
      <div v-if="loading" class="text-center text-gray-400 py-20">กำลังโหลดข้อมูล...</div>

      <div v-else-if="errorMsg" class="text-center text-red-500 bg-red-50 border border-red-100 rounded-xl py-4 px-4">
        {{ errorMsg }}
      </div>

      <div v-else>
        <!-- greeting + create button -->
        <div class="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-gray-800">
              สวัสดี{{ profile?.full_name ? ` ครู${profile.full_name}` : '' }} 👋
            </h1>
            <p class="text-gray-400 mt-1">ภาพรวมห้องเรียนที่คุณสอน</p>
          </div>
          <router-link
            to="/classrooms/new"
            class="inline-flex items-center justify-center bg-gradient-to-r from-pink-400 to-rose-400 text-white font-medium text-sm rounded-xl px-5 py-2.5 shadow-md shadow-pink-200 hover:shadow-lg hover:from-pink-500 hover:to-rose-500 transition-all"
          >
            + สร้างห้องเรียนใหม่
          </router-link>
        </div>

        <!-- stat cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div class="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm shadow-pink-100/60">
            <p class="text-sm text-gray-400">ห้องเรียนที่สอน</p>
            <p class="text-3xl font-bold text-gray-800 mt-1">{{ stats.classroomCount }}</p>
          </div>
          <div class="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm shadow-pink-100/60">
            <p class="text-sm text-gray-400">นักเรียนทั้งหมด</p>
            <p class="text-3xl font-bold text-gray-800 mt-1">{{ stats.studentCount }}</p>
          </div>
          <div class="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm shadow-pink-100/60">
            <p class="text-sm text-gray-400">งานที่รอตรวจ</p>
            <p class="text-3xl font-bold text-gray-800 mt-1">{{ stats.pendingGrading }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- classrooms list -->
          <section class="lg:col-span-2 rounded-2xl border border-pink-100 bg-white p-6 shadow-sm shadow-pink-100/60">
            <h2 class="font-semibold text-gray-800 mb-4">ห้องเรียนของฉัน</h2>

            <div v-if="classrooms.length === 0" class="text-sm text-gray-400 py-6 text-center">
              ยังไม่มีห้องเรียน ลองสร้างห้องแรกของคุณเลย
            </div>

            <ul v-else class="space-y-3">
              <li
                v-for="room in classrooms"
                :key="room.id"
                class="flex items-center justify-between rounded-xl border border-pink-50 bg-pink-50/40 px-4 py-3 hover:bg-pink-50 transition cursor-pointer"
              >
                <div>
                  <p class="font-medium text-gray-800">{{ room.name }}</p>
                  <p class="text-xs text-gray-400">รหัสห้อง: {{ room.class_code }} · นักเรียน {{ room.studentCount }} คน</p>
                </div>
                <span class="text-pink-400">›</span>
              </li>
            </ul>
          </section>

          <!-- AI class overview -->
          <div class="space-y-6">
            <section class="rounded-2xl bg-gradient-to-br from-pink-400 to-rose-400 p-6 text-white shadow-md shadow-pink-200">
              <p class="font-semibold mb-1">สรุปภาพรวมจาก AI</p>
              <p class="text-sm text-white/90 mb-4">
                ดูจุดอ่อนของนักเรียนทั้งห้อง วิเคราะห์จากคะแนน การส่งงาน และคุณภาพรายงาน
              </p>
              <router-link
                to="/ai-insights"
                class="inline-block bg-white text-pink-500 font-medium text-sm rounded-xl px-4 py-2 hover:bg-pink-50 transition"
              >
                ดูสรุปภาพรวม
              </router-link>
            </section>

            <section class="rounded-2xl border border-pink-100 bg-white p-6 shadow-sm shadow-pink-100/60">
              <h2 class="font-semibold text-gray-800 mb-4">ทางลัด</h2>
              <ul class="space-y-2 text-sm">
                <li>
                  <router-link to="/quizzes" class="text-pink-500 hover:text-pink-600 hover:underline">
                    คลังแบบทดสอบ
                  </router-link>
                </li>
                <li>
                  <router-link to="/assignments" class="text-pink-500 hover:text-pink-600 hover:underline">
                    มอบหมายการบ้าน
                  </router-link>
                </li>
                <li>
                  <router-link to="/gradebook" class="text-pink-500 hover:text-pink-600 hover:underline">
                    สมุดบันทึกคะแนน
                  </router-link>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>