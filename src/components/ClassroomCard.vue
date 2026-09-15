<script setup>
import { Users, ClipboardList, Clock } from 'lucide-vue-next'
defineProps({
    name: { type: String, required: true },        // ชื่อวิชา
    gradeLevel: { type: String, default: '' },      // ระดับชั้น เช่น ปวส.2/3
    teacherName: { type: String, default: '' },     // ชื่อครูผู้สอน
    avatarImg: { type: String, default: '' },       // รูปโปรไฟล์ครู
    colorFrom: { type: String, required: true },
    colorTo: { type: String, required: true },
    memberCount: { type: Number, default: 0 },
    badges: { type: Array, default: () => [] },
    emptyLabel: { type: String, default: '' }
})

const badgeClass = {
    pending: 'bg-orange text-dark',
    alert: 'bg-danger text-white',
    done: 'bg-green-100 text-green-dark',
}

function formatCount(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
    return n.toString()
}
</script>

<template>
    <div class="bg-white border-3 border-dark rounded-2xl shadow-offset overflow-hidden 
            transition hover:-translate-y-1.5 hover:shadow-offset-lg
            flex flex-col h-full">
        <!-- Banner -->

        <div class="relative h-[100px] border-b-3 border-dark px-4 pt-4"
            :style="{ background: `linear-gradient(135deg, ${colorFrom} 0%, ${colorTo} 100%)` }">
            <h3 class="font-mali font-bold text-lg text-dark leading-snug pr-14 line-clamp-1">{{ name }}</h3>
           <span v-if="gradeLevel" class="block text-[12px] text-dark/80 font-semibold mt-1 pr-14 truncate">{{ gradeLevel }}</span>
            <span v-if="teacherName" class="block font-mono text-[11px] text-dark/70 mt-1 pr-14">{{
                teacherName }}</span>

            <!-- รูปครู ทับขอบล่าง banner -->
            <div
                class="absolute -bottom-[24px] right-5 w-[52px] h-[52px] rounded-full bg-white border-3 border-dark overflow-hidden flex items-center justify-center">
                <img v-if="avatarImg" :src="avatarImg" class="w-full h-full object-cover" alt="รูปโปรไฟล์ครูผู้สอน" />
                <span v-else class="text-xl">🧑‍🏫</span>
            </div>
        </div>

        <!-- Body: ขนาดขั้นต่ำเท่าที่ตั้งไว้ แต่ยืดได้ -->
        <div class="flex-1 min-h-[80px]"></div>

        <!-- Footer -->
        <div class="border-t-2 border-dashed border-gray-300 px-[18px] pt-5 pb-3.5 flex items-center justify-between">
            <span class="inline-flex items-center gap-1.5 text-[12.5px] text-gray">
                <Users :size="14" :stroke-width="2.5" />
                {{ formatCount(memberCount) }} คน
            </span>
            <span v-if="badges[0]"
                class="inline-flex items-center gap-1.5 border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold"
                :class="badgeClass[badges[0].type]">
                <component
                    :is="badges[0].type === 'pending' && badges[0].label.includes('ต้องส่ง') ? Clock : ClipboardList"
                    :size="12" :stroke-width="2.5" />
                {{ badges[0].label }}
            </span>
            <span v-else
                class="inline-flex items-center gap-1.5 border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold text-gray bg-white">
                <ClipboardList :size="12" :stroke-width="2.5" />
                {{ emptyLabel }}
            </span>
        </div>
    </div>
</template>