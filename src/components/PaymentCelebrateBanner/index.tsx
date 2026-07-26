import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { CloseIcon, HeartIcon } from '@/components/icons';
import { DONATE_URL } from '@/components/donate/constants';
import { MonoCatIcon } from '@/components/donate/MonoCatIcon';
import { useConfetti } from '@/hooks/use-confetti';
import './celebrate.css';

export function PaymentCelebrateBanner() {
  const [visible, setVisible] = useState(true);
  const bannerRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);

  useConfetti(confettiRef, visible);

  useEffect(() => {
    if (!visible || !bannerRef.current) return;
    gsap.fromTo(
      bannerRef.current,
      { y: -100, opacity: 0, scale: 0.8 },
      { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.7)', delay: 0.1 },
    );
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      // Injected into the host SPA, so the z-index is the max 32-bit value to
      // stay above any of its overlays.
      className="uz:fixed uz:inset-0 uz:z-[2147483647] uz:flex uz:items-start uz:justify-center uz:pt-6 uz:pointer-events-none uz:font-[family-name:system-ui,-apple-system,Segoe_UI,Roboto,sans-serif]"
    >
      <div ref={confettiRef} className="uz:absolute uz:inset-0" />

      <div
        ref={bannerRef}
        className="uz:pointer-events-auto uz:relative uz:flex uz:w-[90%] uz:max-w-[420px] uz:flex-col uz:items-center uz:rounded-2xl uz:border uz:border-amber-200 uz:bg-white uz:bg-gradient-to-b uz:from-amber-50 uz:to-white uz:p-6 uz:text-center uz:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25),0_0_0_1px_rgba(245,158,11,0.2)]"
      >
        <button
          onClick={() => setVisible(false)}
          title="Закрити"
          className="uz:absolute uz:top-3 uz:right-3 uz:flex uz:size-7 uz:cursor-pointer uz:items-center uz:justify-center uz:rounded-lg uz:border-none uz:bg-transparent uz:text-gray-400 uz:transition-all uz:duration-200 uz:ease-[ease] uz:hover:bg-black/5 uz:hover:text-gray-600 uz:focus-visible:bg-black/5 uz:focus-visible:text-gray-600"
        >
          <CloseIcon className="uz:size-[18px]" />
        </button>

        <div className="uz:mb-4 uz:flex uz:size-14 uz:items-center uz:justify-center uz:rounded-full uz:bg-amber-100 uz:text-amber-500 uz:shadow-[0_4px_6px_-1px_rgba(245,158,11,0.1)]">
          <HeartIcon className="uz:size-7" />
        </div>

        <h2 className="uz:mt-0 uz:mb-2 uz:text-[20px] uz:font-extrabold uz:text-gray-900">
          Квиток у кишені! 🎉
        </h2>
        <p className="uz:mt-0 uz:mb-5 uz:text-[14px] uz:leading-[1.5] uz:text-gray-600">
          Мисливець працює безкоштовно. Якщо зекономив тобі нерви — кинь ₴ у банку, поки є 15 хвилин
          на оплату.
        </p>

        <a
          href={DONATE_URL}
          target="_blank"
          rel="noreferrer"
          className="uz:inline-flex uz:items-center uz:justify-center uz:gap-2 uz:rounded-xl uz:bg-amber-500 uz:bg-[linear-gradient(180deg,#fbbf24_0%,#f59e0b_100%)] uz:px-6 uz:py-3 uz:text-[15px] uz:font-bold uz:text-white uz:no-underline uz:shadow-[0_4px_14px_0_rgba(245,158,11,0.39)] uz:transition-all uz:duration-200 uz:ease-[ease] uz:hover:-translate-y-0.5 uz:hover:scale-[1.02] uz:hover:shadow-[0_6px_20px_rgba(245,158,11,0.4)] uz:focus-visible:-translate-y-0.5 uz:focus-visible:scale-[1.02] uz:focus-visible:shadow-[0_6px_20px_rgba(245,158,11,0.4)]"
        >
          <MonoCatIcon className="uz:size-[18px]" />
          Подякувати в монобанку
        </a>
      </div>
    </div>
  );
}
