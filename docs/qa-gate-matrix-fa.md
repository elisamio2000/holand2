# ماتریس گیت‌های کیفیت (QA Gate Matrix) — Phase F

آخرین به‌روزرسانی: 2026-07-14
مالک این سند: Worker F (Phase F: Production Hardening)
منبع اصلی: `docs/release-readiness-phased-remediation-plan-fa.md`, `docs/beta-launch-runbook-fa.md`

هدف این سند: یک نگاشت واحد و قابل رهگیری بین Blockerها (BLK-*)، جریان‌های کاری (WS-*)، فازهای اجرا،
شناسه گیت‌های خروج (Gate ID)، مالک، و وضعیت فعلی — تا هیچ گیتی بدون مالک یا بدون معیار سنجش نماند.

## 1) نگاشت کامل Blocker → Workstream → Phase → Gate → Owner → Status

| Blocker | شرح خلاصه | Workstream | Phase | Gate ID | Owner (Worker) | Status |
| --- | --- | --- | --- | --- | --- | --- |
| BLK-01 | آواتار/تنظیمات حساب ناپایدار | WS-A | Phase 0 | G0-1 | Worker A | Executing |
| BLK-02 | Discovery مدل ادمین غیرقابل‌اتکا | WS-B | Phase 0 | G0-2 | Worker B | Executing |
| BLK-03 | خروجی تحلیل نتیجه آزمون ناکافی | WS-C | Phase 1 | G1-1 | Worker C | Plan |
| BLK-04 | تاریخچه آزمون ناقص/غیردقیق | WS-D | Phase 0 / Phase 1 | G0-3, G1-2 | Worker D | Plan |
| BLK-05 | آزمایشگاه خبره ناکافی برای ویرایش | WS-E | Phase 2 | G2-1, G2-2 | Worker E | Plan |
| BLK-06 | i18n و RTL/LTR ناپایدار | WS-F | Phase 1 (شروع) / Phase 4 (تکمیل) | G1-3, DC-06 | **Worker F (این فاز)** | In Progress |
| BLK-07 | چت/راهنما/باگ‌ریپورت ناپایدار | WS-G | Phase 3 (شروع) / Phase 4 (تکمیل) | DC-07 | (منتظر تخصیص) | Blocked-on WS-F |

## 2) گیت‌های جدید معرفی‌شده در Phase F

این فاز علاوه بر گیت‌های تعریف‌شده در سند اصلی، گیت‌های زیر را برای Production Hardening اضافه می‌کند:

| Gate ID | شرح | معیار پاس شدن | ابزار/مصنوع |
| --- | --- | --- | --- |
| G4-devops | DevOps assistant gate | `check-and-run.ps1 -Gate` با کد خروج ۰ و JSON summary سالم روی stack محلی/staging | `check-and-run.ps1` (این PR) |
| G4-perf | Performance hardening (1000 concurrent users) | اسکریپت k6 با هدف پیکربندی‌پذیر (`-e BASE_URL=`) روی 1000 VU اجرا شود و آستانه‌های p95/p99/error-rate اعلام‌شده در `perf/README.md` را پاس کند | `perf/k6/*.js` (این PR، skeleton) |
| G4-release-checklist | چک‌لیست ریلیز رسمی | تمام موارد `docs/beta-launch-runbook-fa.md` بخش «پلی‌بوک اجرایی دقیق لانچ» + نگاشت این سند تیک بخورد | این سند + beta-launch-runbook-fa.md |
| G4-rollback | آمادگی rollback | تگ git (`v1.0.0-rc.<N>`) و ایمیج‌ها (`<git-sha>`, `rc-<N>`) موجود و مستند باشند؛ مسیر rollback در runbook گام‌به‌گام قابل اجرا باشد | git tags + runbook |

## 3) وابستگی‌های بین فازی (Cross-phase dependencies)

- **WS-C/WS-D/WS-E → WS-F**: صفحات گزارش/تاریخچه/آزمایشگاه خبره که هنوز در حال توسعه‌اند (Plan state)
  باید هنگام تکمیل، از همان کلیدهای i18n و قواعد RTL/LTر که در این فاز تثبیت می‌شود پیروی کنند؛ در غیر این
  صورت G1-3/DC-06 دوباره نقض می‌شود. **این فاز نمی‌تواند صفحات هنوز نوشته‌نشده را audit کند** — audit فقط
  روی صفحات موجود انجام می‌شود و باید در Phase 4 نهایی تکرار شود.
- **WS-F → WS-G**: طبق سند اصلی، پایداری نهایی چت/راهنما/باگ‌ریپورت (BLK-07) به تکمیل متن/جهت‌بندی (WS-F)
  وابسته است. تا زمانی‌که WS-G به این فاز تخصیص نیابد، DC-07 در وضعیت Blocked-on WS-F باقی می‌ماند.
- **G4-2 (عدم وجود Severity 1/2 باز)**: امضای نهایی این فاز (Phase F sign-off) مشروط به بسته‌شدن
  Blockerهای Severity 1 فازهای قبلی (BLK-01, BLK-02, BLK-03) توسط Workerهای A/B/C است. این فاز پیش
  می‌رود اما گیت نهایی G4-2 را self-certify نمی‌کند.

## 4) وضعیت فعلی (به‌روزرسانی زنده — Worker F باید این جدول را با پیشرفت خودش به‌روز نگه دارد)

| مورد | وضعیت |
| --- | --- |
| F5 — این ماتریس | Done |
| F1 — ممیزی/اصلاح i18n-RTL | Done (audit + tooling fixes; page-level retrofit deferred — see finding docs) |
| F3 — گیت DevOps (`-Gate`) | Done |
| F4 — بروزرسانی runbook/rollback | Done |
| F2 — اسکلت تست بار k6 | Done (skeleton only, non-blocking CI) |

## 5) Severity policy یادآوری

طبق سند اصلی: وضعیت فعلی «آماده ارائه نیست». امضای نهایی گیت‌های این فاز (G4-*) تنها زمانی معتبر است که
هیچ Blocker باز Severity 1/2 در فازهای پیشین وجود نداشته باشد. این فاز به‌صورت موازی و dependency-safe
پیش می‌رود، اما sign-off نهایی release به‌صورت مشروط (contingent) ثبت می‌شود.
