import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import SiteShell from "@/components/SiteShell";
import { trpc } from "@/lib/trpc";

export default function TeacherLogin() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const teacherMe = trpc.platform.teacher.me.useQuery(undefined, { refetchOnMount: "always" });
  const utils = trpc.useUtils();
  const login = trpc.platform.teacher.login.useMutation({
    onSuccess: async () => {
      toast.success("تم فتح بوابة المدرّس");
      await utils.platform.teacher.me.invalidate();
      navigate("/teacher");
    },
    onError: error => toast.error(error.message || "تعذر تسجيل الدخول"),
  });

  useEffect(() => {
    if (teacherMe.data?.authenticated) navigate("/teacher");
  }, [navigate, teacherMe.data?.authenticated]);

  return (
    <SiteShell>
      <div className="min-h-[calc(100vh-76px)] bg-[#f2eee3] px-4 py-12 sm:py-20">
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] bg-[#153f4a] shadow-2xl shadow-[#153f4a]/15 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="na-hero-grid relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between"><div className="absolute -left-20 top-12 h-48 w-48 rounded-full bg-[#5b9b8d]/20 blur-3xl" /><div className="relative"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e7bd52] text-xl font-black text-[#153f4a]">ن</span><p className="mt-12 text-sm font-bold text-[#b7d8d0]">مساحة المدرّس</p><h1 className="na-display mt-3 max-w-xs text-4xl font-extrabold leading-tight">أدر حصصك،<br /><span className="text-[#e7bd52]">بهدوء.</span></h1><p className="mt-5 max-w-sm text-sm leading-7 text-[#c6dcda]">أضف المحتوى، حدّد الصف، وتابع طلبات الوصول من مكان واحد.</p></div><div className="relative flex items-center gap-3 border-t border-white/10 pt-5 text-xs font-bold text-[#b7d8d0]"><ShieldCheck className="h-5 w-5 text-[#e7bd52]" /> جلسة محمية ومشفّرة</div></div>
          <div className="relative bg-[#fbfaf5] p-7 sm:p-12"><div className="na-grid pointer-events-none absolute inset-x-0 top-0 h-2 opacity-70" /><Link href="/" className="mb-12 inline-flex items-center gap-2 text-xs font-bold text-[#72908a] hover:text-[#153f4a]"><ArrowRight className="h-4 w-4" /> العودة للرئيسية</Link><div className="max-w-md"><div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#eef5f1] px-3 py-1.5 text-[10px] font-extrabold text-[#5b9b8d]"><ShieldCheck className="h-3.5 w-3.5" /> جلسة مدرس آمنة</div><p className="text-xs font-extrabold tracking-[0.18em] text-[#5b9b8d]">لوحة خاصة</p><h2 className="na-display mt-3 text-3xl font-extrabold text-[#153f4a]">مرحبًا بك في لوحتي</h2><p className="mt-3 text-sm leading-7 text-[#718580]">هذه المساحة مخصصة لإدارة محتوى النجيب. بيانات الدخول لا تُحفظ في المتصفح.</p><form className="mt-9 space-y-5" onSubmit={event => { event.preventDefault(); login.mutate({ username, password }); }}><label className="block"><span className="mb-2 block text-xs font-extrabold text-[#3e6261]">اسم المستخدم</span><div className="relative"><KeyRound className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-[#88a39c]" /><input required value={username} onChange={event => setUsername(event.target.value)} className="h-12 w-full rounded-xl border border-[#e4ddce] bg-white pr-10 text-sm outline-none transition focus:border-[#5b9b8d] focus:ring-4 focus:ring-[#5b9b8d]/10" placeholder="اكتب اسم المستخدم" /></div></label><label className="block"><span className="mb-2 block text-xs font-extrabold text-[#3e6261]">كلمة المرور</span><div className="relative"><LockKeyhole className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-[#88a39c]" /><input required type="password" value={password} onChange={event => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-[#e4ddce] bg-white pr-10 text-sm outline-none transition focus:border-[#5b9b8d] focus:ring-4 focus:ring-[#5b9b8d]/10" placeholder="أدخل كلمة المرور" /></div></label><button disabled={login.isPending} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#153f4a] text-sm font-extrabold text-white transition hover:bg-[#1e5660] disabled:cursor-wait disabled:opacity-60">{login.isPending ? "جارٍ التحقق..." : "دخول آمن"}<ArrowRight className="h-4 w-4" /></button></form><div className="mt-7 flex items-start gap-3 rounded-2xl bg-[#eef5f1] p-4 text-xs leading-6 text-[#63817b]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#5b9b8d]" /><span>تتم مطابقة البيانات على الخادم فقط، وتبقى كلمة المرور خارج الواجهة.</span></div></div></div>
        </div>
      </div>
    </SiteShell>
  );
}
