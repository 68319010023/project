<script setup>
import { getClassroomColor } from '../lib/classroomColors'

const props = defineProps({
  classroom: { type: Object, required: true },
  classroomId: { type: String, required: true },
})

const roomColor = getClassroomColor(props.classroomId)
</script>

<template>
  <div class="border-b-3 border-dark px-6 py-10"
       :style="{ background: `linear-gradient(135deg, ${roomColor.from} 0%, ${roomColor.to} 100%)` }">
    <div class="max-w-[1000px] mx-auto">
      <h1 class="font-mali text-3xl font-bold text-dark">{{ classroom.name }}</h1>
      <span v-if="classroom.grade_level"
            class="inline-block mt-2 font-bold text-[13px] border-2 border-dark rounded-full px-3 py-1 bg-white/70">
        {{ classroom.grade_level }}
      </span>
    </div>
  </div>
</template>