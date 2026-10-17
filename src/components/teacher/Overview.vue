<script setup>
import { ref, computed, watch } from 'vue'
import {
  Users, ClipboardList, FileQuestion, PartyPopper, BellRing,
  ChevronRight, ChevronLeft, Hourglass, ArrowRight, Flame,
} from 'lucide-vue-next'

const props = defineProps({
  classroomId: { type: String, required: true },
  memberCount: { type: Number, default: 0 },
  assignments: { type: Array, default: () => [] },
  submissions: { type: Array, default: () => [] },
  quizzes: { type: Array, default: () => [] },
  quizSubmissions: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['go-tab'])

// ---------- รวมการบ้าน + Quiz เป็นรายการเดียว พร้อมนับจำนวนส่ง/รอตรวจ ----------
const items = computed(() => {
  const a = props.assignments.map((x) => {
    const subs = props.submissions.filter((s) => s.assignment_id === x.id && s.submitted_at)
    return {
      id: x.id,
      kind: 'assignment',
      title: x.title,
      due_date: x.due_date,
      submitted: subs.length,
      // ยังไม่มีคะแนน = ยังไม่ได้ตรวจ
      pending: subs.filter((s) => s.score == null).length,
    }
  })
  const q = props.quizzes.map((x) => {
    const subs = props.quizSubmissions.filter((s) => s.quiz_id === x.id && s.submitted_at)
    return {
      id: x.id,
      kind: 'quiz',
      title: x.title,
      due_date: x.due_date,
      submitted: subs.length,
      // is_graded = false คือมีข้ออัตนัยที่ครูยังไม่ได้ตรวจ
      pending: subs.filter((s) => !s.is_graded).length,
    }
  })
  return [...a, ...q]
})

const totalPending = computed(() => items.value.reduce((sum, i) => sum + i.pending, 0))
const hasWork = computed(() => items.value.length > 0)

// ---------- รายการงานที่ต้องตรวจ (แบ่งหน้า) ----------
const pendingItems = computed(() =>
  items.value.filter((i) => i.pending > 0).sort((a, b) => b.pending - a.pending)
)

const pageSize = 4
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(pendingItems.value.length / pageSize)))
const pagedPending = computed(() => {
  const start = (page.value - 1) * pageSize
  return pendingItems.value.slice(start, start + pageSize)
})
watch(totalPages, (n) => { if (page.value > n) page.value = n })

// ---------- ใกล้ครบกำหนด และยังมีคนไม่ส่ง ----------
const dueSoonMissing = computed(() => {
  const now = new Date()
  return items.value
    .filter((i) => i.due_date)
    .map((i) => {
      const due = new Date(i.due_date)
      return {
        ...i,
        due,
        daysLeft: Math.ceil((due - now) / (1000 * 60 * 60 * 24)),
        missing: Math.max(0, props.memberCount - i.submitted),
      }
    })
    .filter((i) => i.due >= now && i.daysLeft <= 3 && i.missing > 0)
    .sort((a, b) => a.due - b.due)
    .slice(0, 4)
})

// ---------- helper ----------
const linkFor = (i) =>
  i.kind === 'quiz'
    ? { name: 'teacher-quiz-detail', params: { id: props.classroomId, quizId: i.id } }
    : { name: 'teacher-assignment-detail', params: { id: props.classroomId, assignmentId: i.id } }

const percent = (i) => {
  if (!props.memberCount) return 0
  return Math.min(100, Math.round((i.submitted / props.memberCount) * 100))
}

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

const dueText = (daysLeft) => {
  if (daysLeft <= 0) return 'วันนี้!'
  if (daysLeft === 1) return 'พรุ่งนี้!'
  return `อีก ${daysLeft} วัน`
}

const assignmentTotal = computed(() => props.assignments.length)
const quizTotal = computed(() => props.quizzes.length)
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
        <!-- การ์ดใหญ่: รอตรวจ -->
        <button
          type="button"
          class="sm:col-span-2 text-left border-[3px] border-dark rounded-2xl p-5
                 shadow-[6px_6px_0_#1a1a1a] hover:-translate-y-1 hover:shadow-[8px_8px_0_#1a1a1a] transition"
          :class="totalPending > 0 ? 'bg-[#ffd699]' : 'bg-[#c8e6c9]'"
          @click="emit('go-tab', 'assignments')"
        >
          <div class="flex items-center gap-2 mb-3">
            <BellRing v-if="totalPending > 0" :size="22" :stroke-width="2.5" />
            <PartyPopper v-else :size="22" :stroke-width="2.5" />
            <span class="font-mali font-bold text-[16px]">
              {{ totalPending > 0 ? 'รอตรวจ' : 'ตรวจครบแล้ว' }}
            </span>
          </div>

          <div class="flex items-end gap-2">
            <span class="text-[48px] leading-none font-bold">{{ totalPending }}</span>
            <span class="text-[18px] leading-none font-bold text-dark/60 mb-1">ชิ้น</span>
          </div>

          <p class="text-[13px] mt-3 font-medium flex items-center gap-1.5">
            <template v-if="!hasWork">ยังไม่ได้สร้างงานในห้องนี้</template>
            <template v-else-if="totalPending > 0">
              ไปที่แท็บการบ้านเพื่อเริ่มตรวจ
              <ArrowRight :size="14" :stroke-width="3" />
            </template>
            <template v-else>ไม่มีงานค้างตรวจ เยี่ยมมาก!</template>
          </p>
        </button>

        <!-- การ์ดเล็ก -->
        <div class="grid grid-cols-3 sm:grid-cols-1 gap-4">
          <div class="bg-white border-[3px] border-dark rounded-2xl px-3 sm:px-4 py-3 flex items-center gap-3
                      shadow-[5px_5px_0_#1a1a1a] hover:-translate-y-1 transition">
            <div class="w-10 h-10 shrink-0 rounded-xl border-[3px] border-dark bg-[#f8bbd0] flex items-center justify-center">
              <Users :size="20" :stroke-width="2.5" />
            </div>
            <div>
              <p class="text-[22px] leading-none font-bold">{{ memberCount }}</p>
              <p class="text-[12px] text-gray mt-1">นักเรียน</p>
            </div>
          </div>

          <div class="bg-white border-[3px] border-dark rounded-2xl px-3 sm:px-4 py-3 flex items-center gap-3
                      shadow-[5px_5px_0_#1a1a1a] hover:-translate-y-1 transition">
            <div class="w-10 h-10 shrink-0 rounded-xl border-[3px] border-dark bg-[#bbdefb] flex items-center justify-center">
              <ClipboardList :size="20" :stroke-width="2.5" />
            </div>
            <div>
              <p class="text-[22px] leading-none font-bold">{{ assignmentTotal }}</p>
              <p class="text-[12px] text-gray mt-1">การบ้าน</p>
            </div>
          </div>

          <div class="bg-white border-[3px] border-dark rounded-2xl px-3 sm:px-4 py-3 flex items-center gap-3
                      shadow-[5px_5px_0_#1a1a1a] hover:-translate-y-1 transition">
            <div class="w-10 h-10 shrink-0 rounded-xl border-[3px] border-dark bg-purple-light flex items-center justify-center">
              <FileQuestion :size="20" :stroke-width="2.5" />
            </div>
            <div>
              <p class="text-[22px] leading-none font-bold">{{ quizTotal }}</p>
              <p class="text-[12px] text-gray mt-1">Quiz</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ยังไม่มีงานเลย -->
      <div
        v-if="!hasWork"
        class="mt-8 border-[3px] border-dashed border-dark/30 rounded-2xl p-8 text-center text-[13.5px] text-gray flex flex-col items-center gap-3"
      >
        <ClipboardList :size="26" :stroke-width="2.5" />
        ยังไม่ได้มอบหมายงานในห้องนี้
        <button
          type="button"
          class="border-[3px] border-dark rounded-xl px-4 py-1.5 bg-orange text-dark font-semibold
                 shadow-[3px_3px_0_#1a1a1a] hover:-translate-y-0.5 transition"
          @click="emit('go-tab', 'assignments')"
        >
          ไปสร้างงานแรก
        </button>
      </div>

      <template v-else>
        <!-- ===== งานที่ต้องตรวจ ===== -->
        <section class="mt-8">
          <h3 class="font-mali font-bold text-[17px] mb-3 flex items-center gap-2">
            <BellRing :size="20" :stroke-width="2.5" />
            งานที่ต้องตรวจ
            <span
              v-if="pendingItems.length"
              class="font-mono text-[12px] bg-orange border-2 border-dark rounded-full px-2 py-0.5"
            >
              {{ pendingItems.length }}
            </span>
          </h3>

          <div
            v-if="pendingItems.length === 0"
            class="border-[3px] border-dashed border-dark/30 rounded-2xl p-8 text-center text-[13.5px] text-gray flex flex-col items-center gap-2"
          >
            <PartyPopper :size="26" :stroke-width="2.5" class="text-purple" />
            ไม่มีงานรอตรวจ
          </div>

          <template v-else>
            <ul class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <li v-for="i in pagedPending" :key="i.kind + i.id">
                <router-link
                  :to="linkFor(i)"
                  class="group flex items-center gap-3 border-[3px] border-dark rounded-2xl px-3 py-3 bg-white
                         shadow-[4px_4px_0_#1a1a1a] hover:-translate-y-1 hover:shadow-[6px_6px_0_#1a1a1a] transition"
                >
                  <div
                    class="w-10 h-10 shrink-0 rounded-xl border-[3px] border-dark flex items-center justify-center"
                    :class="i.kind === 'quiz' ? 'bg-purple-light' : 'bg-[#bbdefb]'"
                  >
                    <FileQuestion v-if="i.kind === 'quiz'" :size="20" :stroke-width="2.5" />
                    <ClipboardList v-else :size="20" :stroke-width="2.5" />
                  </div>

                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-[14px] truncate">{{ i.title }}</p>
                    <div class="flex items-center gap-2 mt-1.5">
                      <div class="flex-1 h-2.5 border-2 border-dark rounded-full bg-white overflow-hidden">
                        <div class="h-full bg-green-dark transition-all duration-700" :style="{ width: percent(i) + '%' }" />
                      </div>
                      <span class="shrink-0 text-[11.5px] text-gray">ส่งแล้ว {{ i.submitted }}/{{ memberCount }}</span>
                    </div>
                  </div>

                  <span class="shrink-0 font-mono text-[11.5px] font-bold border-2 border-dark rounded-lg px-2 py-1 bg-orange text-dark">
                    รอตรวจ {{ i.pending }}
                  </span>
                  <ChevronRight :size="18" :stroke-width="3" class="shrink-0 group-hover:translate-x-0.5 transition" />
                </router-link>
              </li>
            </ul>

            <!-- เปลี่ยนหน้า -->
            <div v-if="totalPages > 1" class="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                aria-label="หน้าก่อนหน้า"
                :disabled="page === 1"
                class="w-9 h-9 rounded-lg border-2 border-dark bg-white flex items-center justify-center
                       hover:bg-gray-light hover:-translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none transition"
                @click="page--"
              >
                <ChevronLeft :size="16" :stroke-width="3" />
              </button>

              <button
                v-for="p in totalPages"
                :key="p"
                type="button"
                :aria-current="p === page ? 'page' : undefined"
                class="min-w-[36px] h-9 px-2 rounded-lg border-2 border-dark text-[13px] font-bold transition"
                :class="p === page
                  ? 'bg-orange text-dark'
                  : 'bg-white text-dark hover:bg-gray-light hover:-translate-y-0.5'"
                @click="page = p"
              >
                {{ p }}
              </button>

              <button
                type="button"
                aria-label="หน้าถัดไป"
                :disabled="page === totalPages"
                class="w-9 h-9 rounded-lg border-2 border-dark bg-white flex items-center justify-center
                       hover:bg-gray-light hover:-translate-y-0.5 disabled:opacity-40 disabled:pointer-events-none transition"
                @click="page++"
              >
                <ChevronRight :size="16" :stroke-width="3" />
              </button>
            </div>
          </template>
        </section>

        <!-- ===== ใกล้ครบกำหนด แต่ยังมีคนไม่ส่ง ===== -->
        <section v-if="dueSoonMissing.length" class="mt-8">
          <h3 class="font-mali font-bold text-[17px] mb-3 flex items-center gap-2">
            <Hourglass :size="20" :stroke-width="2.5" />
            ใกล้ครบกำหนด ยังมีคนไม่ส่ง
          </h3>

          <ul class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <li v-for="i in dueSoonMissing" :key="i.kind + i.id">
              <router-link
                :to="linkFor(i)"
                class="group flex items-center gap-3 border-[3px] border-dark rounded-2xl px-3 py-3 bg-[#fff0d6]
                       shadow-[4px_4px_0_#1a1a1a] hover:-translate-y-1 hover:shadow-[6px_6px_0_#1a1a1a] transition"
              >
                <div class="w-10 h-10 shrink-0 rounded-xl border-[3px] border-dark bg-[#ffd699] flex items-center justify-center">
                  <FileQuestion v-if="i.kind === 'quiz'" :size="20" :stroke-width="2.5" />
                  <ClipboardList v-else :size="20" :stroke-width="2.5" />
                </div>

                <div class="min-w-0 flex-1">
                  <p class="font-semibold text-[14px] truncate">{{ i.title }}</p>
                  <p class="text-[12px] text-gray mt-0.5">
                    กำหนดส่ง {{ fmtDate(i.due_date) }} · ยังไม่ส่ง {{ i.missing }} คน
                  </p>
                </div>

                <span class="shrink-0 font-mono text-[11.5px] font-bold border-2 border-dark rounded-lg px-2 py-1 bg-orange text-dark flex items-center gap-1">
                  <Flame :size="12" :stroke-width="3" />
                  {{ dueText(i.daysLeft) }}
                </span>
                <ChevronRight :size="18" :stroke-width="3" class="shrink-0 group-hover:translate-x-0.5 transition" />
              </router-link>
            </li>
          </ul>
        </section>
      </template>
    </template>
  </div>
</template>