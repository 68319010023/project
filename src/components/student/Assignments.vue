<script setup>
import { computed } from 'vue'
import { ClipboardList, FileQuestion, Calendar, Star, ChevronRight } from 'lucide-vue-next'

const props = defineProps({
  classroomId: { type: String, required: true },
  assignments: { type: Array, default: () => [] },
  assignmentsLoading: { type: Boolean, default: false },
  submissionsLoading: { type: Boolean, default: false },
  mySubmissionFor: { type: Function, required: true },
  quizzes: { type: Array, default: () => [] },
  quizzesLoading: { type: Boolean, default: false },
  myQuizSubmissionFor: { type: Function, required: true },
  formatDate: { type: Function, required: true },
  isLate: { type: Function, required: true },
})

// รวมการบ้าน + quiz เป็น list เดียว เรียงตามวันที่สร้าง ล่าสุดขึ้นก่อน
const combinedItems = computed(() => {
  const items = [
    ...props.assignments.map((a) => ({ ...a, kind: 'assignment' })),
    ...props.quizzes.map((q) => ({ ...q, kind: 'quiz' })),
  ]
  return items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
})
</script>

<template>
  <div class="max-w-[1000px] mx-auto px-6 py-8">
    <h2 class="font-mali text-xl font-bold text-dark mb-5 flex items-center gap-2">
      <ClipboardList :size="20" :stroke-width="2.5" />
      งานทั้งหมด
      <span class="text-[13px] text-gray font-mitr font-normal">({{ combinedItems.length }})</span>
    </h2>

    <div v-if="assignmentsLoading || submissionsLoading || quizzesLoading" class="text-gray text-[13px]">
      กำลังโหลด...
    </div>

    <div v-else-if="combinedItems.length === 0"
      class="bg-white border-3 border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
      ยังไม่มีงานในห้องนี้
    </div>

    <ul v-else class="flex flex-col gap-5">
      <li v-for="item in combinedItems" :key="`${item.kind}-${item.id}`">
        <!-- การ์ดการบ้าน -->
        <router-link v-if="item.kind === 'assignment'"
          :to="{ name: 'student-assignment-detail', params: { id: classroomId, assignmentId: item.id } }" class="flex items-start gap-3 bg-white border-3 border-dark rounded-2xl shadow-offset p-5
             hover:-translate-y-1 hover:shadow-offset-lg transition">
          <div class="w-10 h-10 shrink-0 rounded-lg border-2 border-dark bg-orange flex items-center justify-center">
            <ClipboardList :size="18" :stroke-width="2.5" class="text-dark" />
          </div>
          <div class="flex-1 min-w-0 flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="font-mali font-bold text-[17px] text-dark">{{ item.title }}</p>
              <p v-if="item.description" class="text-[13px] text-gray mt-1.5 line-clamp-1">
                {{ item.description }}
              </p>
              <div class="flex items-center gap-4 mt-2.5 flex-wrap">
                <span v-if="item.due_date" class="inline-flex items-center gap-1.5 text-[12px] text-gray font-mono">
                  <Calendar :size="13" :stroke-width="2.5" />
                  ส่งภายใน {{ formatDate(item.due_date) }}
                </span>
                <span class="inline-flex items-center gap-1.5 text-[12px] text-gray font-mono">
                  <Star :size="13" :stroke-width="2.5" />
                  {{ item.max_score }} คะแนน
                </span>
              </div>
            </div>

            <div class="shrink-0 flex items-center gap-2">
              <span v-if="mySubmissionFor(item.id)?.score !== null && mySubmissionFor(item.id)?.score !== undefined"
                class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-green-100 text-green-dark whitespace-nowrap">
                ✓ {{ mySubmissionFor(item.id).score }}/{{ item.max_score }}
              </span>
              <span v-else-if="mySubmissionFor(item.id)"
                class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold whitespace-nowrap"
                :class="isLate(item.due_date, mySubmissionFor(item.id).submitted_at) ? 'bg-red-100 text-red-600' : 'bg-purple-light text-dark'">
                ✓ {{ isLate(item.due_date, mySubmissionFor(item.id).submitted_at) ? 'ส่งล่าช้า' : 'ส่งแล้ว' }}
              </span>
              <span v-else
                class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold whitespace-nowrap"
                :class="isLate(item.due_date) ? 'bg-red-100 text-red-600' : 'bg-orange text-dark'">
                {{ isLate(item.due_date) ? 'เลยกำหนดส่งแล้ว' : 'ยังไม่ส่ง' }}
              </span>
              <ChevronRight :size="18" :stroke-width="2.5" class="text-gray shrink-0" />
            </div>
          </div>
        </router-link>

        <!-- การ์ด Quiz -->
        <router-link v-else :to="{ name: 'student-quiz-detail', params: { id: classroomId, quizId: item.id } }" class="flex items-start gap-3 bg-white border-3 border-dark rounded-2xl shadow-offset p-5
             hover:-translate-y-1 hover:shadow-offset-lg transition">
          <div
            class="w-10 h-10 shrink-0 rounded-lg border-2 border-dark bg-purple-light flex items-center justify-center">
            <FileQuestion :size="18" :stroke-width="2.5" class="text-dark" />
          </div>
          <div class="flex-1 min-w-0 flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="font-mali font-bold text-[17px] text-dark">{{ item.title }}</p>
              <div class="flex items-center gap-4 mt-2.5 flex-wrap">
                <span v-if="item.due_date" class="inline-flex items-center gap-1.5 text-[12px] text-gray font-mono">
                  <Calendar :size="13" :stroke-width="2.5" />
                  ส่งภายใน {{ formatDate(item.due_date) }}
                </span>
                <span class="inline-flex items-center gap-1.5 text-[12px] text-gray font-mono">
                  <Star :size="13" :stroke-width="2.5" />
                  {{ item.max_score }} คะแนน
                </span>
              </div>
            </div>

            <div class="shrink-0 flex items-center gap-2">
              <span v-if="myQuizSubmissionFor(item.id)?.is_graded"
                class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-green-100 text-green-dark whitespace-nowrap">
                ✓ {{ myQuizSubmissionFor(item.id).score }}/{{ item.max_score }}
              </span>
              <span v-else-if="myQuizSubmissionFor(item.id)"
                class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-purple-light text-dark whitespace-nowrap">
                ✓ ส่งแล้ว (รอตรวจ)
              </span>
              <span v-else
                class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-orange text-dark whitespace-nowrap">
                ยังไม่ทำ
              </span>
              <ChevronRight :size="18" :stroke-width="2.5" class="text-gray shrink-0" />
            </div>
          </div>
        </router-link>
      </li>
    </ul>
  </div>
</template>