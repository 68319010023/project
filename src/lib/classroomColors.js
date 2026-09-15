// สุ่มสี banner แบบ deterministic จากชื่อ/id ห้อง (เพราะ schema ไม่มีคอลัมน์ "วิชา")
const palette = [
    { from: '#fff3c4', to: '#ffe08a' }, // เหลือง
    { from: '#cfe8ff', to: '#9fcdfd' }, // ฟ้า
    { from: '#ffd6ec', to: '#ffb0da' }, // ชมพู
    { from: '#d4f5d4', to: '#a8e6a1' }, // เขียว
    { from: '#e0d4ff', to: '#c7aefc' }, // ม่วง
    { from: '#ffe0cc', to: '#ffc199' }, // ส้มอ่อน
    { from: '#c4f5ff', to: '#8ae8ff' }, // ฟ้าเข้ม/เทอร์คอยส์
    { from: '#ffe8b0', to: '#ffd166' }, // เหลืองเข้ม/ทอง
    { from: '#e8e8e8', to: '#c9c9c9' }, // เทาอ่อน
]

// ไล่สีตามลำดับที่แสดงในหน้า (การ์ดติดกันไม่ซ้ำสีแน่นอน ตราบใดที่จำนวนห้อง <= จำนวนสีในชุด)
export function getClassroomColorByIndex(index) {
    return palette[index % palette.length]
}

// เก็บไว้เผื่อที่อื่นยังเรียกใช้แบบเดิมอยู่ (ไม่ลบทิ้งกะทันหัน)
export function getClassroomColor(seed) {
    const str = String(seed)
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    return palette[Math.abs(hash) % palette.length]
}