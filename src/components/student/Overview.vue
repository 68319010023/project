<script setup>
import { ref, computed, watch } from 'vue'
import {
  Users, ClipboardList, CheckCircle2, Clock, PartyPopper,
  AlertTriangle, CalendarClock, FileQuestion, ChevronRight, ChevronLeft, Flame,
} from 'lucide-vue-next'

const props = defineProps({
  classroomId: { type: String, required: true },
  memberCount: { type: Number, default: 0 },
  assignmentCount: { type: Number, default: 0 },
  submittedCount: { type: Number, default: 0 },
  dueSoonCount: { type: Number, default: 0 },
  submittedLabel: { type: String, default: 'ส่งแล้ว' },
  loading: { type: Boolean, default: false },
  upcomingAssignments: { type: Array, default: () => [] },
  // ฝั่งครูที่ submittedCount ไม่ใช่ "x จากทั้งหมด" ให้ส่ง :show-progress="false"
  showProgress: { type: Boolean, default: true },
  // 'student' (ค่าเริ่มต้น) หรือ 'teacher' — ครูจะไม่เห็น progress bar และรายการงานค้าง
  role: { type: String, default: 'student' },
})

const isStudent = computed(() => props.role !== 'teacher')

const emit = defineEmits(['go-tab'])

const progressPercent = computed(() => {
  if (!props.assignmentCount) return 0
  return Math.min(100, Math.round((props.submittedCount / props.assignmentCount) * 100))
})

const remaining = computed(() => Math.max(0, props.assignmentCount - props.submittedCount))

const cheerText = computed(() => {
  if (props.assignmentCount === 0) return 'ยังไม่มีงานในห้องนี้'
  if (remaining.value === 0) return 'ส่งครบทุกงานแล้ว เก่งที่สุด!'
  if (progressPercent.value >= 60) return `เหลืออีก ${remaining.value} งาน ใกล้แล้ว สู้ ๆ!`
  return `เหลืออีก ${remaining.value} งาน ค่อย ๆ ทำไปทีละชิ้นนะ`
})

// แยกกลุ่มตาม daysLeft
const overdue = computed(() => props.upcomingAssignments.filter(a => a.daysLeft <= 0))
const upcoming = computed(() =>
  props.upcomingAssignments.filter(a => a.daysLeft > 0).sort((a, b) => a.daysLeft - b.daysLeft)
)

// --- แบ่งหน้า (หน้าละ 4 ใบ = 2 แถว x 2 คอลัมน์) ---
const pageSize = 4

const overduePage = ref(1)
const upcomingPage = ref(1)

const overdueTotalPages = computed(() => Math.max(1, Math.ceil(overdue.value.length / pageSize)))
const upcomingTotalPages = computed(() => Math.max(1, Math.ceil(upcoming.value.length / pageSize)))

const pagedOverdue = computed(() => {
  const start = (overduePage.value - 1) * pageSize
  return overdue.value.slice(start, start + pageSize)
})
const pagedUpcoming = computed(() => {
  const start = (upcomingPage.value - 1) * pageSize
  return upcoming.value.slice(start, start + pageSize)
})

// ถ้าจำนวนหน้าลดลง (เช่น ส่งงานแล้วรายการหาย) ไม่ให้เกินหน้าสุดท้าย
watch(overdueTotalPages, (n) => { if (overduePage.value > n) overduePage.value = n })
watch(upcomingTotalPages, (n) => { if (upcomingPage.value > n) upcomingPage.value = n })

const linkFor = (a) =>
  a.kind === 'quiz'
    ? { name: 'student-quiz-detail', params: { id: props.classroomId, quizId: a.id } }
    : { name: 'student-assignment-detail', params: { id: props.classroomId, assignmentId: a.id } }

const timeText = (a) => {
  if (a.daysLeft < 0) return `เลยมา ${Math.abs(a.daysLeft)} วัน`
  if (a.daysLeft === 0) return 'ครบกำหนดแล้ว'
  if (a.daysLeft === 1) return 'พรุ่งนี้!'
  return `อีก ${a.daysLeft} วัน`
}

const urgencyClass = (a) => {
  if (a.daysLeft <= 0) return { card: 'bg-[#ffe0e0]', chip: 'bg-[#f44336] text-white', icon: 'bg-[#ffb4b4]' }
  if (a.daysLeft <= 2) return { card: 'bg-[#fff0d6]', chip: 'bg-orange text-dark', icon: 'bg-[#ffd699]' }
  return { card: 'bg-white', chip: 'bg-purple-light text-dark', icon: 'bg-purple-light' }
}
</script>

<template>
  <div class="max-w-[1000px] mx-auto px-4 sm:px-6 py-8">
    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="sm:col-span-2 h-[150px] border-[3px] border-dark rounded-2xl bg-gray-light animate-pulse" />
      <div class="h-[150px] border-[3px] border-dark rounded-2xl bg-gray-light animate-pulse" />
    </div>

    <template v-else>
      <!-- ===== แถวสรุป ===== -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- การ์ดความคืบหน้า -->
        <div
          v-if="showProgress && isStudent"
          class="sm:col-span-2 bg-[#c8e6c9] border-[3px] border-dark rounded-2xl p-5
                 shadow-[6px_6px_0_#1a1a1a] hover:-translate-y-1 hover:shadow-[8px_8px_0_#1a1a1a] transition"
        >
          <div class="flex items-center gap-2 mb-3">
            <CheckCircle2 :size="22" :stroke-width="2.5" />
            <span class="font-mali font-bold text-[16px]">{{ submittedLabel }}</span>
          </div>

          <div class="flex items-end gap-2">
            <span class="text-[48px] leading-none font-bold">{{ submittedCount }}</span>
            <span class="text-[22px] leading-none font-bold text-dark/50 mb-1">/ {{ assignmentCount }}</span>
            <span class="ml-auto font-mono text-[13px] font-bold border-2 border-dark bg-white rounded-lg px-2.5 py-1">
              {{ progressPercent }}%
            </span>
          </div>

          <div class="mt-4 h-4 border-[3px] border-dark rounded-full bg-white overflow-hidden">
            <div
              class="h-full bg-green-dark transition-all duration-700"
              :style="{ width: progressPercent + '%' }"
            />
          </div>

          <p class="text-[13px] mt-3 font-medium">{{ cheerText }}</p>
        </div>

        <!-- ถ้าไม่โชว์ progress ให้โชว์การ์ดนับเฉยๆ -->
        <div
          v-else
          class="sm:col-span-2 bg-purple-light border-[3px] border-dark rounded-2xl p-5
                 shadow-[6px_6px_0_#1a1a1a] hover:-translate-y-1 hover:shadow-[8px_8px_0_#1a1a1a] transition"
        >
          <CheckCircle2 :size="22" :stroke-width="2.5" class="mb-3" />
          <p class="text-[48px] leading-none font-bold">{{ submittedCount }}</p>
          <p class="text-[13px] text-gray mt-2">{{ submittedLabel }}</p>
        </div>

        <!-- การ์ดเล็ก 2 ใบซ้อนกัน -->
        <div class="grid grid-cols-2 sm:grid-cols-1 gap-4">
          <div
            class="bg-white border-[3px] border-dark rounded-2xl px-4 py-3 flex items-center gap-3
                   shadow-[5px_5px_0_#1a1a1a] hover:-translate-y-1 transition"
          >
            <div class="w-10 h-10 shrink-0 rounded-xl border-[3px] border-dark bg-[#bbdefb] flex items-center justify-center">
              <ClipboardList :size="20" :stroke-width="2.5" />
            </div>
            <div>
              <p class="text-[24px] leading-none font-bold">{{ assignmentCount }}</p>
              <p class="text-[12px] text-gray mt-1">งานทั้งหมด</p>
            </div>
          </div>

          <div
            class="bg-white border-[3px] border-dark rounded-2xl px-4 py-3 flex items-center gap-3
                   shadow-[5px_5px_0_#1a1a1a] hover:-translate-y-1 transition"
          >
            <div class="w-10 h-10 shrink-0 rounded-xl border-[3px] border-dark bg-[#f8bbd0] flex items-center justify-center">
              <Users :size="20" :stroke-width="2.5" />
            </div>
            <div>
              <p class="text-[24px] leading-none font-bold">{{ memberCount }}</p>
              <p class="text-[12px] text-gray mt-1">สมาชิก</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== รายการงาน ===== -->
      <div v-if="isStudent" class="mt-8">
        <!-- ยังไม่มีงานเลย -->
        <div
          v-if="assignmentCount === 0"
          class="border-[3px] border-dashed border-dark/30 rounded-2xl p-8 text-center text-[13.5px] text-gray flex flex-col items-center gap-2"
        >
          <ClipboardList :size="26" :stroke-width="2.5" />
          ครูยังไม่ได้มอบหมายงานในห้องนี้
        </div>

        <!-- ไม่มีงานค้างแล้ว -->
        <div
          v-else-if="upcomingAssignments.length === 0"
          class="border-[3px] border-dashed border-dark/30 rounded-2xl p-8 text-center text-[13.5px] text-gray flex flex-col items-center gap-2"
        >
          <PartyPopper :size="26" :stroke-width="2.5" class="text-purple" />
          ไม่มีงานค้างแล้ว เก่งมาก!
        </div>

        <template v-else>
          <!-- กลุ่ม: เลยกำหนด -->
          <section v-if="overdue.length" class="mb-8">
            <h3 class="font-mali font-bold text-[17px] mb-3 flex items-center gap-2">
              <AlertTriangle :size="20" :stroke-width="2.5" class="text-[#f44336]" />
              เลยกำหนดแล้ว
              <span class="font-mono text-[12px] bg-[#f44336] text-white border-2 border-dark rounded-full px-2 py-0.5">
                {{ overdue.length }}
              </span>
            </h3>

            <ul class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <li v-for="a in pagedOverdue" :key="a.id">
                <router-link
                  :to="linkFor(a)"
                  class="group flex items-center gap-3 border-[3px] border-dark rounded-2xl px-3 py-3
                         shadow-[4px_4px_0_#1a1a1a] hover:-translate-y-1 hover:shadow-[6px_6px_0_#1a1a1a] transition"
                  :class="urgencyClass(a).card"
                >
                  <div
                    class="w-10 h-10 shrink-0 rounded-xl border-[3px] border-dark flex items-center justify-center"
                    :class="urgencyClass(a).icon"
                  >
                    <FileQuestion v-if="a.kind === 'quiz'" :size="20" :stroke-width="2.5" />
                    <ClipboardList v-else :size="20" :stroke-width="2.5" />
                  </div>

                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-[14px] truncate">{{ a.title }}</p>
                    <p class="text-[12px] text-gray mt-0.5">กำหนดส่ง {{ a.due_date }}</p>
                  </div>

                  <span
                    class="shrink-0 font-mono text-[11.5px] font-bold border-2 border-dark rounded-lg px-2 py-1"
                    :class="urgencyClass(a).chip"
                  >
                    {{ timeText(a) }}
                  </span>
                  <ChevronRight :size="18" :stroke-width="3" class="shrink-0 group-hover:translate-x-0.5 transition" />
                </router-link>
              </li>
            </ul>

            <!-- เปลี่ยนหน้า (เลยกำหนด) -->
            <div v-if="overdueTotalPages > 1" class="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                aria-label="หน้าก่อนหน้า"
                :disabled="overduePage === 1"
                class="w-9 h-9 rounded-lg border-2 border-dark bg-white flex items-center justify-center
                       hover:bg-gray-light hover:-translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none transition"
                @click="overduePage--"
              >
                <ChevronLeft :size="16" :stroke-width="3" />
              </button>

              <button
                v-for="p in overdueTotalPages"
                :key="p"
                type="button"
                :aria-current="p === overduePage ? 'page' : undefined"
                class="min-w-[36px] h-9 px-2 rounded-lg border-2 border-dark text-[13px] font-bold transition"
                :class="p === overduePage
                  ? 'bg-orange text-dark'
                  : 'bg-white text-dark hover:bg-gray-light hover:-translate-y-0.5'"
                @click="overduePage = p"
              >
                {{ p }}
              </button>

              <button
                type="button"
                aria-label="หน้าถัดไป"
                :disabled="overduePage === overdueTotalPages"
                class="w-9 h-9 rounded-lg border-2 border-dark bg-white flex items-center justify-center
                       hover:bg-gray-light hover:-translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none transition"
                @click="overduePage++"
              >
                <ChevronRight :size="16" :stroke-width="3" />
              </button>
            </div>
          </section>

          <!-- กลุ่ม: ใกล้ถึงกำหนด -->
          <section v-if="upcoming.length">
            <h3 class="font-mali font-bold text-[17px] mb-3 flex items-center gap-2">
              <CalendarClock :size="20" :stroke-width="2.5" />
              ใกล้ถึงกำหนด
              <span class="font-mono text-[12px] bg-orange border-2 border-dark rounded-full px-2 py-0.5">
                {{ upcoming.length }}
              </span>
            </h3>

            <ul class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <li v-for="a in pagedUpcoming" :key="a.id">
                <router-link
                  :to="linkFor(a)"
                  class="group flex items-center gap-3 border-[3px] border-dark rounded-2xl px-3 py-3
                         shadow-[4px_4px_0_#1a1a1a] hover:-translate-y-1 hover:shadow-[6px_6px_0_#1a1a1a] transition"
                  :class="urgencyClass(a).card"
                >
                  <div
                    class="w-10 h-10 shrink-0 rounded-xl border-[3px] border-dark flex items-center justify-center"
                    :class="urgencyClass(a).icon"
                  >
                    <FileQuestion v-if="a.kind === 'quiz'" :size="20" :stroke-width="2.5" />
                    <ClipboardList v-else :size="20" :stroke-width="2.5" />
                  </div>

                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-[14px] truncate">{{ a.title }}</p>
                    <p class="text-[12px] text-gray mt-0.5">กำหนดส่ง {{ a.due_date }}</p>
                  </div>

                  <span
                    class="shrink-0 font-mono text-[11.5px] font-bold border-2 border-dark rounded-lg px-2 py-1 flex items-center gap-1"
                    :class="urgencyClass(a).chip"
                  >
                    <Flame v-if="a.daysLeft <= 2" :size="12" :stroke-width="3" />
                    {{ timeText(a) }}
                  </span>
                  <ChevronRight :size="18" :stroke-width="3" class="shrink-0 group-hover:translate-x-0.5 transition" />
                </router-link>
              </li>
            </ul>

            <!-- เปลี่ยนหน้า (ใกล้ถึงกำหนด) -->
            <div v-if="upcomingTotalPages > 1" class="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                aria-label="หน้าก่อนหน้า"
                :disabled="upcomingPage === 1"
                class="w-9 h-9 rounded-lg border-2 border-dark bg-white flex items-center justify-center
                       hover:bg-gray-light hover:-translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none transition"
                @click="upcomingPage--"
              >
                <ChevronLeft :size="16" :stroke-width="3" />
              </button>

              <button
                v-for="p in upcomingTotalPages"
                :key="p"
                type="button"
                :aria-current="p === upcomingPage ? 'page' : undefined"
                class="min-w-[36px] h-9 px-2 rounded-lg border-2 border-dark text-[13px] font-bold transition"
                :class="p === upcomingPage
                  ? 'bg-orange text-dark'
                  : 'bg-white text-dark hover:bg-gray-light hover:-translate-y-0.5'"
                @click="upcomingPage = p"
              >
                {{ p }}
              </button>

              <button
                type="button"
                aria-label="หน้าถัดไป"
                :disabled="upcomingPage === upcomingTotalPages"
                class="w-9 h-9 rounded-lg border-2 border-dark bg-white flex items-center justify-center
                       hover:bg-gray-light hover:-translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none transition"
                @click="upcomingPage++"
              >
                <ChevronRight :size="16" :stroke-width="3" />
              </button>
            </div>
          </section>
        </template>
      </div>
    </template>
  </div>
</template>