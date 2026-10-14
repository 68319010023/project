import { supabase } from '../lib/supabase.js'

export async function deleteClassroom(classroomId) {
  
  try {
    const { data, error } = await supabase.rpc('delete_classroom', {
      p_classroom_id: classroomId,
    })

    if (error) {
      console.error('deleteClassroom error:', error.code, error.message, error.details, error.hint)
      return { success: false, error: error.message || 'ลบห้องเรียนไม่สำเร็จ ลองใหม่อีกครั้ง' }
    }

    // DB ลบสำเร็จแล้ว ค่อยลบไฟล์ใน Storage (ถ้าพังแค่ log ไม่ถือว่าล้มเหลว)
    const submissionFiles = data?.submission_files ?? []
    const assignmentFiles = data?.assignment_files ?? []

    if (submissionFiles.length > 0) {
      const { error: removeError } = await supabase.storage
        .from('submission-files')
        .remove(submissionFiles)
      if (removeError) console.error('remove submission files error:', removeError)
    }

    if (assignmentFiles.length > 0) {
      const { error: removeError } = await supabase.storage
        .from('assignment-files')
        .remove(assignmentFiles)
      if (removeError) console.error('remove assignment files error:', removeError)
    }

    return { success: true, error: null }
  } catch (err) {
    console.error('deleteClassroom unexpected error:', err)
    return { success: false, error: 'ลบห้องเรียนไม่สำเร็จ ลองใหม่อีกครั้ง' }
  }
}