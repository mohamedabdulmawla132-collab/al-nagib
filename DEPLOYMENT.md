# تشغيل ونشر منصة النجيب

## قبل النشر
1. انسخ `.env.example` إلى `.env`.
2. ضع `DATABASE_URL` لقاعدة MySQL/MariaDB مستقرة.
3. ضع `JWT_SECRET` قويًا.
4. ضع `TEACHER_USERNAME` و`TEACHER_PASSWORD`.
5. ضع `PAYMENT_WALLET_NUMBER` لرقم المحفظة.
6. ضع `GEMINI_API_KEY` حتى يعمل التصحيح الآلي للواجبات.
7. اختياريًا: اضبط `GOOGLE_SHEETS_UPDATE_WEBHOOK_URL` و`GOOGLE_SHEETS_UPDATE_TOKEN` لمزامنة الدرجات.

## أوامر التشغيل
- `pnpm install`
- `pnpm db:push`
- `pnpm dev` للتجربة
- `pnpm build && pnpm start` للإنتاج

## ملاحظة مهمة
الرابط القديم على `manus.space` هو رابط نشر تابع لـ Manus. المستخدم المجاني يستطيع طلب حزمة الكود والنشر بنفسه بحسب توثيق Manus. يمكن وضع نطاقك الخاص على منصة نشر تدعم Node/Express.

## التصحيح الآلي
المنصة تحاول أولًا استخدام Google Gemini مباشرةً من الخادم عبر `GEMINI_API_KEY`، ثم تستخدم بوابة الذكاء الاصطناعي المدمجة كبديل. لا يتم إرسال مفتاح الذكاء الاصطناعي إلى المتصفح.
