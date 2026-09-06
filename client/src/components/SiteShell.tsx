import { BookOpen, MessageCircle, Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

export default function SiteShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isTeacher = location.startsWith("/teacher");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-white/40 bg-[#fbfaf5]/85 backdrop-blur-xl">
        <div className="container flex h-[76px] items-center justify-between gap-4">
          <Link href="/" className="group flex items-center gap-3" aria-label="العودة إلى الرئيسية">
            <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-[#153f4a] text-[#f6d982] shadow-lg shadow-[#153f4a]/15">
              <span className="absolute -left-2 -top-3 h-9 w-9 rounded-full bg-[#52b6a0]/35" />
              <span className="relative text-xl font-extrabold">ن</span>
            </span>
            <span className="leading-none">
              <span className="block text-[18px] font-extrabold tracking-tight text-[#153f4a]">النجيب</span>
              <span className="mt-1 block text-[10px] font-semibold tracking-[0.18em] text-[#5c827f]">منصة العربية</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-[#47706f] md:flex" aria-label="التنقل الرئيسي">
            <a href="/#classes" className="transition-colors hover:text-[#153f4a]">الصفوف</a>
            <a href="/#how-it-works" className="transition-colors hover:text-[#153f4a]">كيف تبدأ</a>
            <a href="/#about" className="transition-colors hover:text-[#153f4a]">عن المنصة</a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {!isTeacher && (
              <Link href="/teacher-login" className="group flex items-center gap-2 rounded-full px-2 py-2 text-xs font-bold text-[#54706f] transition-colors hover:bg-white/70 hover:text-[#153f4a] sm:px-3">
                <Sparkles className="h-3.5 w-3.5 text-[#c39735] transition-transform group-hover:rotate-12" />
                <span>لوحتي</span>
              </Link>
            )}
            <Link href="/#classes" className="hidden rounded-full bg-[#e7bd52] px-4 py-2.5 text-xs font-extrabold text-[#153f4a] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#f1ce6d] sm:inline-flex">
              ابدأ التعلم
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(value => !value)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[#e4ddce] bg-white/80 text-[#153f4a] md:hidden"
              aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-[#e8dfcb] bg-[#fbfaf5] px-4 py-3 md:hidden" aria-label="قائمة الهاتف">
            <div className="container flex flex-col gap-1 !px-0">
              <a onClick={() => setMenuOpen(false)} href="/#classes" className="rounded-xl px-4 py-3 text-sm font-bold text-[#47706f] hover:bg-white">الصفوف</a>
              <a onClick={() => setMenuOpen(false)} href="/#how-it-works" className="rounded-xl px-4 py-3 text-sm font-bold text-[#47706f] hover:bg-white">كيف تبدأ</a>
              <a onClick={() => setMenuOpen(false)} href="/#about" className="rounded-xl px-4 py-3 text-sm font-bold text-[#47706f] hover:bg-white">عن المنصة</a>
              <Link onClick={() => setMenuOpen(false)} href="/#classes" className="mt-1 rounded-xl bg-[#e7bd52] px-4 py-3 text-center text-sm font-extrabold text-[#153f4a] sm:hidden">ابدأ التعلم</Link>
            </div>
          </nav>
        )}
      </header>

      <main>{children}</main>

      <a
        href="https://wa.me/201283129947"
        target="_blank"
        rel="noreferrer"
        className="whatsapp-fab fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-full bg-[#26a66a] px-4 py-3 text-sm font-bold text-white"
        aria-label="التواصل مع النجيب عبر واتساب"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline">تواصل واتساب</span>
      </a>

      <footer className="border-t border-[#e8dfcb] bg-[#f3eee1]">
        <div className="container flex flex-col gap-4 py-8 text-sm text-[#5c706e] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 font-bold text-[#153f4a]"><BookOpen className="h-4 w-4 text-[#c39735]" /> النجيب · العربية بفهم</div>
          <p>محتوى مرتب، وصول واضح، وتعلّم على خطوتك.</p>
        </div>
      </footer>
    </div>
  );
}
