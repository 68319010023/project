<script setup>
import { ClipboardList, Calendar, Star, ChevronRight } from 'lucide-vue-next'

const props = defineProps({
  classroomId: { type: String, required: true },
  assignments: { type: Array, default: () => [] },
  assignmentsLoading: { type: Boolean, default: false },
  submissionsLoading: { type: Boolean, default: false },
  mySubmissionFor: { type: Function, required: true },
  formatDate: { type: Function, required: true },
  isLate: { type: Function, required: true },
})
</script>

<template>
  <div class="max-w-[1000px] mx-auto px-6 py-8">
    <h2 class="font-mali text-xl font-bold text-dark mb-5 flex items-center gap-2">
      <ClipboardList :size="20" :stroke-width="2.5" />
      การบ้าน
      <span class="text-[13px] text-gray font-mitr font-normal">({{ assignments.length }})</span>
    </h2>

    <div v-if="assignmentsLoading || submissionsLoading" class="text-gray text-[13px]">
      กำลังโหลดการบ้าน...
    </div>

    <div v-else-if="assignments.length === 0"
      class="bg-white border-3 border-dashed border-dark/30 rounded-2xl p-8 text-center text-gray text-[13.5px]">
      ยังไม่มีการบ้านในห้องนี้
    </div>

    <ul v-else class="flex flex-col gap-5">
      <li v-for="assignment in assignments" :key="assignment.id">
        <router-link
          :to="{ name: 'student-assignment-detail', params: { id: classroomId, assignmentId: assignment.id } }" class="block bg-white border-3 border-dark rounded-2xl shadow-offset p-5
                 hover:-translate-y-1 hover:shadow-offset-lg transition">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="font-mali font-bold text-[17px] text-dark">{{ assignment.title }}</p>
              <p v-if="assignment.description" class="text-[13px] text-gray mt-1.5 line-clamp-1">
                {{ assignment.description }}
              </p>
              <div class="flex items-center gap-4 mt-2.5 flex-wrap">
                <span class="inline-flex items-center gap-1.5 text-[12px] text-gray font-mono">
                  <Calendar :size="13" :stroke-width="2.5" />
                  ส่งภายใน {{ formatDate(assignment.due_date) }}
                </span>
                <span class="inline-flex items-center gap-1.5 text-[12px] text-gray font-mono">
                  <Star :size="13" :stroke-width="2.5" />
                  {{ assignment.max_score }} คะแนน
                </span>
              </div>
            </div>

            <div class="shrink-0 flex items-center gap-2">
              <span
                v-if="mySubmissionFor(assignment.id)?.score !== null && mySubmissionFor(assignment.id)?.score !== undefined"
                class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold bg-green-100 text-green-dark whitespace-nowrap">
                ✓ {{ mySubmissionFor(assignment.id).score }}/{{ assignment.max_score }}
              </span>
              <span v-else-if="mySubmissionFor(assignment.id)"
                class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold whitespace-nowrap"
                :class="isLate(assignment.due_date, mySubmissionFor(assignment.id).submitted_at)
                  ? 'bg-red-100 text-red-600'
                  : 'bg-purple-light text-dark'">
                ✓ {{ isLate(assignment.due_date, mySubmissionFor(assignment.id).submitted_at) ? 'ส่งล่าช้า' : 'ส่งแล้ว'
                }}
              </span>
              <span v-else
                class="border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold whitespace-nowrap"
                :class="isLate(assignment.due_date) ? 'bg-red-100 text-red-600' : 'bg-orange text-dark'">
                {{ isLate(assignment.due_date) ? 'เลยกำหนดส่งแล้ว' : 'ยังไม่ส่ง' }}
              </span>
              <ChevronRight :size="18" :stroke-width="2.5" class="text-gray shrink-0" />
            </div>
          </div>
        </router-link>
      </li>
    </ul>
  </div>
</template>