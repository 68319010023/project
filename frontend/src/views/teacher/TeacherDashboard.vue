<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../supabase'
import CreateClassroomModal from './CreateClassroomModal.vue'

const router = useRouter()

const loading = ref(true)
const errorMsg = ref('')
const showCreateModal = ref(false)

const profile = ref(null)
const classrooms = ref([])
const pendingGradingCount = ref(0)
const totalStudents = ref(0)

const stats = computed(() => ({
  classroomCount: classrooms.value.length,
  studentCount: totalStudents.value,
  pendingGrading: pendingGradingCount.value,
}))

// สีแถบบนของการ์ดห้องเรียน สลับวนตามธีมสมุด
const cardAccents = ['#FF6B4A', '#7C9473', '#C99B5C']
function accentFor(index) {
  return cardAccents[index % cardAccents.length]
}

const initial = computed(() => (profile.value?.name ? profile.value.name.trim().charAt(0) : '?'))

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
      .select('name, role')
      .eq('id', user.id)
      .single()
    if (profileError) throw profileError
    profile.value = profileData

    // ห้องเรียนที่สอนอยู่ พร้อมจำนวนนักเรียนในแต่ละห้อง
    // หมายเหตุ: เพิ่ม grade_level เข้ามาในคำสั่ง select — ถ้าตาราง classrooms ยังไม่มีคอลัมน์นี้ ต้องเพิ่มก่อน ไม่งั้นจะได้ undefined
    const { data: classroomsData, error: classroomError } = await supabase
      .from('classrooms')
      .select('id, name, class_code, grade_level, classroom_enrollments(count)')
      .eq('teacher_id', user.id)
    if (classroomError) throw classroomError

    classrooms.value = (classroomsData || []).map((room) => ({
      ...room,
      studentCount: room.classroom_enrollments?.[0]?.count ?? 0,
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
          .from('assignment_submissions')
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

function handleClassroomCreated(newClassroom) {
  // เพิ่มห้องใหม่เข้าไปในลิสต์ทันที ไม่ต้องรอ refetch ทั้งหมด
  classrooms.value.unshift({ ...newClassroom, studentCount: 0 })
}

onMounted(fetchDashboardData)
</script>

<template>
  <div class="notebook-page min-h-dvh">
    <main class="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div v-if="loading" class="py-20 text-center text-[#8A8072]">กำลังโหลดข้อมูล...</div>

      <div v-else-if="errorMsg" class="rounded-xl border border-[#E85539]/30 bg-[#E85539]/10 px-4 py-4 text-center text-sm font-medium text-[#B8402A]">
        {{ errorMsg }}
      </div>

      <div v-else>
        <!-- greeting + create button -->
        <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 class="title-font text-2xl font-bold text-[#2A2521] sm:text-3xl">
              สวัสดี{{ profile?.name ? ` ครู${profile.name}` : '' }} 👋
            </h1>
            <p class="mt-1.5 text-[#8A8072]">ภาพรวมห้องเรียนที่คุณสอน</p>
          </div>
          <button
            @click="showCreateModal = true"
            class="stamp-btn group inline-flex items-center justify-center gap-1.5 rounded-full bg-[#FF6B4A] px-5 py-3 text-sm font-semibold text-white transition-transform active:scale-95 sm:self-auto"
          >
            <svg class="h-4 w-4 transition-transform group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            สร้างห้องเรียนใหม่
          </button>
        </div>

        <!-- stat cards -->
        <div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div class="note-card p-5">
            <p class="text-sm text-[#8A8072]">ห้องเรียนที่สอน</p>
            <p class="title-font mt-1 text-3xl font-bold text-[#2A2521]">{{ stats.classroomCount }}</p>
          </div>
          <div class="note-card p-5">
            <p class="text-sm text-[#8A8072]">นักเรียนทั้งหมด</p>
            <p class="title-font mt-1 text-3xl font-bold text-[#2A2521]">{{ stats.studentCount }}</p>
          </div>
          <div class="note-card p-5">
            <p class="text-sm text-[#8A8072]">งานที่รอตรวจ</p>
            <p class="title-font mt-1 text-3xl font-bold text-[#FF6B4A]">{{ stats.pendingGrading }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <!-- classrooms grid -->
          <section class="note-card p-6 lg:col-span-2">
            <h2 class="title-font mb-4 font-semibold text-[#2A2521]">ห้องเรียนของฉัน</h2>

            <div v-if="classrooms.length === 0" class="py-6 text-center text-sm text-[#8A8072]">
              ยังไม่มีห้องเรียน ลองสร้างห้องแรกของคุณเลย
            </div>

            <div v-else class="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div
                v-for="(room, i) in classrooms"
                :key="room.id"
                class="classroom-card cursor-pointer overflow-hidden rounded-2xl border border-[#E4DCC8] bg-[#FFFDF8] transition-colors hover:border-[#FF6B4A]/40"
              >
                <div class="h-2.5" :style="{ background: accentFor(i) }"></div>
                <div class="p-4">
                  <p class="truncate font-medium text-[#2A2521]">{{ room.name }}</p>
                  <p class="mt-1 text-xs text-[#8A8072]">ระดับชั้น: {{ room.grade_level || '—' }}</p>
                  <p class="text-xs text-[#8A8072]">รหัสชั้นเรียน: {{ room.class_code }} · นักเรียน {{ room.studentCount }} คน</p>

                  <div class="mt-3 flex items-center gap-2 border-t border-dashed border-[#E4DCC8] pt-2.5">
                    <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7C9473] text-[11px] font-semibold text-white">
                      {{ initial }}
                    </div>
                    <span class="truncate text-xs text-[#6B6255]">ครู{{ profile?.name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- AI class overview -->
          <div class="space-y-6">
            <section class="ai-card p-6 text-white">
              <p class="title-font mb-1 font-semibold">สรุปภาพรวมจาก AI</p>
              <p class="mb-4 text-sm text-white/90">
                ดูจุดอ่อนของนักเรียนทั้งห้อง วิเคราะห์จากคะแนน การส่งงาน และคุณภาพรายงาน
              </p>
              <router-link
                to="/ai-insights"
                class="inline-block rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#FF6B4A] transition hover:bg-[#FFF6F0]"
              >
                ดูสรุปภาพรวม
              </router-link>
            </section>

            <section class="note-card p-6">
              <h2 class="title-font mb-4 font-semibold text-[#2A2521]">ทางลัด</h2>
              <ul class="space-y-2 text-sm">
                <li>
                  <router-link to="/quizzes" class="text-[#FF6B4A] hover:underline">
                    คลังแบบทดสอบ
                  </router-link>
                </li>
                <li>
                  <router-link to="/assignments" class="text-[#FF6B4A] hover:underline">
                    มอบหมายการบ้าน
                  </router-link>
                </li>
                <li>
                  <router-link to="/gradebook" class="text-[#FF6B4A] hover:underline">
                    สมุดบันทึกคะแนน
                  </router-link>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </main>

    <CreateClassroomModal
      v-model="showCreateModal"
      @created="handleClassroomCreated"
    />
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Kanit:wght@500;600;700&family=Sarabun:wght@400;500;600&display=swap');

.notebook-page {
  background-color: #FBF6EC;
  background-image: radial-gradient(#E4DCC8 1px, transparent 1px);
  background-size: 22px 22px;
  font-family: 'Sarabun', sans-serif;
}

.title-font {
  font-family: 'Kanit', sans-serif;
}

.note-card {
  position: relative;
  border-radius: 18px;
  background: #FFFDF8;
  border: 2px solid #E4DCC8;
  box-shadow: 0 2px 8px rgba(42, 37, 33, 0.06);
}
.note-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  background: #F1EADC;
  border-radius: 0 18px 0 18px;
}

.classroom-card {
  box-shadow: 0 1px 3px rgba(42, 37, 33, 0.05);
}
.classroom-card:hover {
  box-shadow: 0 3px 10px rgba(42, 37, 33, 0.08);
}

.ai-card {
  position: relative;
  border-radius: 18px;
  background: linear-gradient(135deg, #FF6B4A, #E0562F);
  box-shadow: 0 6px 20px rgba(255, 107, 74, 0.25);
}
.ai-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 0 18px 0 18px;
}

.stamp-btn {
  box-shadow: 0 3px 0 #C94A2E;
}
.stamp-btn:hover {
  box-shadow: 0 3px 0 #C94A2E;
  filter: brightness(1.05);
}
.stamp-btn:active {
  box-shadow: 0 1px 0 #C94A2E;
  transform: translateY(2px);
}
</style>