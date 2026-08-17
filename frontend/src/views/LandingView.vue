<script setup>

import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'

const studentCount = ref(null)
const teacherCount = ref(null)
const totalCount = ref(null)
const timeline = ref([
    {
        date: 'ส.ค. 2568',
        title: 'เริ่มต้นโครงงาน',
        desc: 'วิเคราะห์ปัญหาการเรียนออนไลน์และตั้งโจทย์วิจัย'
    },
    {
        date: 'ก.ย. 2568',
        title: 'ออกแบบระบบ',
        desc: 'ออกแบบฐานข้อมูลและ UI/UX ของระบบ'
    },
    {
        date: 'ต.ค. 2568',
        title: 'พัฒนาระบบ',
        desc: 'พัฒนา Frontend และ Backend เชื่อมต่อ Supabase'
    },
    {
        date: 'พ.ย. 2568',
        title: 'ทดสอบและส่งมอบ',
        desc: 'ทดสอบระบบกับผู้ใช้จริงและนำเสนอโครงงาน'
    }
])
onMounted(async () => {
    const { count: students } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student')

    const { count: teachers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'teacher')

    const { count: total } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

    studentCount.value = students ?? 0
    teacherCount.value = teachers ?? 0
    totalCount.value = total ?? 0
})
</script>

<template>
    <div class="bg-white text-dark font-mitr">

        <!-- ========== 1. NAVBAR ========== -->
        <div class="sticky top-0 z-30 bg-dark border-b-4 border-purple min-h-[76px] md:h-[90px] flex items-center gap-2 sm:gap-4 px-4 sm:px-6 py-2 md:py-0 relative">
            <div class="flex min-w-0 items-center gap-2 sm:gap-3">
                <img src="/img/logo.png" class="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 object-cover shrink-0" alt="โลโก้">
                <div class="flex flex-col leading-tight">
                    <span class="font-mali font-bold text-sm sm:text-base md:text-lg text-white whitespace-nowrap">ห้องเรียนของฉัน</span>
                    <span class="font-mitr text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">by บารมี</span>
                </div>
            </div>
            <div class="hidden md:flex gap-1 absolute left-1/2 -translate-x-1/2">
                <a href="#problem"
                    class="nav-link-bounce px-3.5 py-2 rounded-lg text-base text-gray-300 hover:bg-white/10 hover:text-white transition-colors">ปัญหา</a>
                <a href="#history"
                    class="nav-link-bounce px-3.5 py-2 rounded-lg text-base text-gray-300 hover:bg-white/10 hover:text-white transition-colors">ความเป็นมา</a>
                <a href="#advisor"
                    class="nav-link-bounce px-3.5 py-2 rounded-lg text-base text-gray-300 hover:bg-white/10 hover:text-white transition-colors">ที่ปรึกษา</a>
                <a href="#research"
                    class="nav-link-bounce px-3.5 py-2 rounded-lg text-base text-gray-300 hover:bg-white/10 hover:text-white transition-colors">งานวิจัย</a>
            </div>

            <div class="flex-1"></div>

            <div class="flex shrink-0 gap-1 sm:gap-2">
                <router-link to="/login"
                    class="px-2 sm:px-[18px] py-2 rounded-lg border-2 border-gray-500 text-white text-[11px] sm:text-[13.5px] font-semibold whitespace-nowrap hover:border-white">เข้าสู่ระบบ</router-link>
                <router-link to="/register"
                    class="px-2 sm:px-[18px] py-2 rounded-lg border-2 border-dark bg-orange text-dark text-[11px] sm:text-[13.5px] font-semibold whitespace-nowrap hover:bg-white ">สมัครสมาชิก</router-link>
            </div>
        </div>

        <!-- ========== 2. HERO (เล็ก) ========== -->
        <section v-reveal class="max-w-[1100px] mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-10 text-center">
            <span
                class="inline-block font-mono text-[11.5px] font-bold bg-purple-light border-2 border-dark px-3.5 py-1.5 rounded-full mb-4">
                โครงงาน ปวส
            </span>
            <h1 class="text-outline text-[clamp(28px,4.5vw,42px)] leading-tight">
                ห้องเรียนที่ไม่ทิ้งใครไว้ข้างหลัง<br />แม้เรียนออนไลน์
            </h1>
            <p class="text-gray text-[15.5px] max-w-[520px] mx-auto mt-4 leading-loose">
                ระบบจัดการห้องเรียนที่มี AI ช่วยดูแลนักเรียนเป็นรายคน ไม่ใช่แค่ส่งการบ้านแล้วจบ
            </p>
            <div class="flex gap-3 justify-center mt-6 flex-wrap">
                <router-link to="/register"
                    class="px-[26px] py-3 rounded-[10px] border-2 border-dark bg-orange text-dark text-[14.5px] font-semibold shadow-offset-sm hover:-translate-y-0.5 hover:shadow-offset-sm-hover transition">เริ่มใช้งานฟรี</router-link>
                <a href="#problem"
                    class="px-[26px] py-3 rounded-[10px] border-2 border-dark bg-white text-dark text-[14.5px] font-semibold shadow-offset-sm hover:-translate-y-0.5 hover:shadow-offset-sm-hover transition">ดูรายละเอียดโครงงาน</a>
            </div>
        </section>


        <!-- ========== 3. STATS BAR ========== -->
        <section v-reveal class="max-w-[1100px] mx-auto px-4 sm:px-6 pb-10 sm:pb-14">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">

                <div class="bg-white border-3 border-dark rounded-[14px] px-4 py-5 text-center shadow-offset-sm">
                    <div class="font-mali font-bold text-3xl text-purple">
                        {{ studentCount === null ? '...' : studentCount }}
                    </div>
                    <div class="text-[12.5px] text-gray mt-1.5">นักศึกษาเข้าใช้งานทั้งหมด</div>
                </div>

                <div class="bg-white border-3 border-dark rounded-[14px] px-4 py-5 text-center shadow-offset-sm">
                    <div class="font-mali font-bold text-3xl text-purple">
                        {{ teacherCount === null ? '...' : teacherCount }}
                    </div>
                    <div class="text-[12.5px] text-gray mt-1.5">ครูที่เข้าใช้งานทั้งหมด</div>
                </div>

                <div class="bg-white border-3 border-dark rounded-[14px] px-4 py-5 text-center shadow-offset-sm">
                    <div class="font-mali font-bold text-3xl text-purple">
                        {{ totalCount === null ? '...' : totalCount }}
                    </div>
                    <div class="text-[12.5px] text-gray mt-1.5">ผู้ใช้งานรวมทั้งหมด</div>
                </div>

            </div>
        </section>

        <!-- ========== 4. ปัญหา ========== -->
        <section id="problem" v-reveal
            class="scroll-mt-[76px] md:scroll-mt-[88px] bg-gray-light rounded-2xl sm:rounded-3xl max-w-[1100px] mx-4 sm:mx-6 xl:mx-auto px-4 sm:px-6 py-10 sm:py-16">
            <div class="text-center max-w-[640px] mx-auto mb-10">
                <div class="font-mono text-[11px] font-bold text-purple tracking-widest uppercase">ที่มาของปัญหา</div>
                <h2 class="text-2xl mt-2">ทำไมถึงต้องมีระบบนี้</h2>
                <p class="text-gray text-[15px] leading-loose mt-3.5">
                    ผู้เรียนออนไลน์จำนวนมากขาดปฏิสัมพันธ์ทางสังคม (Social Isolation)
                    และมีความตื่นตัวในการเรียนรู้ลดลง เพราะแพลตฟอร์มเดิมเน้นแค่ส่งเนื้อหา/มอบหมายงาน
                    โดยไม่มีการสนับสนุนเฉพาะบุคคลให้กับนักเรียนแต่ละคนเลย
                </p>
            </div>

            <div class="grid sm:grid-cols-3 gap-5">

                <div class="bg-white border-3 border-dark rounded-2xl p-4 sm:p-6 shadow-offset text-center">
                    <div class="text-3xl mb-2">😔</div>
                    <div class="font-mali font-bold text-4xl text-danger leading-none">72%</div>
                    <div class="text-[13px] text-gray mt-2 leading-relaxed">
                        ของนักศึกษารายงานว่าการมีส่วนร่วมในชั้นเรียนที่ต่ำ ส่งผลเสียต่อประสบการณ์การเรียนออนไลน์
                    </div>
                </div>

                <div class="bg-white border-3 border-dark rounded-2xl p-4 sm:p-6 shadow-offset text-center">
                    <div class="text-3xl mb-2">📉</div>
                    <div class="font-mali font-bold text-4xl text-purple leading-none">1:40</div>
                    <div class="text-[13px] text-gray mt-2 leading-relaxed">
                        อัตราส่วนครูต่อนักเรียนโดยเฉลี่ย ทำให้ครูไม่มีเวลาดูแลนักเรียนเป็นรายบุคคล
                    </div>
                </div>

                <div class="bg-white border-3 border-dark rounded-2xl p-4 sm:p-6 shadow-offset text-center">
                    <div class="text-3xl mb-2">⏳</div>
                    <div class="font-mali font-bold text-4xl text-orange leading-none">45%</div>
                    <div class="text-[13px] text-gray mt-2 leading-relaxed">
                        ของนักเรียนที่เรียนออนไลน์ ส่งงานล่าช้าหรือไม่ส่งงาน เนื่องจากขาดการติดตามที่ต่อเนื่อง
                    </div>
                </div>

            </div>

            <p class="text-[11px] text-gray text-center mt-6">
                * ข้อมูลอ้างอิงจาก Frontiers in Education, "Engagement in Online Learning: Student Attitudes and
                Behavior During COVID-19" (2022)
            </p>
            <div
                class="mt-8 bg-dark border-3 border-dark rounded-2xl px-6 py-5 flex items-center gap-4 flex-wrap justify-center text-center">
                <div class="text-2xl">💡</div>
                <p class="text-white text-[14.5px] leading-relaxed">
                    เพราะปัญหานี้ <span class="text-orange font-semibold">"ห้องเรียนของฉัน"</span>
                    จึงถูกออกแบบมาเพื่อให้ AI ช่วยติดตามและดูแลนักเรียนเป็นรายคน
                    ไม่ปล่อยให้ใครหลุดออกจากระบบการเรียนรู้อีกต่อไป
                </p>
            </div>
        </section>

        <!-- ========== 5. ประวัติความเป็นมา ========== -->
        <div class="bg-gray-800">
            <section id="history" v-reveal class="scroll-mt-[76px] md:scroll-mt-[88px] max-w-[1100px] mx-auto px-4 sm:px-6 py-10 sm:py-16 bh">
                <div class="font-mono text-[11px] font-bold text-purple tracking-widest uppercase">Timeline</div>
                <h2 class="text-2xl mt-2 text-white">ประวัติความเป็นมาของโครงงาน</h2>

                <div class="mt-8 flex flex-col">
                    <div v-for="(item, i) in timeline" :key="item.title" class="flex gap-5">
                        <div class="flex flex-col items-center shrink-0">
                            <div class="w-5 h-5 rounded-full bg-purple border-3 border-dark shrink-0"></div>
                            <div v-if="i < timeline.length - 1" class="w-[3px] flex-1 bg-purple-light mt-0.5"></div>
                        </div>
                        <div class="pb-8">
                            <div class="font-mono text-[11.5px] text-gray-400 font-semibold">{{ item.date }}</div>
                            <h3 class="text-[17px] text-white  mt-1">{{ item.title }}</h3>
                            <p class="text-sm  mt-1.5 text-gray-400 leading-relaxed max-w-[560px]">{{ item.desc }}</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>

        <!-- ========== 6. อาจารย์ที่ปรึกษา ========== -->
        <section id="advisor" v-reveal class="scroll-mt-[76px] md:scroll-mt-[88px] max-w-[1100px] mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
            <div class="font-mono text-[11px] font-bold text-purple tracking-widest uppercase">ผู้ให้คำปรึกษาโครงงาน
            </div>
            <h2 class="text-2xl mt-2">ที่ปรึกษาโครงงาน</h2>

            <div
                class="flex flex-col sm:flex-row items-center gap-5 sm:gap-6 bg-white border-3 border-dark rounded-[18px] p-5 sm:p-7 shadow-offset max-w-[560px] mx-auto mt-8 justify-center">
                <div
                    class="w-24 h-24 rounded-full bg-purple-light border-3 border-dark flex items-center justify-center text-4xl shrink-0">
                    🧑‍🏫
                </div>
                <div class="text-center sm:text-left">
                    <h3 class="text-[19px]">[ชื่ออาจารย์ที่ปรึกษา]</h3>
                    <div class="text-[13px] text-gray mt-1">อาจารย์ที่ปรึกษาโครงงาน</div>
                    <div class="text-[12.5px] text-gray mt-0.5">แผนกวิชา[ชื่อแผนก] · [ชื่อวิทยาลัย]</div>
                </div>
            </div>
        </section>

        <!-- ========== งานวิจัย ========== -->
        <section id="research" v-reveal class="scroll-mt-[76px] md:scroll-mt-[88px] max-w-[1100px] mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
            <div class="font-mono text-[11px] font-bold text-purple tracking-widest uppercase">Research Paper</div>
            <h2 class="text-2xl mt-2">งานวิจัยโครงงาน</h2>

            <div class="bg-white border-3 border-dark rounded-[18px] p-5 sm:p-8 shadow-offset max-w-[560px] mx-auto mt-8">
                <div class="text-4xl mb-3">📝</div>
                <h3 class="text-[17px] font-semibold">อยู่ระหว่างดำเนินการ</h3>
                <p class="text-[13.5px] text-gray mt-2.5 leading-relaxed">
                    เอกสารงานวิจัยฉบับสมบูรณ์กำลังอยู่ในขั้นตอนการจัดทำ
                    คาดว่าจะเผยแพร่ให้ดาวน์โหลดได้เร็วๆ นี้
                </p>
                <span
                    class="inline-block mt-4 font-mono text-[11px] font-bold bg-purple-light border-2 border-dark px-3.5 py-1.5 rounded-full">
                    Coming Soon
                </span>
            </div>
        </section>

        <!-- ========== 7. FOOTER ========== -->
        <footer class="bg-dark text-gray-300 px-4 sm:px-6 pt-10 pb-6 mt-5">
            <div class="max-w-[1100px] mx-auto flex justify-center items-center flex-wrap gap-4">
                <div class="text-[12.5px] text-gray-500">© 2569 โครงงาน ระดับ ปวส. · พัฒนาโดยนักศึกษา 1 คน
                </div>
            </div>
        </footer>

    </div>
</template>
