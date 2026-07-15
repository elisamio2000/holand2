# برنامه فازبندی رفع نواقص و آماده‌سازی ارائه (Release Readiness)

آخرین به‌روزرسانی: 2026-07-14
وضعیت فعلی: آماده ارائه نیست (Release Blocked)
هدف: تبدیل مسائل جاری به برنامه اجرایی دقیق، موازی‌پذیر و قابل تحویل.

مرجع تکمیلی نسخه ۱:
- docs/release-v1-implementation-master-plan-fa.md

## 1) وضعیت بلوکه‌کننده فعلی (Release Blockers)

- BLK-01: تنظیمات حساب و آواتار پایدار نیست (بارگذاری/ذخیره تصویر)
- BLK-02: Discovery مدل در پنل ادمین قابل اتکا نیست (لوکال/Ollama/vLLM/API)
- BLK-03: خروجی تحلیل نتیجه آزمون ناکافی است (فقط نمودار ساده)
- BLK-04: تاریخچه آزمون‌ها ناقص/غیردقیق (اتکا به store محلی)
- BLK-05: آزمایشگاه خبره برای ویرایش سوال/پاسخ/فرمول و محاسبات کافی نیست
- BLK-06: i18n و RTL/LTR در بخش‌های متعدد ناپایدار است
- BLK-07: چت، راهنما و باگ ریپورت به‌صورت end-to-end پایدار نیستند

## 2) ساختار اجرای موازی (Workstreams)

### WS-A: Identity & Settings Reliability
دامنه:
- آواتار کاربر، ذخیره‌سازی پروفایل، تنظیمات حساب
نقاط کد مرتبط:
- apps/web/apps/holand-web-app/src/services/auth.service.ts
- apps/web/apps/holand-web-app/src/app/(hydrogen)/forms/profile-settings/profile/page.tsx
- apps/web/apps/holand-web-app/src/app/(hydrogen)/account/profile/page.tsx
خروجی:
- آپلود/حذف آواتار، نمایش فوری، persistence پس از refresh/login

### WS-B: Admin LLM Discovery & Provider Operations
دامنه:
- Provider CRUD، health-check، discover-models، import/apply model
نقاط کد مرتبط:
- apps/api/app/routers/admin_llm.py
- apps/api/app/services/llm_provider_service.py
- apps/web/apps/holand-web-app/src/app/(hydrogen)/admin/ai-settings/providers-tab.tsx
- apps/web/apps/holand-web-app/src/services/admin-llm.service.ts
خروجی:
- Discovery واقعی برای vLLM (/v1/models) و Ollama (/api/tags)

### WS-C: Assessment Result Intelligence (Report Layer)
دامنه:
- خروجی تحلیل چندلایه، جداول محاسبات، توضیح علمی، مسیر تحصیلی/شغلی
نقاط کد مرتبط:
- apps/api/app/routers/reports.py
- apps/api/app/services/interpretation_engine.py
- apps/web/apps/holand-web-app/src/app/(hydrogen)/career-guidance/reports/[sessionId]/page.tsx
- apps/web/apps/holand-web-app/src/services/report.service.ts
خروجی:
- گزارش تفصیلی قابل ارائه (خلاصه + تحلیل + جداول + برنامه اقدام)

### WS-D: Assessment History & Session Integrity
دامنه:
- تاریخچه واقعی بر اساس backend، نه صرفا store محلی
نقاط کد مرتبط:
- apps/web/apps/holand-web-app/src/app/(hydrogen)/career-guidance/assessments/history/page.tsx
- apps/web/apps/holand-web-app/src/store/assessment-history.store.ts
- apps/api/app/routers/sessions.py
- apps/api/app/routers/reports.py
خروجی:
- تاریخچه پایدار، قابل فیلتر، قابل بازگشت به session/result

### WS-E: Expert Lab Authoring & Formula Governance
دامنه:
- ویرایش سوالات/گزینه‌ها/نسخه‌ها/فرمول‌ها توسط کارشناس خبره
نقاط کد مرتبط:
- apps/web/apps/holand-web-app/src/app/(hydrogen)/career-guidance/expert-lab/page.tsx
- apps/web/apps/holand-web-app/src/app/shared/assessment-authoring/index.tsx
- apps/web/apps/holand-web-app/src/services/assessment-authoring.service.ts
- apps/api/app/routers/admin_versions.py
- apps/api/app/services/formula_engine.py
خروجی:
- چرخه Draft/Review/Approve/Publish قابل اتکا + simulation فرمول معتبر

### WS-F: i18n + RTL Quality
دامنه:
- ترجمه کامل، کلیدها، جهت‌بندی و چیدمان سازگار
نقاط کد مرتبط:
- apps/web/apps/holand-web-app/src/config/i18n.ts
- apps/web/apps/holand-web-app/src/providers/language-provider.tsx
- apps/web/apps/holand-web-app/src/locales/fa.ts
- apps/web/apps/holand-web-app/src/locales/en.ts
خروجی:
- پوشش ترجمه کل صفحات هدف + RTL/LTR بدون شکست UI

### WS-G: Chat, Help, Bug Report Reliability
دامنه:
- ارسال/دریافت پیام، راهنمای کاربر، ثبت باگ و attachment
نقاط کد مرتبط:
- apps/web/apps/holand-web-app/src/services/chat.service.ts
- apps/web/apps/holand-web-app/src/services/user-chat.service.ts
- apps/web/apps/holand-web-app/src/services/messaging-shared.service.ts
- apps/web/apps/holand-web-app/src/locales/fa.ts
خروجی:
- سناریوهای حیاتی چت و باگ‌ریپورت بدون خطای عملیاتی

### WS-H: Quality Engineering + DevOps Gates
دامنه:
- تست خودکار، smoke e2e، معیارهای go/no-go
نقاط کد مرتبط:
- apps/api/tests/
- apps/web/apps/holand-web-app/src/services/*.test.ts
- check-and-run.ps1
خروجی:
- گیت‌های کیفیت قبل از هر Release Candidate

## 3) فازبندی اجرایی

## Phase 0: تثبیت بحرانی (3-5 روز)
هدف:
- بستن Blockerهای فوری که مانع استفاده روزمره هستند.
اقلام:
- WS-A: رفع کامل آپلود/ذخیره آواتار
- WS-B: فعال‌سازی end-to-end discovery در admin ai-settings
- WS-D: اتصال تاریخچه assessments به backend واقعی
گیت خروج:
- G0-1: آواتار در 3 مرورگر تست و بعد از refresh باقی بماند
- G0-2: حداقل یک provider vLLM و یک provider Ollama مدل‌ها را کشف کنند
- G0-3: history پس از logout/login همچنان صحیح نمایش داده شود

## Phase 1: تجربه هسته کاربر (1 اسپرینت)
هدف:
- تکمیل جریان آزمون -> نتیجه -> گزارش.
اقلام:
- WS-C: صفحه تحلیل نتیجه چندلایه (نه فقط نمودار)
- WS-D: تکمیل history و resume flows
- WS-F: اصلاح i18n/RTL صفحات career-guidance
گیت خروج:
- G1-1: گزارش دارای summary + interpretation + action plan + risk flags باشد
- G1-2: مسیرهای assessments, result, reports بدون crash/session drop
- G1-3: هیچ key ترجمه خام در صفحات هدف دیده نشود

## Phase 2: توانمندسازی کارشناس خبره (1 اسپرینت)
هدف:
- دقیق کردن Expert Lab و ابزار محاسباتی.
اقلام:
- WS-E: ویرایش سوالات/گزینه‌ها/فرمول‌ها + simulation + validation
- WS-C: نمایش جداول محاسبات و توضیح فرمول در گزارش
گیت خروج:
- G2-1: یک نسخه آزمون از Draft تا Publish end-to-end قابل اجرا باشد
- G2-2: فرمول و محاسبات تغییر کند و در نتیجه نهایی منعکس شود

## Phase 3: لایه هوشمند و مدل ترکیبی (1 اسپرینت)
هدف:
- پیاده‌سازی composite model برای هدایت تحصیلی/شغلی نوجوان.
اقلام:
- WS-B: مدیریت provider/template و AI report generation پایدار
- WS-C: ادغام منابع خریداری‌شده + benchmark + evidence-based rules
- WS-G: راهنمای هوشمند کاربر
گیت خروج:
- G3-1: تولید AI report با fallback امن
- G3-2: گزارش نوجوان‌محور 13-17 دارای مسیر مدرسه/دانشگاه + اقدام مهارتی باشد

## Phase 4: Production Hardening (1 اسپرینت)
هدف:
- بستن ریسک‌های نهایی و آماده‌سازی ارائه رسمی.
اقلام:
- WS-F: تکمیل i18n/RTL کل ماژول‌ها
- WS-G: پایداری chat/help/bug-report
- WS-H: تست‌های e2e، سنجه‌های latency، runbook
گیت خروج:
- G4-1: Release checklist پاس شود
- G4-2: هیچ blocker باز در Severity 1/2 باقی نماند

## 4) ماتریس موازی‌سازی پیشنهادی

- Track 1 (Backend Core): WS-B, WS-C, WS-E
- Track 2 (Frontend UX): WS-A, WS-D, WS-F
- Track 3 (Platform Reliability): WS-G, WS-H

وابستگی‌های کلیدی:
- WS-C وابسته به contract پایدار از WS-E و WS-B
- WS-D وابسته به endpointهای session/report پایدار
- WS-G برای release نهایی وابسته به WS-F (متن/جهت‌بندی)

## 5) تعریف خروجی قابل سنجش (Done Criteria)

- DC-01: Avatar E2E
  - upload/delete/update + persistence + permission handling
- DC-02: LLM Discovery E2E
  - add provider -> health check -> discover -> set default model
- DC-03: Report E2E
  - session complete -> report generated -> detailed analysis visible
- DC-04: History E2E
  - start/complete multiple sessions -> history accurate and navigable
- DC-05: Expert Lab E2E
  - edit question/formula -> publish -> live scoring update
- DC-06: i18n/RTL E2E
  - FA and EN render correctly with proper layout direction
- DC-07: Chat/Support E2E
  - send/receive chat + submit bug report with attachment

## 6) اولویت‌بندی Severity

- Severity 1 (فوری): BLK-01, BLK-02, BLK-03
- Severity 2 (بالا): BLK-04, BLK-05
- Severity 3 (متوسط): BLK-06, BLK-07

## 7) خروجی مستنداتی الزامی در هر فاز

- PRD delta و scope change log
- API contract diff
- test report
- release gate checklist
- rollback plan
- traceability به ST-* در سند docs/development-line-master-tracker-fa.md

## 8) وضعیت آمادگی ارائه

- اکنون: Not Ready
- معیار تبدیل به Ready:
  - Phase 0 + Phase 1 کامل
  - عدم وجود Severity 1
  - پاس شدن گیت‌های G0 و G1
