<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../../supabase'

const router = useRouter()

const loading = ref(true)
const errorMsg = ref('')

const profile = ref(null)
const classrooms = ref([])
const upcomingAssignments = ref([])
const averageScore = ref('-')

const stats = computed(() => ({
  classroomCount: classrooms.value.length,
  pendingCount: upcomingAssignments.value.length,
  avgScore: averageScore.value,
}))

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

    const { data: enrollments, error: classroomError } = await supabase
      .from('classroom_enrollments')
      .select('classrooms ( id, name, class_code )')
      .eq('student_id', user.id)
    if (classroomError) throw classroomError
    classrooms.value = (enrollments || []).map((row) => row.classrooms).filter(Boolean)

    const classroomIds = classrooms.value.map((c) => c.id)
    if (classroomIds.length > 0) {
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id, title, due_date, classroom_id')
        .in('classroom_id', classroomIds)
        .gte('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(5)
      if (assignmentsError) throw assignmentsError
      upcomingAssignments.value = assignmentsData || []
    }

    const { data: submissionsData } = await supabase
      .from('assignment_submissions')
      .select('score')
      .eq('student_id', user.id)
      .not('score', 'is', null)

    if (submissionsData && submissionsData.length > 0) {
      const sum = submissionsData.reduce((acc, s) => acc + (s.score || 0), 0)
      averageScore.value = (sum / submissionsData.length).toFixed(1)
    }
  } catch (err) {
    console.error(err)
    errorMsg.value = 'โหลดข้อมูลไม่สำเร็จ ลองอีกครั้ง'
  } finally {
    loading.value = false
  }
}

function formatDueDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

onMounted(fetchDashboardData)
</script>

<template>
  <div class="notebook-page min-h-dvh">
    <main class="mx-auto max-w-5xl px-5 py-8">
      <div v-if="errorMsg"
        class="rounded-xl border border-[#E85539]/30 bg-[#E85539]/10 px-4 py-4 text-center text-sm font-medium text-[#B8402A]">
        {{ errorMsg }}
      </div>

      <div v-else-if="loading" class="flex justify-center py-16 text-sm text-[#8A8072]">
        กำลังโหลดข้อมูล…
      </div>

      <div v-else>
        <!-- ID card -->
        <div class="note-card mb-8 overflow-hidden">
          <div class="flex items-center gap-4 px-6 py-5">
            <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#FF6B4A] text-xl font-semibold text-white">
              {{ initial }}
            </div>
            <div>
              <p class="title-font text-lg font-semibold text-[#2A2521]">
                {{ profile?.name || 'ไม่ระบุชื่อ' }}
              </p>
              <span class="mt-1 inline-block rounded-full bg-[#7C9473]/10 px-2.5 py-0.5 text-xs font-medium text-[#5C7355]">
                นักเรียน
              </span>
            </div>
          </div>

          <div class="border-t-2 border-dashed border-[#E4DCC8]"></div>

          <div class="grid grid-cols-3 divide-x-2 divide-dashed divide-[#E4DCC8]">
            <div class="px-4 py-4 text-center">
              <p class="title-font text-2xl font-semibold text-[#7C9473]">
                {{ stats.classroomCount }}
              </p>
              <p class="mt-1 text-xs text-[#8A8072]">ห้องเรียนของฉัน</p>
            </div>
            <div class="px-4 py-4 text-center">
              <p class="title-font text-2xl font-semibold text-[#FF6B4A]">
                {{ stats.pendingCount }}
              </p>
              <p class="mt-1 text-xs text-[#8A8072]">งานใกล้ครบกำหนด</p>
            </div>
            <div class="px-4 py-4 text-center">
              <p class="title-font text-2xl font-semibold text-[#D19B3D]">
                {{ stats.avgScore }}
              </p>
              <p class="mt-1 text-xs text-[#8A8072]">คะแนนเฉลี่ย</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <!-- classrooms -->
          <section class="note-card p-5 lg:col-span-2">
            <h2 class="title-font mb-4 text-sm font-semibold uppercase tracking-wide text-[#2A2521]">
              ห้องเรียนของฉัน
            </h2>

            <div v-if="classrooms.length === 0" class="py-10 text-center">
              <p class="text-sm text-[#8A8072]">ยังไม่มีห้องเรียนที่ลงทะเบียน</p>
              <p class="mt-1 text-xs text-[#B0A692]">ใส่รหัสห้องเรียนจากครูผู้สอนเพื่อเข้าร่วม</p>
            </div>

            <ul v-else class="space-y-2">
              <li v-for="room in classrooms" :key="room.id"
                class="flex cursor-pointer items-center justify-between rounded-xl border-2 border-dashed border-[#E4DCC8] bg-[#FFFDF8] px-4 py-3 transition-colors hover:border-[#FF6B4A]/40 hover:bg-[#FF6B4A]/5">
                <div>
                  <p class="text-sm font-medium text-[#2A2521]">{{ room.name }}</p>
                  <p class="mt-0.5 text-xs tracking-wide text-[#B0A692]">
                    {{ room.class_code }}
                  </p>
                </div>
                <span class="text-[#FF6B4A]">→</span>
              </li>
            </ul>
          </section>

          <!-- right column -->
          <div class="space-y-5">
            <section class="note-card p-5">
              <h2 class="title-font mb-4 text-sm font-semibold uppercase tracking-wide text-[#2A2521]">
                งานใกล้ครบกำหนด
              </h2>

              <div v-if="upcomingAssignments.length === 0" class="py-6 text-center">
                <p class="text-sm text-[#8A8072]">ไม่มีงานที่ต้องส่งตอนนี้</p>
              </div>

              <ul v-else class="space-y-3">
                <li v-for="item in upcomingAssignments" :key="item.id"
                  class="flex items-center justify-between gap-2 text-sm">
                  <span class="truncate text-[#2A2521]">{{ item.title }}</span>
                  <span class="whitespace-nowrap rounded-full bg-[#FF6B4A]/10 px-2.5 py-0.5 text-xs font-medium text-[#B8402A]">
                    {{ formatDueDate(item.due_date) }}
                  </span>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </main>
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
</style>