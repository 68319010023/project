// สุ่มสี banner แบบ deterministic จากชื่อ/id ห้อง (เพราะ schema ไม่มีคอลัมน์ "วิชา")
const palette = [
    { from: '#fff3c4', to: '#ffe08a' }, // เหลือง
    { from: '#cfe8ff', to: '#9fcdfd' }, // ฟ้า
    { from: '#ffd6ec', to: '#ffb0da' }, // ชมพู
    { from: '#d4f5d4', to: '#a8e6a1' }, // เขียว
    { from: '#e0d4ff', to: '#c7aefc' }, // ม่วง
    { from: '#ffe0cc', to: '#ffc199' }, // ส้มอ่อน
]

export function getClassroomColor(seed) {
    const str = String(seed)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    return palette[Math.abs(hash) % palette.length]
}