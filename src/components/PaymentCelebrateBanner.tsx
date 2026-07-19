import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { CloseIcon, HeartIcon } from '@/components/icons';
import { DONATE_URL, MonoCatIcon } from '@/components/donate';

export function PaymentCelebrateBanner() {
  const [visible, setVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;

    // Spectacular Confetti Explosion using GSAP
    const colors = ['#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#10b981', '#fcd34d', '#ec4899'];
    const confettiCount = 150;
    const elements: HTMLDivElement[] = [];

    if (confettiRef.current) {
      for (let i = 0; i < confettiCount; i++) {
        const el = document.createElement('div');
        const isCircle = Math.random() > 0.5;
        el.style.position = 'absolute';
        el.style.width = isCircle ? '10px' : '8px';
        el.style.height = isCircle ? '10px' : '16px';
        el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]!;
        el.style.borderRadius = isCircle ? '50%' : '2px';
        
        // Start from center top of the screen
        el.style.top = '100px';
        el.style.left = '50%';
        el.style.zIndex = '10000';
        el.style.opacity = '0';
        confettiRef.current.appendChild(el);
        elements.push(el);
      }

      elements.forEach((el) => {
        const angle = (Math.random() * Math.PI) - (Math.PI / 2); // -90 to +90 deg (upwards and outwards)
        const velocity = 300 + Math.random() * 500;
        
        gsap.fromTo(el, 
          { x: 0, y: 0, opacity: 1, scale: Math.random() * 0.5 + 0.5 },
          {
            x: Math.sin(angle) * velocity,
            y: -Math.cos(angle) * velocity + (Math.random() * 200), // Initial burst up
            rotation: Math.random() * 720 - 360,
            rotationX: Math.random() * 720 - 360,
            rotationY: Math.random() * 720 - 360,
            duration: 0.8 + Math.random() * 0.5,
            ease: 'power3.out',
            onComplete: () => {
              // Fall down
              gsap.to(el, {
                y: window.innerHeight + 100,
                x: `+=${Math.sin(angle) * 100}`,
                rotation: `+=${Math.random() * 360}`,
                duration: 1.5 + Math.random() * 1.5,
                ease: 'power1.in',
                opacity: 0,
                onComplete: () => el.remove()
              });
            }
          }
        );
      });
    }

    // Banner entrance animation
    if (bannerRef.current) {
      gsap.fromTo(
        bannerRef.current,
        { y: -100, opacity: 0, scale: 0.8 },
        { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.7)', delay: 0.1 }
      );
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 2147483647, // Max z-index to ensure it's on top of everything
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '24px',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <div ref={confettiRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />

      <div
        ref={bannerRef}
        style={{
          pointerEvents: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(245, 158, 11, 0.2)',
          padding: '24px',
          maxWidth: '420px',
          width: '90%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)',
          border: '1px solid #fde68a'
        }}
      >
        <button
          onClick={() => setVisible(false)}
          title="Закрити"
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#9ca3af',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
            e.currentTarget.style.color = '#4b5563';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#9ca3af';
          }}
        >
          <CloseIcon style={{ width: '18px', height: '18px' }} />
        </button>

        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#fef3c7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          color: '#f59e0b',
          boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.1)'
        }}>
          <HeartIcon style={{ width: '28px', height: '28px' }} />
        </div>

        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '800', color: '#111827' }}>
          Квиток у кишені! 🎉
        </h2>
        <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#4b5563', lineHeight: '1.5' }}>
          Мисливець працює безкоштовно. Якщо зекономив тобі нерви — кинь ₴ у банку, поки є 15 хвилин на оплату.
        </p>

        <a
          href={DONATE_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: '#f59e0b',
            color: '#fff',
            textDecoration: 'none',
            padding: '12px 24px',
            borderRadius: '12px',
            fontWeight: '700',
            fontSize: '15px',
            boxShadow: '0 4px 14px 0 rgba(245, 158, 11, 0.39)',
            transition: 'all 0.2s ease',
            backgroundImage: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(245, 158, 11, 0.39)';
          }}
        >
          <MonoCatIcon style={{ width: '18px', height: '18px' }} />
          Подякувати в монобанку
        </a>
      </div>
    </div>
  );
}
