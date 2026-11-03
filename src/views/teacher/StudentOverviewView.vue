<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../../lib/supabase.js'
import { getClassroomColorById } from '../../lib/classroomColors'
import AppNavbar from '../../components/AppNavbar.vue'
import {
  ArrowLeft, ClipboardList, FileQuestion, Sparkles, RefreshCw, AlertTriangle,
} from 'lucide-vue-next'

const route = useRoute()
const classroomId = route.params.id
const studentId = route.params.studentId
const roomColor = getClassroomColorById(classroomId)

const loading = ref(true)
const notFound = ref(false)
const classroom = ref(null)
const student = ref(null)
const rows = ref([])

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const studentName = computed(() =>
  student.value ? `${student.value.name ?? ''} ${student.value.lastname ?? ''}`.trim() : '...'
)

// ---------- สร้างแถวงาน (การบ้าน + Quiz) ----------
function buildRow(kind, item, sub) {
  const max = Number(item.max_score) || 100
  const due = item.due_date ? new Date(item.due_date) : null
  const submitted = !!sub?.submitted_at
  const graded = submitted && sub.score != null && (kind === 'assignment' || sub.is_graded)
  const late = submitted && due ? new Date(sub.submitted_at) > due : false
  const overdue = !submitted && due ? due < new Date() : false

  let status = 'upcoming'
  if (submitted) status = graded ? 'graded' : 'waiting'
  else if (overdue) status = 'missing'

  return {
    key: `${kind}-${item.id}`,
    kind,
    id: item.id,
    title: item.title,
    due: item.due_date,
    submittedAt: sub?.submitted_at ?? null,
    status,
    late,
    score: graded ? Number(sub.score) : null,
    max,
    percent: graded ? Math.round((Number(sub.score) / max) * 100) : null,
  }
}

const STATUS_META = {
  graded: { label: 'ตรวจแล้ว', cls: 'bg-green-100 text-green-dark' },
  waiting: { label: 'รอตรวจ', cls: 'bg-orange text-dark' },
  missing: { label: 'ไม่ได้ส่ง', cls: 'bg-[#ffcdd2] text-[#c62828]' },
  upcoming: { label: 'ยังไม่ถึงกำหนด', cls: 'bg-gray-light text-gray' },
}

// ---------- สถิติ ----------
const counted = computed(() => rows.value.filter((r) => r.status !== 'upcoming'))
const submittedCount = computed(() => counted.value.filter((r) => r.status !== 'missing').length)
const lateCount = computed(() => rows.value.filter((r) => r.late).length)
const missingCount = computed(() => rows.value.filter((r) => r.status === 'missing').length)
const gradedCount = computed(() => rows.value.filter((r) => r.status === 'graded').length)

function avgOf(kind) {
  const g = rows.value.filter((r) => r.kind === kind && r.percent !== null)
  return g.length ? Math.round(g.reduce((s, r) => s + r.percent, 0) / g.length) : null
}
const avgAssignment = computed(() => avgOf('assignment'))
const avgQuiz = computed(() => avgOf('quiz'))

const sortedRows = computed(() =>
  [...rows.value].sort((a, b) => {
    if (!a.due && !b.due) return 0
    if (!a.due) return 1
    if (!b.due) return -1
    return new Date(b.due) - new Date(a.due)
  })
)

// ---------- AI วิเคราะห์ ----------
const analysis = ref(undefined) // undefined = กำลังโหลด, null = ยังไม่มี
const analyzing = ref(false)
const analysisError = ref('')

const isStale = computed(() => {
  const b = analysis.value?.result?.based_on
  if (!b) return false
  return b.total !== counted.value.length || b.graded !== gradedCount.value
})

async function loadAnalysis() {
  const { data, error } = await supabase
    .from('ai_analysis_cache')
    .select('result, confidence, created_at')
    .eq('student_id', studentId)
    .eq('classroom_id', classroomId)
    .eq('analysis_type', 'weakness')
    .maybeSingle()
  if (error) console.error('loadAnalysis error:', error)
  analysis.value = data ?? null
}

async function runAnalysis() {
  if (analyzing.value) return
  analyzing.value = true
  analysisError.value = ''
  try {
    const { data, error } = await supabase.functions.invoke('analyze-weakness', {
      body: { student_id: studentId, classroom_id: classroomId },
    })
    if (error) throw error
    if (data?.ok) {
      analysis.value = {
        result: data.result,
        confidence: data.confidence,
        created_at: new Date().toISOString(),
      }
    } else if (data?.ok === false) {
      analysisError.value = 'ยังไม่มีงานที่ถึงกำหนดหรือส่งแล้วให้วิเคราะห์'
    }
  } catch (e) {
    console.error('analyze-weakness error:', e)
    analysisError.value = 'วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง'
  } finally {
    analyzing.value = false
  }
}

// ---------- โหลดข้อมูล ----------
async function load() {
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: cls }, { data: enr }, { data: prof }] = await Promise.all([
    supabase.from('classrooms').select('id, name, teacher_id').eq('id', classroomId).maybeSingle(),
    supabase.from('classroom_enrollments').select('id')
      .eq('classroom_id', classroomId).eq('student_id', studentId)
      .eq('status', 'accepted').maybeSingle(),
    supabase.from('profiles').select('name, lastname, img').eq('id', studentId).maybeSingle(),
  ])

  if (!cls || !user || cls.teacher_id !== user.id || !enr || !prof) {
    notFound.value = true
    return
  }
  classroom.value = cls
  student.value = prof

  const [{ data: assignments }, { data: quizzes }] = await Promise.all([
    supabase.from('assignments').select('id, title, due_date, max_score').eq('classroom_id', classroomId),
    supabase.from('quizzes').select('id, title, due_date, max_score').eq('classroom_id', classroomId),
  ])
  const aIds = (assignments ?? []).map((a) => a.id)
  const qIds = (quizzes ?? []).map((q) => q.id)

  const [{ data: aSubs }, { data: qSubs }] = await Promise.all([
    aIds.length
      ? supabase.from('assignment_submissions')
          .select('assignment_id, score, submitted_at')
          .eq('student_id', studentId).in('assignment_id', aIds)
      : Promise.resolve({ data: [] }),
    qIds.length
      ? supabase.from('quiz_submissions')
          .select('quiz_id, score, is_graded, submitted_at')
          .eq('student_id', studentId).in('quiz_id', qIds)
      : Promise.resolve({ data: [] }),
  ])

  rows.value = [
    ...(assignments ?? []).map((a) =>
      buildRow('assignment', a, (aSubs ?? []).find((s) => s.assignment_id === a.id))),
    ...(quizzes ?? []).map((q) =>
      buildRow('quiz', q, (qSubs ?? []).find((s) => s.quiz_id === q.id))),
  ]
}

onMounted(async () => {
  try {
    await load()
  } catch (e) {
    console.error('StudentOverview load error:', e)
    notFound.value = true
  } finally {
    loading.value = false
  }
  if (notFound.value) return

  await loadAnalysis()
  // เปิดครั้งแรกแล้วยังไม่มีผล และมีข้อมูลให้วิเคราะห์ → สร้างให้เลย
  if (analysis.value === null && counted.value.length > 0) runAnalysis()
})
</script>

<template>
  <div class="bg-gray-light min-h-screen font-mitr">
    <AppNavbar :show-search="false" :breadcrumb="[
      { label: 'หน้ารวมห้องเรียน', to: '/teacher' },
      { label: classroom?.name ?? '...', to: `/classroom/${classroomId}` },
      { label: studentName },
    ]" />

    <!-- ===== หัวโปรไฟล์ ===== -->
    <div class="relative overflow-hidden border-b-[3px] border-dark px-4 sm:px-6 py-6 sm:py-8"
      :style="{ background: `linear-gradient(135deg, ${roomColor.from} 0%, ${roomColor.to} 100%)` }">
      <div class="absolute inset-0 pointer-events-none opacity-[0.12]"
        style="background-image: radial-gradient(#1a1a1a 1.5px, transparent 1.5px); background-size: 18px 18px;" />
      <div class="max-w-[1000px] mx-auto relative">
        <router-link :to="{ name: 'classroom-detail', params: { id: classroomId }, query: { tab: 'members' } }"
          class="inline-flex items-center gap-1.5 mb-4 h-8 px-3 rounded-full border-2 border-dark bg-white text-[12.5px] font-bold text-dark
                 shadow-[3px_3px_0_#1a1a1a] hover:-translate-y-0.5 transition">
          <ArrowLeft :size="14" :stroke-width="3" />
          กลับห้องเรียน
        </router-link>

        <div v-if="loading" class="h-[64px] rounded-2xl bg-white/40 animate-pulse" />
        <div v-else-if="student" class="flex items-center gap-4">
          <div class="w-16 h-16 shrink-0 rounded-full border-[3px] border-dark overflow-hidden bg-purple-light
                      flex items-center justify-center font-mali font-bold text-[20px] shadow-[3px_3px_0_#1a1a1a]">
            <img v-if="student.img" :src="student.img" class="w-full h-full object-cover" alt="นักเรียน" />
            <span v-else>{{ (student.name?.[0] ?? '') + (student.lastname?.[0] ?? '') }}</span>
          </div>
          <div class="min-w-0">
            <p class="text-[12px] font-bold text-dark/70 font-mono uppercase">ภาพรวมนักเรียน</p>
            <h1 class="font-mali font-bold text-[24px] sm:text-3xl text-dark break-words">{{ studentName }}</h1>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-[1000px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <p v-if="notFound" class="text-center text-gray text-[14px] py-16">
        ไม่พบนักเรียนคนนี้ในห้องเรียนของคุณ
      </p>

      <template v-else-if="!loading">
        <!-- ===== สถิติ ===== -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <div class="bg-white border-[3px] border-dark rounded-2xl px-4 py-3 shadow-[4px_4px_0_#1a1a1a]">
            <p class="text-[22px] leading-none font-bold">{{ submittedCount }}/{{ counted.length }}</p>
            <p class="text-[12px] text-gray mt-1.5">ส่งแล้ว</p>
          </div>
          <div class="border-[3px] border-dark rounded-2xl px-4 py-3 shadow-[4px_4px_0_#1a1a1a]"
            :class="lateCount > 0 ? 'bg-[#ffd699]' : 'bg-white'">
            <p class="text-[22px] leading-none font-bold">{{ lateCount }}</p>
            <p class="text-[12px] text-gray mt-1.5">ส่งล่าช้า</p>
          </div>
          <div class="border-[3px] border-dark rounded-2xl px-4 py-3 shadow-[4px_4px_0_#1a1a1a]"
            :class="missingCount > 0 ? 'bg-[#ffcdd2]' : 'bg-white'">
            <p class="text-[22px] leading-none font-bold">{{ missingCount }}</p>
            <p class="text-[12px] text-gray mt-1.5">ไม่ได้ส่ง</p>
          </div>
          <div class="bg-white border-[3px] border-dark rounded-2xl px-4 py-3 shadow-[4px_4px_0_#1a1a1a]">
            <p class="text-[22px] leading-none font-bold">{{ avgAssignment !== null ? avgAssignment + '%' : '-' }}</p>
            <p class="text-[12px] text-gray mt-1.5">เฉลี่ยการบ้าน</p>
          </div>
          <div class="bg-white border-[3px] border-dark rounded-2xl px-4 py-3 shadow-[4px_4px_0_#1a1a1a]">
            <p class="text-[22px] leading-none font-bold">{{ avgQuiz !== null ? avgQuiz + '%' : '-' }}</p>
            <p class="text-[12px] text-gray mt-1.5">เฉลี่ย Quiz</p>
          </div>
        </div>

        <!-- ===== AI วิเคราะห์จุดอ่อน ===== -->
        <div class="mb-8">
          <div class="flex items-center justify-between gap-2 mb-3">
            <h2 class="font-mali font-bold text-[17px] inline-flex items-center gap-2">
              <Sparkles :size="17" :stroke-width="2.5" />
              AI วิเคราะห์จุดอ่อน
            </h2>
            <button type="button" @click="runAnalysis" :disabled="analyzing || counted.length === 0"
              class="inline-flex items-center gap-1 text-[12px] font-bold border-2 border-dark rounded-lg px-2.5 py-1.5 bg-white
                     hover:-translate-y-0.5 transition disabled:opacity-50 disabled:pointer-events-none">
              <RefreshCw :size="12" :stroke-width="2.5" :class="analyzing ? 'animate-spin' : ''" />
              วิเคราะห์ใหม่
            </button>
          </div>

          <p v-if="analysisError && !analyzing"
            class="mb-2 text-[12px] text-red-600 font-semibold bg-red-50 border-2 border-[#f44336] rounded-lg px-3 py-2">
            {{ analysisError }}
          </p>

          <p v-if="isStale && !analyzing"
            class="mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-dark bg-[#fff0d6] border-2 border-dark rounded-lg px-3 py-2">
            <AlertTriangle :size="13" :stroke-width="2.5" />
            มีงานเพิ่มหรืออัปเดตหลังวิเคราะห์ครั้งล่าสุด กด "วิเคราะห์ใหม่" เพื่อรวมข้อมูลล่าสุด
          </p>

          <div v-if="analyzing || analysis === undefined"
            class="rounded-2xl border-[3px] border-dark bg-purple-light p-5 flex items-center gap-3">
            <RefreshCw :size="16" :stroke-width="2.5" class="shrink-0 animate-spin" />
            <p class="text-[13px] text-dark">AI กำลังวิเคราะห์... อาจใช้เวลาสักครู่</p>
          </div>

          <p v-else-if="analysis === null"
            class="bg-white border-[3px] border-dashed border-dark/30 rounded-2xl p-6 text-center text-gray text-[13px]">
            <template v-if="counted.length === 0">ยังไม่มีงานที่ถึงกำหนดหรือส่งแล้ว จึงยังวิเคราะห์ไม่ได้</template>
            <template v-else>ยังไม่มีผลวิเคราะห์ กด "วิเคราะห์ใหม่" เพื่อสร้าง</template>
          </p>

          <div v-else class="rounded-2xl border-[3px] border-dark bg-purple-light shadow-[5px_5px_0_#1a1a1a] p-5 flex flex-col gap-3.5">
            <p class="text-[14px] text-dark leading-relaxed">{{ analysis.result.summary }}</p>

            <div v-if="analysis.result.weaknesses?.length">
              <p class="text-[12px] font-bold text-dark mb-1.5">จุดที่ควรพัฒนา</p>
              <ul class="flex flex-col gap-2">
                <li v-for="(w, i) in analysis.result.weaknesses" :key="i"
                  class="bg-white border-2 border-dark rounded-lg px-3 py-2">
                  <p class="text-[13px] font-bold text-dark">{{ w.topic }}</p>
                  <p class="text-[12px] text-gray mt-0.5">{{ w.evidence }}</p>
                </li>
              </ul>
            </div>

            <div v-if="analysis.result.strengths?.length">
              <p class="text-[12px] font-bold text-dark mb-1.5">จุดแข็ง</p>
              <ul class="list-disc pl-5 text-[13px] text-dark">
                <li v-for="(s, i) in analysis.result.strengths" :key="i">{{ s }}</li>
              </ul>
            </div>

            <div v-if="analysis.result.suggestions?.length">
              <p class="text-[12px] font-bold text-dark mb-1.5">แนวทางช่วยเหลือ</p>
              <ul class="list-disc pl-5 text-[13px] text-dark">
                <li v-for="(s, i) in analysis.result.suggestions" :key="i">{{ s }}</li>
              </ul>
            </div>

            <p class="text-[11px] text-gray border-t-2 border-dashed border-dark/20 pt-2.5">
              วิเคราะห์จากงานทั้งหมดของนักเรียนคนนี้ในห้องนี้ · {{ formatDate(analysis.created_at) }}
              <template v-if="Number(analysis.confidence) < 0.5"> · ข้อมูลน้อย ผลอาจไม่แม่นยำ</template>
              · AI อาจคลาดเคลื่อน ครูควรใช้ดุลยพินิจ
            </p>
          </div>
        </div>

        <!-- ===== รายการงานทั้งหมด ===== -->
        <h2 class="font-mali font-bold text-[17px] mb-3">
          งานทั้งหมด
          <span class="text-[13px] text-gray font-mitr font-normal">({{ rows.length }} ชิ้น)</span>
        </h2>

        <p v-if="rows.length === 0"
          class="bg-white border-[3px] border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
          ยังไม่มีงานในห้องนี้
        </p>

        <ul v-else class="flex flex-col gap-3">
          <li v-for="r in sortedRows" :key="r.key">
            <router-link
              :to="r.kind === 'assignment'
                ? { name: 'teacher-assignment-detail', params: { id: classroomId, assignmentId: r.id } }
                : { name: 'teacher-quiz-detail', params: { id: classroomId, quizId: r.id } }"
              class="flex items-center gap-3 bg-white border-[3px] border-dark rounded-xl px-4 py-3 shadow-[3px_3px_0_#1a1a1a]
                     hover:-translate-y-0.5 transition">
              <div class="w-9 h-9 shrink-0 rounded-lg border-2 border-dark flex items-center justify-center"
                :class="r.kind === 'assignment' ? 'bg-orange' : 'bg-purple-light'">
                <ClipboardList v-if="r.kind === 'assignment'" :size="16" :stroke-width="2.5" />
                <FileQuestion v-else :size="16" :stroke-width="2.5" />
              </div>

              <div class="min-w-0 flex-1">
                <p class="text-[13.5px] font-bold text-dark truncate">{{ r.title }}</p>
                <p class="text-[11.5px] text-gray font-mono truncate">
                  <template v-if="r.due">กำหนด {{ formatDate(r.due) }}</template>
                  <template v-if="r.submittedAt"> · ส่ง {{ formatDate(r.submittedAt) }}</template>
                </p>
              </div>

              <span v-if="r.late" class="shrink-0 text-[10.5px] font-bold text-red-600">ส่งล่าช้า</span>
              <span v-if="r.score !== null"
                class="shrink-0 font-mono text-[11px] font-bold border-2 border-dark rounded-lg px-2 py-0.5 bg-white">
                {{ r.score }}/{{ r.max }}
              </span>
              <span class="shrink-0 border-2 border-dark rounded-lg px-2 py-0.5 font-mono text-[10px] font-bold"
                :class="STATUS_META[r.status].cls">
                {{ STATUS_META[r.status].label }}
              </span>
            </router-link>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>