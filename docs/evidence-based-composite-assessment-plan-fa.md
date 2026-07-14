# برنامه روش ترکیبی مبتنی بر شواهد برای هدایت تحصیلی و شغلی

آخرین به‌روزرسانی: 2026-07-13
وضعیت: اجرایی برای طراحی MVP+ (نوجوان‌محور)

## 1) هدف

طراحی یک روش ترکیبی که برای دانش‌آموزان و نوجوانان:
- شخصیت، علایق، توانمندی‌ها، نقاط قوت و ضعف را به‌صورت یکپارچه نشان دهد.
- خروجی قابل اقدام برای انتخاب مسیر تحصیلی/شغلی ارائه کند.
- از نظر علمی قابل دفاع، منصفانه، و غیرقطعی باشد.

## 2) اصل طراحی

- هیچ آزمون واحدی نباید مبنای تصمیم نهایی باشد.
- ترکیب چند منبع داده ضروری است:
  - سنجش علاقه
  - سنجش خودکارآمدی/باور به توانایی
  - ارزش‌های شغلی/تحصیلی
  - شواهد عملکردی (تحصیلی/رفتاری)
  - گفت‌وگوی مشاور (human-in-the-loop)

## 3) پشته پیشنهادی ارزیابی ترکیبی (Tiered Stack)

### Tier A (هسته MVP)
- A1: Holland/RIASEC (هسته علایق)
- A2: Career Self-Efficacy کوتاه (خودکارآمدی مسیر)
- A3: Work/Study Values کوتاه (ارزش‌ها)
- A4: لایه مصاحبه/مرور مشاور (تایید انسانی)

### Tier B (تقویت‌کننده)
- B1: Big Five کوتاه یا معادل trait-based برای سبک رفتاری
- B2: شاخص‌های عملکردی مدرسه (با رضایت کاربر)
- B3: زمینه خانوادگی/فرصت‌های محیطی (اختیاری)

### Tier C (اکتشافی/غیرتصمیم‌ساز)
- C1: MBTI فقط برای self-reflection و زبان گفت‌وگو
- C2: Multiple Intelligences (گاردنر/مک‌کنزی) فقط برای engagement و پیشنهاد تمرین

قید مهم:
- MBTI/MII نباید به‌عنوان مبنای اصلی تصمیم‌گیری رشته/شغل استفاده شوند.

## 4) خروجی گزارش ترکیبی (Composite Report Contract)

- Layer 1: تصویر علایق و الگوی شخصی (RIASEC + trait summary)
- Layer 2: توانمندی/خودکارآمدی + سبک یادگیری
- Layer 3: پیشنهاد مسیرهای تحصیلی (مدرسه/دانشگاه) با دلیل
- Layer 4: پیشنهاد شغلی مرحله‌ای با سطح اطمینان
- Layer 5: برنامه اقدام 3/6/12 ماهه
- Layer 6: ریسک‌فلگ‌ها و محدودیت‌های تفسیری

## 5) طراحی تجربه آزمون برای کودک/نوجوان

### اصول UX
- کاهش خستگی شناختی:
  - تقسیم آزمون به بلوک‌های کوتاه
  - progress واضح + checkpoint
- ساده‌سازی زبان:
  - جملات کوتاه و مثال‌محور
  - پرهیز از واژگان تخصصی در متن سوال
- افزایش درگیری:
  - سناریوهای موقعیتی کوتاه
  - آیتم‌های تصویری/نمادین در صورت امکان
- حفظ کیفیت داده:
  - attention checks سبک و غیرتهاجمی
  - شناسایی الگوی پاسخ‌دهی عجولانه

### تغییر پیشنهادی در شیوه سوال‌دهی
- سوال‌های سنتی لیکرت + سوال‌های سناریویی کوتاه ترکیب شوند.
- برای 13-17:
  - متن سوال محاوره‌ای کنترل‌شده
  - مثال مدرسه/کلاس/فعالیت روزمره
  - طول هر آیتم کمتر از بزرگسال

## 6) معیارهای روان‌سنجی و انصاف

- پایایی و روایی:
  - بازسنجی دوره‌ای پایایی (test-retest)
  - بررسی روایی سازه برای گروه سنی
- انصاف:
  - مانیتور تفاوت عملکرد مدل بین جنسیت/سن/زمینه آموزشی
  - جلوگیری از توصیه‌های کلیشه‌ای
- اخلاق:
  - گزارش غیرقطعی
  - منع برچسب‌زنی ثابت
  - ارجاع به مشاور در موارد پرریسک/مرزی

## 7) مسیر استفاده از منابع خریداری‌شده کارفرما

مسیر منبع: E:/OLD/T/1_ehl6

خروجی مورد نیاز از این منابع:
- فرهنگ واژگان نوجوان‌پسند برای تفسیر
- نگاشت تیپ/علاقه به رشته‌های مدرسه و دانشگاه
- مثال‌های بومی برای برنامه اقدام تحصیلی
- هشدارها و caveatهای کاربردی برای تفسیر علمی

نکته اجرایی:
- فایل‌ها PDF/DOCX هستند و باید ingestion ساختاریافته شوند:
  - استخراج متن
  - برچسب‌گذاری موضوعی
  - تبدیل به knowledge snippets برای rule/prompt templates

## 8) مراجع معتبر برای مبنای علمی (خلاصه)

### چارچوب‌ها و استانداردها
1. AERA/APA/NCME Standards for Educational and Psychological Testing (2014)
   - https://www.apa.org/science/standards/
2. OECD Career Guidance Policy and Practice (2022)
   - https://www.oecd.org/education/career-guidance
3. O*NET Resource Center
   - https://www.onetcenter.org/
4. ILO Guidance Frameworks (career and decent work context)
   - https://www.ilo.org/

### شواهد پژوهشی کلیدی
5. Low et al. (2005) Stability of vocational interests
   - https://pubmed.ncbi.nlm.nih.gov/16187855/
6. Hoff et al. (2018) Normative changes in interests
   - https://pubmed.ncbi.nlm.nih.gov/29494193/
7. Hoff et al. (2020) Personality-interest co-development
   - https://pubmed.ncbi.nlm.nih.gov/30614731/
8. Stoll et al. (2021) Vocational interest stability after high school
   - https://pubmed.ncbi.nlm.nih.gov/32730064/
9. Adachi (2004) Career self-efficacy and interests
   - https://pubmed.ncbi.nlm.nih.gov/15460362/
10. Waterhouse (2023) Multiple Intelligences as neuromyth critique
   - https://pubmed.ncbi.nlm.nih.gov/37701872/

## 9) تصمیم‌های طراحی برای محصول Holand

- تصمیم D-01:
  - هسته تصمیم‌ساز = RIASEC + Self-efficacy + Values + Counselor review
- تصمیم D-02:
  - MBTI/MII = لایه مکمل برای خودآگاهی/تعامل، نه هسته تصمیم‌گیری
- تصمیم D-03:
  - گزارش نوجوان باید مسیر مدرسه/دانشگاه + اقدام مهارتی کوتاه‌مدت داشته باشد
- تصمیم D-04:
  - سوالات برای 13-17 بازطراحی زبانی/سناریویی شوند

## 10) برنامه پیاده‌سازی پیشنهادی

### فاز 1 (فوری)
- تثبیت Composite schema در backend
- افزودن Self-efficacy + Values mini-scale
- گزارش ترکیبی اولیه برای 13-17

### فاز 2
- اتصال ingestion منابع خریداری‌شده به templates
- بازطراحی سوالات نوجوان (A/B with psychometric checks)

### فاز 3
- quality loop و fairness audit دوره‌ای
- تنظیم LLM prompts با guardrails علمی و age-aware
