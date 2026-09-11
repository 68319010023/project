<script setup>
defineProps({
    name: { type: String, required: true },
    code: { type: String, required: true },
    subLabel: { type: String, default: '' }, // ชื่อครู (สำหรับนักเรียน) หรือ รหัสห้อง (สำหรับครู)
    avatarImg: { type: String, default: '' },
    colorFrom: { type: String, required: true },
    colorTo: { type: String, required: true },
    memberCount: { type: Number, default: 0 },
    badges: { type: Array, default: () => [] } // [{ label, type: 'pending' | 'alert' | 'done' }]
})

const badgeClass = {
    pending: 'bg-orange text-dark',
    alert: 'bg-danger text-white',
    done: 'bg-green-100 text-green-dark',
}
</script>

<template>
    <div class="bg-white border-3 border-dark rounded-2xl shadow-offset overflow-hidden transition hover:-translate-y-1.5 hover:shadow-offset-lg">
        <!-- Banner -->
        <div class="relative h-[110px] border-b-3 border-dark"
            :style="{ background: `linear-gradient(135deg, ${colorFrom} 0%, ${colorTo} 100%)` }">
            <h3 class="absolute left-4 top-4 font-mali font-bold text-lg text-dark">{{ name }}</h3>
            <span class="absolute left-4 top-[42px] font-mono text-[11px] text-dark/70">{{ subLabel }}</span>
            <div class="absolute -bottom-[22px] right-5 w-[52px] h-[52px] rounded-full bg-orange border-3 border-dark overflow-hidden">
                <img v-if="avatarImg" :src="avatarImg" class="w-full h-full object-cover" alt="avatar" />
            </div>
        </div>

        <!-- Body -->
        <div class="px-[18px] pt-9 pb-3.5">
            <div class="flex flex-wrap gap-2">
                <span v-for="(badge, i) in badges" :key="i"
                    class="inline-flex items-center border-2 border-dark rounded-2xl px-3 py-1 font-mono text-[11px] font-bold"
                    :class="badgeClass[badge.type]">
                    {{ badge.label }}
                </span>
            </div>
        </div>

        <!-- Footer -->
        <div class="border-t-2 border-dashed border-gray-300 px-[18px] py-3 flex items-center justify-between">
            <span class="text-[12.5px] text-gray">👥 {{ memberCount }} คน</span>
            <div class="w-[34px] h-[34px] rounded-lg border-2 border-dark flex items-center justify-center text-sm bg-white">
                📊
            </div>
        </div>
    </div>
</template>