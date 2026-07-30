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
  <div class="min-h-screen bg-[#FBF9F4]">
    <main class="max-w-5xl mx-auto px-5 py-8">
      <div v-if="errorMsg"
        class="text-center text-[#993C1D] bg-[#FAECE7] border border-[#F0997B] rounded-lg py-4 px-4 text-sm">
        {{ errorMsg }}
      </div>

      <div v-else-if="!loading">
        <!-- ID card -->
        <div class="bg-white border border-[#14213D]/10 rounded-2xl mb-8 overflow-hidden">
          <div class="flex items-center gap-4 px-6 py-5">
            <div
              class="w-14 h-14 rounded-full bg-[#14213D] flex items-center justify-center text-[#FBF9F4] text-xl font-semibold shrink-0"
              style="font-family: 'Chakra Petch', sans-serif;">
              {{ initial }}
            </div>
            <div>
              <p class="text-lg font-semibold text-[#14213D]" style="font-family: 'Chakra Petch', sans-serif;">
                {{ profile?.name || 'ไม่ระบุชื่อ' }}
              </p>
              <span class="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded bg-[#0F766E]/10 text-[#0F766E]">
                นักเรียน
              </span>
            </div>
          </div>

          <div class="border-t border-dashed border-[#14213D]/15"></div>

          <div class="grid grid-cols-3 divide-x divide-[#14213D]/10">
            <div class="px-4 py-4 text-center">
              <p class="text-2xl font-semibold text-[#0F766E]" style="font-family: 'Chakra Petch', monospace;">
                {{ stats.classroomCount }}
              </p>
              <p class="text-xs text-[#14213D]/50 mt-1">ห้องเรียนของฉัน</p>
            </div>
            <div class="px-4 py-4 text-center">
              <p class="text-2xl font-semibold text-[#FF6B4A]" style="font-family: 'Chakra Petch', monospace;">
                {{ stats.pendingCount }}
              </p>
              <p class="text-xs text-[#14213D]/50 mt-1">งานใกล้ครบกำหนด</p>
            </div>
            <div class="px-4 py-4 text-center">
              <p class="text-2xl font-semibold text-[#E8A33D]" style="font-family: 'Chakra Petch', monospace;">
                {{ stats.avgScore }}
              </p>
              <p class="text-xs text-[#14213D]/50 mt-1">คะแนนเฉลี่ย</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <!-- classrooms -->
          <section class="lg:col-span-2 bg-white border border-[#14213D]/10 rounded-2xl p-5">
            <h2 class="text-sm font-semibold text-[#14213D] mb-4 uppercase tracking-wide"
              style="font-family: 'Chakra Petch', sans-serif;">
              ห้องเรียนของฉัน
            </h2>

            <div v-if="classrooms.length === 0" class="text-center py-10">
              <p class="text-sm text-[#14213D]/60">ยังไม่มีห้องเรียนที่ลงทะเบียน</p>
              <p class="text-xs text-[#14213D]/35 mt-1">ใส่รหัสห้องเรียนจากครูผู้สอนเพื่อเข้าร่วม</p>
            </div>

            <ul v-else class="space-y-2">
              <li v-for="room in classrooms" :key="room.id"
                class="flex items-center justify-between rounded-xl border border-dashed border-[#0F766E]/30 bg-[#0F766E]/5 px-4 py-3 hover:bg-[#0F766E]/10 transition-colors cursor-pointer">
                <div>
                  <p class="text-sm font-medium text-[#14213D]">{{ room.name }}</p>
                  <p class="text-xs text-[#14213D]/45 mt-0.5" style="font-family: 'Chakra Petch', monospace;">
                    {{ room.class_code }}
                  </p>
                </div>
                <span class="text-[#0F766E]">→</span>
              </li>
            </ul>
          </section>

          <!-- right column -->
          <div class="space-y-5">
            <section class="bg-white border border-[#14213D]/10 rounded-2xl p-5">
              <h2 class="text-sm font-semibold text-[#14213D] mb-4 uppercase tracking-wide"
                style="font-family: 'Chakra Petch', sans-serif;">
                งานใกล้ครบกำหนด
              </h2>

              <div v-if="upcomingAssignments.length === 0" class="text-center py-6">
                <p class="text-sm text-[#14213D]/60">ไม่มีงานที่ต้องส่งตอนนี้</p>
              </div>

              <ul v-else class="space-y-3">
                <li v-for="item in upcomingAssignments" :key="item.id"
                  class="flex items-center justify-between text-sm gap-2">
                  <span class="text-[#14213D] truncate">{{ item.title }}</span>
                  <span class="text-xs font-medium whitespace-nowrap px-2 py-0.5 rounded bg-[#FF6B4A]/10 text-[#993C1D]"
                    style="font-family: 'Chakra Petch', monospace;">
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