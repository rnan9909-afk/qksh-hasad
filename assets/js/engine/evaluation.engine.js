/**
 * evaluation.engine.js — محرك احتساب درجة الاختبار
 * ------------------------------------------------------------------
 * منقول حرفياً من منطق النظام الأصلي (configureEvaluationSettings /
 * chCount / updateLockStates / updateTotalScore) مع فصله عن الـ DOM.
 *
 * ⚠️ لا تُعدّل الأرقام أو الشروط — أي تغيير يعني درجات خاطئة.
 *
 * الاستخدام:
 *   const engine = new EvaluationEngine();
 *   engine.configure(level, questionCount);   // يهيّئ الإعدادات والحالة
 *   engine.changeCount(i, 'talqin', +1);       // تعديل عدّاد
 *   engine.setTajweedTheory(5);
 *   engine.setCommittee(3);
 *   const { final, isAutoFail } = engine.compute();
 */

export class EvaluationEngine {
  constructor() {
    this.settings = this._defaultSettings();
    this.state = { questions: [], tajweedTheory: 5, committeeScore: 0 };
  }

  _defaultSettings() {
    return {
      qValue: 16,
      qCount: 5,
      tajweedPot: 15,
      talqinDed: 2,
      tanbihDed: 0.25,
      tajweedDed: 0.25,
      hasTheory: true,
      burnLimit: 5,
      failLimitTotal: 2,
      failLimitConsecutive: 99,
      isItqan: false,
      maxTajweedDeduction: 15,
    };
  }

  /**
   * تهيئة الإعدادات حسب المستوى وعدد الأسئلة، وإعادة ضبط الحالة.
   * (يقابل configureEvaluationSettings + تهيئة الحالة في openEvaluationModal)
   */
  configure(levelStr, dbQCount) {
    const s = this._defaultSettings();
    const lvl = String(levelStr).trim();
    s.isItqan = false;

    if (lvl.includes('الإتقان') || lvl.includes('إتقان')) {
      s.isItqan = true;
      s.qCount = 30;
      s.qValue = 2.5;
      s.talqinDed = 1;
      s.tanbihDed = 0.25;
      s.tajweedDed = 0.25;
      s.tajweedPot = 15;
      s.hasTheory = true;
      s.burnLimit = 2.5;
      s.failLimitTotal = 3;
      s.failLimitConsecutive = 2;
    } else {
      s.qCount = dbQCount;
      if (s.qCount === 5) {
        s.qValue = 16;
        s.tajweedPot = 15;
      } else if (s.qCount === 3) {
        s.qValue = 30;
        s.tajweedPot = 10;
      } else {
        s.qValue = 16;
        s.tajweedPot = 15;
      }

      s.talqinDed = 2;
      s.tanbihDed = 0.25;
      s.tajweedDed = 0.25;
      s.hasTheory = true;
      s.failLimitTotal = 2;
      s.failLimitConsecutive = 99;
      s.burnLimit = 5;

      const groupTwoPoints = [
        'مستوى الختم', 'ختمة العُشر الأخير', '4', 'ختمة المفصل', '6',
        'ختمة ربع يس', '89', 'ختمة نصف القرآن', '11', '12', '13', '14',
      ];

      if (
        lvl === '1' || lvl === '2' ||
        lvl.includes('المستوى 1') || lvl.includes('المستوى 2') ||
        lvl === 'جزء' || lvl === 'جزئين' || lvl.includes('جزء واحد')
      ) {
        s.talqinDed = 3;
        s.hasTheory = false;
        s.failLimitTotal = 1;
        if (s.qCount === 5) s.qValue = 17; // 17*5=85 + 15 = 100
      } else if (groupTwoPoints.some((g) => lvl.includes(g))) {
        s.talqinDed = 2;
      }
    }

    this.settings = s;

    // إعادة ضبط الحالة
    this.state.questions = [];
    for (let i = 0; i < s.qCount; i++) {
      this.state.questions.push({ talqin: 0, tanbih: 0, tajweed: 0 });
    }
    this.state.tajweedTheory = s.hasTheory ? 5 : 0;
    this.state.committeeScore = 0;
  }

  /**
   * تعديل عدّاد سؤال (تلقين/تنبيه/تجويد) مع تطبيق حدود الحرق والتجويد.
   * (يقابل chCount) — يُرجع true إن طُبِّق التغيير.
   */
  changeCount(idx, type, delta) {
    const q = this.state.questions[idx];
    if (!q) return false;

    if (delta > 0 && type === 'tajweed') {
      let totalTajweedErrors = 0;
      this.state.questions.forEach((x) => (totalTajweedErrors += x.tajweed));
      if (totalTajweedErrors * this.settings.tajweedDed >= this.settings.maxTajweedDeduction) {
        return false;
      }
    }

    if (delta > 0 && (type === 'talqin' || type === 'tanbih')) {
      if (this._isBurned(q)) return false;
    }

    let newVal = q[type] + delta;
    if (newVal < 0) newVal = 0;
    q[type] = newVal;
    return true;
  }

  /** هل السؤال "محروق"؟ (نفس شرط النظام الأصلي) */
  _isBurned(q) {
    if (this.settings.isItqan) {
      return (q.talqin * this.settings.talqinDed + q.tanbih * this.settings.tanbihDed) >= this.settings.burnLimit;
    }
    return q.talqin >= this.settings.burnLimit;
  }

  isQuestionBurned(idx) {
    const q = this.state.questions[idx];
    return q ? this._isBurned(q) : false;
  }

  /** هل قفل التجويد النظري بلغ حده الأقصى؟ */
  isTajweedLocked() {
    let total = 0;
    this.state.questions.forEach((q) => (total += q.tajweed));
    return total * this.settings.tajweedDed >= this.settings.maxTajweedDeduction;
  }

  setTajweedTheory(v) {
    this.state.tajweedTheory = Number(v);
  }

  setCommittee(v) {
    this.state.committeeScore = Number(v);
  }

  /**
   * احتساب النتيجة النهائية وحالة الرسوب التلقائي.
   * (يقابل updateTotalScore) — حساب خالص بلا DOM.
   * @returns {{ final: number, isAutoFail: boolean, burnedIndices: number[] }}
   */
  compute() {
    const s = this.settings;
    let totalQuestionsScore = 0;
    let totalTajweedErrors = 0;
    const burnedIndices = [];

    this.state.questions.forEach((q, i) => {
      totalTajweedErrors += q.tajweed;
      const deduction = q.talqin * s.talqinDed + q.tanbih * s.tanbihDed;
      const isBurned = s.isItqan ? deduction >= s.burnLimit : q.talqin >= s.burnLimit;
      if (isBurned) {
        burnedIndices.push(i);
        totalQuestionsScore += 0;
      } else {
        let qScore = s.qValue - deduction;
        if (qScore < 0) qScore = 0;
        totalQuestionsScore += qScore;
      }
    });

    let isAutoFail = false;
    if (burnedIndices.length >= s.failLimitTotal) isAutoFail = true;
    if (s.isItqan && !isAutoFail) {
      for (let i = 0; i < burnedIndices.length - 1; i++) {
        if (burnedIndices[i + 1] === burnedIndices[i] + 1) {
          isAutoFail = true;
          break;
        }
      }
    }

    let final = 0;
    if (!isAutoFail) {
      let tajweedDeductionTotal = totalTajweedErrors * s.tajweedDed;
      if (tajweedDeductionTotal > s.maxTajweedDeduction) tajweedDeductionTotal = s.maxTajweedDeduction;
      let tajweedPracticalScore = s.tajweedPot - tajweedDeductionTotal;
      if (tajweedPracticalScore < 0) tajweedPracticalScore = 0;

      final = totalQuestionsScore + tajweedPracticalScore;
      if (s.isItqan) final += this.state.committeeScore;
      if (s.hasTheory) final += this.state.tajweedTheory;
      final = Math.ceil(final);

      if (s.isItqan) {
        if (final < 80) isAutoFail = true;
      } else if (final < 70) {
        isAutoFail = true;
      }
    } else {
      final = 0;
    }

    return { final, isAutoFail, burnedIndices };
  }
}
