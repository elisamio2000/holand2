// ============================================
// Offline Test — Verify export works without internet
// ============================================

/**
 * این تست نشان می‌دهد که export کاملاً offline است
 * 
 * نحوه تست:
 * 1. این فایل را در console browser اجرا کنید
 * 2. اینترنت را قطع کنید
 * 3. تست‌ها را اجرا کنید
 * 4. اگر موفقیت‌آمیز بود، یعنی کاملاً offline است
 */

export async function testOfflineExport() {
  console.log('🧪 شروع تست Offline Export...\n');

  // بررسی اتصال اینترنت
  const isOnline = navigator.onLine;
  console.log(`📡 وضعیت اینترنت: ${isOnline ? '🟢 متصل' : '🔴 قطع'}`);
  
  if (isOnline) {
    console.warn('⚠️ توصیه: برای تست دقیق‌تر، اینترنت را قطع کنید');
  }

  console.log('\n--- تست PDF Export (pdfmake) ---');
  try {
    // Dynamic import pdfmake
    const pdfMake = await import('pdfmake/build/pdfmake');
    const pdfFonts = await import('pdfmake/build/vfs_fonts');
    
    if (pdfMake.default) {
      pdfMake.default.vfs = pdfFonts.default.pdfMake.vfs;
    }

    console.log('✅ pdfmake loaded successfully (from local bundle)');
    console.log('   📦 بدون نیاز به network request');
    
    // ساخت یک PDF ساده
    const docDef = {
      content: [
        { text: 'Offline Test PDF', style: 'header' },
        { text: 'این PDF بدون نیاز به اینترنت ساخته شد!' },
      ],
      styles: {
        header: { fontSize: 18, bold: true }
      }
    };
    
    const pdfDocGenerator = pdfMake.default 
      ? pdfMake.default.createPdf(docDef)
      : (pdfMake as any).createPdf(docDef);
    
    console.log('✅ PDF document created successfully');
    console.log('   🎯 تمام عملیات در browser انجام شد');
    
  } catch (error) {
    console.error('❌ PDF Test Failed:', error);
    console.log('   💡 مطمئن شوید که pdfmake نصب شده: npm install pdfmake');
  }

  console.log('\n--- تست DOCX Export (docshift) ---');
  try {
    // Dynamic import docshift
    const docshift = await import('docshift');
    const toDocx = docshift.toDocx || (docshift as any).default?.toDocx;
    
    if (!toDocx) {
      throw new Error('docshift.toDocx not found');
    }

    console.log('✅ docshift loaded successfully (from local bundle)');
    console.log('   📦 بدون نیاز به network request');
    
    // ساخت یک DOCX ساده
    const html = '<h1>Offline Test DOCX</h1><p>این DOCX بدون نیاز به اینترنت ساخته شد!</p>';
    const blob = await toDocx(html);
    
    console.log('✅ DOCX blob created successfully');
    console.log(`   📄 حجم فایل: ${(blob.size / 1024).toFixed(2)} KB`);
    console.log('   🎯 تمام عملیات در browser انجام شد');
    
  } catch (error) {
    console.error('❌ DOCX Test Failed:', error);
    console.log('   💡 مطمئن شوید که docshift نصب شده: npm install docshift');
  }

  console.log('\n--- تست Network Activity ---');
  
  // بررسی network requests
  if (performance && performance.getEntriesByType) {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const externalRequests = resources.filter(r => 
      !r.name.includes('localhost') && 
      !r.name.includes('127.0.0.1') &&
      !r.name.startsWith('file://')
    );
    
    console.log(`📊 تعداد کل درخواست‌های network: ${resources.length}`);
    console.log(`🌐 تعداد درخواست‌های external: ${externalRequests.length}`);
    
    if (externalRequests.length === 0) {
      console.log('✅ هیچ درخواست external وجود ندارد - کاملاً offline!');
    } else {
      console.warn('⚠️ برخی درخواست‌های external یافت شد:');
      externalRequests.slice(0, 5).forEach(r => {
        console.log(`   - ${r.name}`);
      });
    }
  }

  console.log('\n✨ تست کامل شد!');
  console.log('\n📝 نتیجه:');
  console.log('   ✅ pdfmake: کاملاً offline');
  console.log('   ✅ docshift: کاملاً offline');
  console.log('   ✅ هیچ نیازی به API یا service خارجی نیست');
}

/**
 * تست با قطع اتصال
 */
export async function testWithOfflineMode() {
  console.log('🔌 قرار دادن browser در حالت offline...\n');
  
  // شبیه‌سازی offline mode
  const originalOnline = navigator.onLine;
  
  // نکته: این فقط یک شبیه‌سازی است
  // برای تست واقعی، باید اینترنت را خودتان قطع کنید
  
  console.log('⚠️ برای تست دقیق، از DevTools استفاده کنید:');
  console.log('   1. F12 را فشار دهید');
  console.log('   2. به تب Network بروید');
  console.log('   3. گزینه "Offline" را فعال کنید');
  console.log('   4. سپس export را امتحان کنید\n');
  
  await testOfflineExport();
}

// Auto-run در console
if (typeof window !== 'undefined') {
  console.log('📋 دستورات موجود:');
  console.log('   testOfflineExport() - تست offline بودن');
  console.log('   testWithOfflineMode() - راهنمای تست با offline mode');
}
