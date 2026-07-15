/**
 * seed-data.js — البيانات الأولية (v2: خمسة أدوار + سير عمل)
 * ------------------------------------------------------------------
 * تُستخدم في وضع Mock وكمرجع لـ supabase/seed.sql (نفس البنية تماماً).
 */

export const SEED = {
  /**
   * المستخدمون — الدخول برقم الهوية (id).
   * roles: super_admin | admin | teacher | exam_supervisor
   */
  users: [
    { id: '2491434540', role: 'super_admin', name: 'المشرف العام', active: true, schoolId: '', phone: '' },
    { id: '1000000010', role: 'admin', name: 'أ. سارة الإدارية', active: true, schoolId: 'sch_furqan', phone: '0551110001' },
    { id: '1000000020', role: 'teacher', name: 'أ. محمد المعلم', active: true, schoolId: 'sch_furqan', phone: '0551110002' },
    { id: '1000000021', role: 'teacher', name: 'أ. خالد المعلم', active: true, schoolId: 'sch_furqan', phone: '0551110003' },
    { id: '1000000030', role: 'exam_supervisor', name: 'أ. عبدالله المشرف', active: true, schoolId: '', schools: ['sch_furqan', 'sch_noor'], phone: '0551110004' },
  ],

  /** المدارس/المجمعات. */
  schools: [
    { id: 'sch_furqan', name: 'مجمع الفرقان', active: true },
    { id: 'sch_noor', name: 'مجمع النور', active: true },
  ],

  /**
   * لائحة الاختبارات المعتمدة (المستويات).
   * الأعمدة تطابق اللائحة الرسمية: المستوى، الأجزاء، بيان بأرقام أجزاء الاختبار،
   * عدد أجزاء الاختبار الفعلية، عدد الأسئلة، وتوزيع الأسئلة.
   * ⚠️ قيمة "level" مُصمّمة لتوافق محرك التقييم (evaluation.engine.js):
   *    "1" و"2" تُفعّلان قواعد المستويين الأول/الثاني، و"الإتقان" تُفعّل نمط الإتقان.
   */
  examLevels: [
    { id: 'lvl_1',  level: '1',      note: '',                 ajza: 1,  parts: '30',                              examPartsCount: 1,  questionCount: 3,  q3: '30', q2: '',            q1: '',                 qHalf: '' },
    { id: 'lvl_2',  level: '2',      note: '',                 ajza: 2,  parts: '29، 30',                          examPartsCount: 2,  questionCount: 3,  q3: '',   q2: '30',          q1: '29',               qHalf: '' },
    { id: 'lvl_3',  level: '3',      note: 'ختمة العُشر الأخير', ajza: 3,  parts: '28، 29، 30',                      examPartsCount: 3,  questionCount: 5,  q3: '',   q2: '29، 30',      q1: '28',               qHalf: '' },
    { id: 'lvl_4',  level: '4',      note: '',                 ajza: 4,  parts: '27، 28، 29، 30',                  examPartsCount: 4,  questionCount: 5,  q3: '',   q2: '30',          q1: '27، 28، 29',       qHalf: '' },
    { id: 'lvl_5',  level: '5',      note: 'ختمة المفصّل',      ajza: 5,  parts: '26، 27، 28، 29، 30',              examPartsCount: 5,  questionCount: 5,  q3: '',   q2: '',            q1: 'كل جزء',           qHalf: '' },
    { id: 'lvl_6',  level: '6',      note: '',                 ajza: 6,  parts: '25، 26، 27، 28، 29',              examPartsCount: 5,  questionCount: 5,  q3: '',   q2: '',            q1: 'كل جزء',           qHalf: '' },
    { id: 'lvl_8',  level: '8',      note: 'ختمة ربع يس',       ajza: 8,  parts: '23، 24، 25، 26، 27',              examPartsCount: 5,  questionCount: 5,  q3: '',   q2: '',            q1: 'كل جزء',           qHalf: '' },
    { id: 'lvl_10', level: '10',     note: '',                 ajza: 10, parts: '21، 22، 23، 24، 25',              examPartsCount: 5,  questionCount: 5,  q3: '',   q2: '',            q1: 'كل جزء',           qHalf: '' },
    { id: 'lvl_13', level: '13',     note: '',                 ajza: 13, parts: '18، 19، 20، 21، 22',              examPartsCount: 5,  questionCount: 5,  q3: '',   q2: '',            q1: 'كل جزء',           qHalf: '' },
    { id: 'lvl_15', level: '15',     note: 'ختمة نصف القرآن',   ajza: 15, parts: '16، 17، 18، 19، 20',              examPartsCount: 5,  questionCount: 5,  q3: '',   q2: '',            q1: 'كل جزء',           qHalf: '' },
    { id: 'lvl_18', level: '18',     note: '',                 ajza: 18, parts: '13، 14، 15، 16، 17',              examPartsCount: 5,  questionCount: 5,  q3: '',   q2: '',            q1: 'كل جزء',           qHalf: '' },
    { id: 'lvl_20', level: '20',     note: '',                 ajza: 20, parts: '11 - 20',                         examPartsCount: 10, questionCount: 5,  q3: '',   q2: '',            q1: '',                 qHalf: '11، 12، 13، 14، 15، 16، 17، 18، 19، 20' },
    { id: 'lvl_23', level: '23',     note: '',                 ajza: 23, parts: '8، 9، 10، 11، 12',                examPartsCount: 5,  questionCount: 5,  q3: '',   q2: '',            q1: 'كل جزء',           qHalf: '' },
    { id: 'lvl_25', level: '25',     note: '',                 ajza: 25, parts: '6 - 15',                          examPartsCount: 10, questionCount: 5,  q3: '',   q2: '',            q1: '',                 qHalf: '6، 7، 8، 9، 10، 11، 12، 13، 14، 15' },
    { id: 'lvl_30', level: '30',     note: 'الختم',            ajza: 30, parts: '1، 2، 3، 4، 5، 6، 7، 8، 9، 10',    examPartsCount: 10, questionCount: 5,  q3: '',   q2: '',            q1: '',                 qHalf: '1، 2، 3، 4، 5، 6، 7، 8، 9، 10' },
    { id: 'lvl_itqan', level: 'الإتقان', note: 'اختبار الإتقان الشامل', ajza: 30, parts: '1 - 30',                examPartsCount: 30, questionCount: 30, q3: '',   q2: '',            q1: 'كل جزء',           qHalf: '' },
  ],

  /** الإعدادات العامة. */
  settings: [
    {
      id: 'variables',
      stages: ['النورانية', 'التلقين', 'الابتدائية', 'المتوسطة', 'الثانوية', 'الموظفون والكبار والجامعيون', 'عن بعد', 'المكثفة', 'الإقراء', 'أخرى', 'النوعية'],
      times: ['من العصر إلى المغرب', 'العصر ساعة ونصف', 'المغرب', 'العشاء', 'أوقات مختلفة', 'ساعة ونصف عن بعد', 'الصباح ساعة ونصف', 'الصباح ثلاث ساعات'],
    },
  ],

  /**
   * الطلاب (سجل الطالب + سير الاختبار).
   * status: من workflow.js. internal/final/schedule/certificate كائنات JSON.
   */
  students: [
    {
      id: 'std_1001',
      nationalId: '1122334455',
      name: 'أحمد سالم أحمد الغامدي',
      schoolId: 'sch_furqan', schoolName: 'مجمع الفرقان',
      className: 'حلقة الإتقان', classTime: 'الفترة المسائية', eduStage: 'ابتدائي',
      mobile: '0550000001',
      teacherId: '1000000020', teacherName: 'أ. محمد المعلم',
      examLevel: 'المستوى 1', parts: 'جزء عمّ',
      status: 'certificate_ready',
      internal: { score: 95, distinction: 'حسن الصوت', approvedBy: '1000000020', approvedAt: '2026-06-01' },
      final: { score: 92, distinction: 'حسن الصوت', approvedBy: '1000000030', approvedAt: '2026-06-10', passed: true },
      schedule: { date: '2026-06-08', time: '09:00', supervisorId: '1000000030', supervisorName: 'أ. عبدالله المشرف' },
      certificate: { issued: true, issuedAt: '2026-06-10' },
      createdBy: '1000000010', createdAt: '2026-05-20',
    },
    {
      id: 'std_1002',
      nationalId: '1122334466',
      name: 'عبدالرحمن فهد العتيبي',
      schoolId: 'sch_furqan', schoolName: 'مجمع الفرقان',
      className: 'حلقة النور', classTime: 'الفترة الصباحية', eduStage: 'متوسط',
      mobile: '0550000002',
      teacherId: '1000000021', teacherName: 'أ. خالد المعلم',
      examLevel: 'المستوى 2', parts: 'جزء تبارك',
      status: 'internal_approved',
      internal: { score: 88, distinction: '', approvedBy: '1000000021', approvedAt: '2026-06-05' },
      final: {},
      schedule: {},
      certificate: { issued: false },
      createdBy: '1000000010', createdAt: '2026-05-22',
    },
    {
      id: 'std_1003',
      nationalId: '1122334477',
      name: 'يوسف ماجد الشهري',
      schoolId: 'sch_furqan', schoolName: 'مجمع الفرقان',
      className: 'حلقة الفجر', classTime: 'بعد العصر', eduStage: 'ثانوي',
      mobile: '0550000003',
      teacherId: '1000000020', teacherName: 'أ. محمد المعلم',
      examLevel: 'المستوى 3', parts: '3 أجزاء',
      status: 'awaiting_internal',
      internal: {}, final: {}, schedule: {}, certificate: { issued: false },
      createdBy: '1000000010', createdAt: '2026-05-25',
    },
  ],

  /** سجل النتائج السابقة (استيراد كبير + بحث تاريخي). */
  resultsHistory: [],

  /** دفعات النتائج (بيانات كل استيراد). */
  resultBatches: [],

  /** الجوائز: فارغة هنا — تُقرأ من الافتراضي في rewards.service إن كانت القاعدة فارغة. */
  rewards: [],

  /**
   * قالب الشهادة الافتراضي (نصوص قابلة للتعديل بمتغيّرات + توقيع + ختم).
   * الخلفية والتوقيع والختم تُرفع من محرّر الشهادة (المشرف العام).
   */
  certificateTemplate: [
    {
      id: 'default',
      imageData: '',
      width: 1123, height: 794,
      academicYear: '1447 / 1448',
      fields: {
        assoc:     { text: 'تشهد الجمعية الخيرية لتحفيظ القرآن الكريم بمحافظة شرورة (بنات)', x: 561, y: 285, size: 24, color: '#1E4D2B', align: 'center', visible: true, label: 'جهة الإصدار' },
        student:   { text: 'بأن الطالب/ة : {{الاسم}}', x: 700, y: 330, size: 22, color: '#0d141b', align: 'center', visible: true, label: 'سطر الطالب' },
        school:    { text: 'من مجمع / مدرسة : {{المدرسة}}', x: 360, y: 330, size: 22, color: '#0d141b', align: 'center', visible: true, label: 'سطر المدرسة' },
        passline:  { text: 'قد اجتاز/ت حفظ: {{الجزء}} — مستوى {{المستوى}} — بنسبة: {{الدرجة}} — وتقدير {{التقدير}}', x: 561, y: 382, size: 20, color: '#0d141b', align: 'center', visible: true, label: 'سطر النتيجة' },
        year:      { text: 'خلال العام {{العام}}هـ', x: 561, y: 428, size: 22, color: '#1E4D2B', align: 'center', visible: true, label: 'العام الدراسي' },
        body:      { text: 'ولذا فإن الجمعية توصي بتقوى الله تعالى والمحافظة على ما تشرّف / ــت بحفظه من كتاب الله تعالى\nنسأل الله أن يجعله / ــا من أهل القرآن الذين هم أهل الله وخاصته..\nوصلى الله على سيدنا محمد وعلى آله وصحبه وسلم،،،', x: 561, y: 525, size: 20, color: '#334155', align: 'center', visible: true, label: 'نص الدعاء', maxWidth: 900, lineHeight: 42 },
        roleTitle: { text: 'رئيس قسم الشؤون التعليمية', x: 561, y: 635, size: 18, color: '#1E4D2B', align: 'center', visible: true, label: 'المسمّى الوظيفي' },
        roleName:  { text: 'علي هادي حملي', x: 561, y: 738, size: 18, color: '#0d141b', align: 'center', visible: true, label: 'اسم الموقّع' },
        nationalId:{ text: 'رقم الهوية: {{الهوية}}', x: 561, y: 458, size: 16, color: '#64748b', align: 'center', visible: false, label: 'رقم الهوية' },
        date:      { text: 'التاريخ: {{التاريخ}}', x: 250, y: 705, size: 16, color: '#64748b', align: 'center', visible: false, label: 'التاريخ' },
      },
      images: {
        signature: { src: '', x: 300, y: 690, width: 180, visible: true, label: 'توقيع الرئيس' },
        seal:      { src: '', x: 620, y: 700, width: 150, visible: true, label: 'الختم' },
      },
    },
  ],

  /** سجل الأحداث يبدأ فارغاً. */
  auditLog: [],
};
