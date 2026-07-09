// ============================================
// Deterministic mock data generators for the Assessment/Report/Counselor
// services. Used as a graceful fallback when the backend endpoints
// (Assessment Engine / Reporting Service, Phases 2-5) are unreachable so the
// Phase 6-7 frontend stays demoable in isolation. Remove/trim once the real
// endpoints are stable in every environment.
// ============================================

import type {
  AssessmentQuestion,
  AssessmentReport,
  AssessmentResult,
  AssessmentSession,
  CounselorDashboardData,
  DimensionScore,
  MbtiDimensionPair,
  RiasecDimension,
  TestType,
  AgeBand,
} from '@/types/assessment.types';

const RIASEC_LABELS: Record<RiasecDimension, string> = {
  R: 'واقع‌گرا (Realistic)',
  I: 'پژوهشگر (Investigative)',
  A: 'هنری (Artistic)',
  S: 'اجتماعی (Social)',
  E: 'کارآفرین (Enterprising)',
  C: 'قراردادی (Conventional)',
};

const MBTI_PAIR_LABELS: Record<MbtiDimensionPair, [string, string]> = {
  EI: ['برون‌گرا (E)', 'درون‌گرا (I)'],
  SN: ['حسی (S)', 'شهودی (N)'],
  TF: ['منطقی (T)', 'احساسی (F)'],
  JP: ['برنامه‌ریز (J)', 'منعطف (P)'],
};

const RIASEC_QUESTION_BANK: Record<RiasecDimension, string[]> = {
  R: ['از کار با ابزار و دستگاه‌ها لذت می‌برم.', 'ساختن و تعمیر چیزها برایم جذاب است.'],
  I: ['حل مسائل پیچیده و تحلیلی برایم جذاب است.', 'دوست دارم دلیل اتفاقات را کشف کنم.'],
  A: ['فعالیت‌های خلاقانه مثل طراحی یا نوشتن را دوست دارم.', 'ترجیح می‌دهم کارها را به شکل بدیع انجام دهم.'],
  S: ['کمک به دیگران برایم رضایت‌بخش است.', 'ترجیح می‌دهم در گروه و با تعامل کار کنم.'],
  E: ['رهبری و متقاعد کردن دیگران را دوست دارم.', 'ریسک‌پذیری در کسب‌وکار برایم جذاب است.'],
  C: ['نظم، برنامه‌ریزی دقیق و پیگیری جزئیات را دوست دارم.', 'کار با داده و اسناد منظم را ترجیح می‌دهم.'],
};

const MBTI_QUESTION_BANK: Record<MbtiDimensionPair, [string, string]> = {
  EI: ['در جمع‌های بزرگ انرژی می‌گیرم.', 'ترجیح می‌دهم زمان بیشتری را تنها بگذرانم.'],
  SN: ['به جزئیات و واقعیت‌های ملموس توجه می‌کنم.', 'به الگوها و امکانات آینده فکر می‌کنم.'],
  TF: ['تصمیم‌هایم را بر اساس منطق می‌گیرم.', 'تصمیم‌هایم را بر اساس ارزش‌ها و احساسات می‌گیرم.'],
  JP: ['دوست دارم برنامه از پیش مشخص داشته باشم.', 'ترجیح می‌دهم منعطف و خودجوش عمل کنم.'],
};

function hashSeed(sessionId: string): number {
  let h = 0;
  for (let i = 0; i < sessionId.length; i += 1) {
    h = (h * 31 + sessionId.charCodeAt(i)) >>> 0;
  }
  return h;
}

function seededRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

export function generateMockSessionId(): string {
  return `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildMockQuestions(testType: TestType): AssessmentQuestion[] {
  const questions: AssessmentQuestion[] = [];
  let order = 1;

  if (testType === 'holland' || testType === 'combined') {
    (Object.keys(RIASEC_QUESTION_BANK) as RiasecDimension[]).forEach((dim) => {
      RIASEC_QUESTION_BANK[dim].forEach((prompt) => {
        questions.push({
          id: `holland-${dim}-${order}`,
          order: order++,
          testType: 'holland',
          dimension: dim,
          kind: 'likert5',
          prompt,
          options: [1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) })),
        });
      });
    });
  }

  if (testType === 'mbti' || testType === 'combined') {
    (Object.keys(MBTI_QUESTION_BANK) as MbtiDimensionPair[]).forEach((pair) => {
      const [poleA, poleB] = MBTI_QUESTION_BANK[pair];
      const [labelA, labelB] = MBTI_PAIR_LABELS[pair];
      questions.push({
        id: `mbti-${pair}-${order}`,
        order: order++,
        testType: 'mbti',
        dimension: pair,
        kind: 'binary_choice',
        prompt: 'کدام گزینه بیشتر به شما نزدیک است؟',
        options: [
          { value: `${pair}:A`, label: `${poleA} — ${labelA}` },
          { value: `${pair}:B`, label: `${poleB} — ${labelB}` },
        ],
      });
    });
  }

  return questions;
}

export function buildMockSession(
  sessionId: string,
  testType: TestType,
  ageBand: AgeBand
): AssessmentSession {
  return {
    sessionId,
    testType,
    ageBand,
    status: 'in_progress',
    questions: buildMockQuestions(testType),
    totalQuestions: buildMockQuestions(testType).length,
    createdAt: new Date().toISOString(),
  };
}

function buildHollandDimensions(rand: () => number): DimensionScore[] {
  return (Object.keys(RIASEC_LABELS) as RiasecDimension[]).map((dim) => {
    const raw = 2 + rand() * 3;
    return {
      dimension: dim,
      label: RIASEC_LABELS[dim],
      rawScore: Number(raw.toFixed(2)),
      normalizedScore: Number(((raw / 5) * 100).toFixed(1)),
      certainty: Number((0.5 + rand() * 0.5).toFixed(2)),
    };
  });
}

function buildMbtiDimensions(rand: () => number): DimensionScore[] {
  return (Object.keys(MBTI_PAIR_LABELS) as MbtiDimensionPair[]).map((pair) => {
    const pref = Math.round(rand() * 100);
    return {
      dimension: pair,
      label: MBTI_PAIR_LABELS[pair].join(' / '),
      rawScore: pref,
      normalizedScore: pref,
      certainty: Number((Math.abs(pref - 50) / 50).toFixed(2)),
    };
  });
}

function top3FromDimensions(dims: DimensionScore[]): string {
  return [...dims]
    .sort((a, b) => b.normalizedScore - a.normalizedScore)
    .slice(0, 3)
    .map((d) => d.dimension)
    .join('');
}

function typeCodeFromMbti(dims: DimensionScore[]): string {
  const order: MbtiDimensionPair[] = ['EI', 'SN', 'TF', 'JP'];
  return order
    .map((pair) => {
      const d = dims.find((x) => x.dimension === pair);
      const [poleA, poleB] = MBTI_PAIR_LABELS[pair];
      const isA = (d?.normalizedScore ?? 50) >= 50;
      return (isA ? poleA : poleB).match(/\(([A-Z])\)/)?.[1] ?? pair[0];
    })
    .join('');
}

export function buildMockResult(
  sessionId: string,
  testType: TestType,
  ageBand: AgeBand
): AssessmentResult {
  const rand = seededRandom(hashSeed(sessionId));
  const result: AssessmentResult = {
    sessionId,
    testType,
    ageBand,
    completedAt: new Date().toISOString(),
  };
  if (testType === 'holland' || testType === 'combined') {
    const dims = buildHollandDimensions(rand);
    result.holland = { dimensions: dims, top3Code: top3FromDimensions(dims) };
  }
  if (testType === 'mbti' || testType === 'combined') {
    const dims = buildMbtiDimensions(rand);
    result.mbti = { dimensions: dims, typeCode: typeCodeFromMbti(dims) };
  }
  return result;
}

export function buildMockReport(
  sessionId: string,
  testType: TestType,
  ageBand: AgeBand
): AssessmentReport {
  const result = buildMockResult(sessionId, testType, ageBand);
  const topHolland = result.holland
    ? [...result.holland.dimensions].sort((a, b) => b.normalizedScore - a.normalizedScore)
    : [];
  const strengths = topHolland.slice(0, 2).map((d) => d.label);
  const growthAreas = topHolland.slice(-2).map((d) => d.label);

  return {
    ...result,
    strengths: strengths.length ? strengths : ['تحلیل دقیق‌تر پس از تکمیل آزمون ترکیبی در دسترس است.'],
    growthAreas: growthAreas.length ? growthAreas : [],
    careers: [
      { title: 'تحلیل‌گر داده', fitScore: 0.86, why: 'تطابق بالا با بعد پژوهشگر و قراردادی' },
      { title: 'مشاور تحصیلی', fitScore: 0.78, why: 'تطابق با بعد اجتماعی و ارتباطی' },
      { title: 'طراح محصول', fitScore: 0.71, why: 'تطابق با بعد هنری و کارآفرین' },
    ],
    majors: [
      { title: 'مهندسی کامپیوتر', fitScore: 0.82, why: 'تناسب با تفکر تحلیلی و ساختاریافته' },
      { title: 'روان‌شناسی', fitScore: 0.75, why: 'تناسب با علاقه به کار با انسان‌ها' },
    ],
    actionPlan: [
      { horizon: '3m', title: 'کاوش', description: 'با ۲ نفر در حوزه‌های پیشنهادی گفتگو کن.' },
      { horizon: '6m', title: 'تجربه عملی', description: 'یک پروژه کوچک یا کارآموزی مرتبط انجام بده.' },
      { horizon: '12m', title: 'تصمیم مسیر', description: 'بر اساس تجربه، مسیر تحصیلی/شغلی را نهایی کن.' },
    ],
    disclaimer:
      'این آزمون ابزار تشخیص بالینی نیست و صرفاً برای راهنمایی مسیر تحصیلی/شغلی طراحی شده است.',
  };
}

export function buildMockCounselorDashboard(): CounselorDashboardData {
  const students = Array.from({ length: 8 }).map((_, i) => {
    const rand = seededRandom(i + 1);
    const status = i % 4 === 0 ? 'in_progress' : 'completed';
    const dims = buildHollandDimensions(rand);
    return {
      sessionId: `student-session-${i + 1}`,
      studentName: `دانش‌آموز ${i + 1}`,
      ageBand: (['13-17', '18-24', '25-30', '30+'] as AgeBand[])[i % 4],
      testType: 'combined' as TestType,
      status: status as 'in_progress' | 'completed',
      progressPercent: status === 'completed' ? 100 : 40 + (i % 3) * 15,
      topCode: status === 'completed' ? top3FromDimensions(dims) : undefined,
      updatedAt: new Date(Date.now() - i * 86400000).toISOString(),
    };
  });

  const completed = students.filter((s) => s.status === 'completed').length;
  const rand = seededRandom(99);

  return {
    stats: {
      totalStudents: students.length,
      completedAssessments: completed,
      inProgressAssessments: students.length - completed,
      averageCompletionPercent: Math.round(
        students.reduce((sum, s) => sum + s.progressPercent, 0) / students.length
      ),
      dimensionAverages: buildHollandDimensions(rand),
    },
    students,
  };
}
