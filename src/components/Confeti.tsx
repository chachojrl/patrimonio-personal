import { useEffect, useState } from 'react'

const COLORES = ['#34C759', '#FF9500', '#007AFF', '#FF2D55', '#FFCC00', '#AF52DE']

/** Lluvia de confeti de unos segundos (al llenar una hucha). Respeta «reducir movimiento». */
export function Confeti({ activo, onFin }: { activo: boolean; onFin: () => void }) {
  const [piezas] = useState(() =>
    Array.from({ length: 70 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      dur: 1.8 + Math.random() * 1.4,
      color: COLORES[i % COLORES.length],
      giro: Math.random() * 720 - 360,
      ancho: 6 + Math.random() * 6,
    })),
  )
  useEffect(() => {
    if (!activo) return
    const t = setTimeout(onFin, 3600)
    return () => clearTimeout(t)
  }, [activo, onFin])
  if (!activo) return null
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      <style>{`@keyframes confeti-caer { from { transform: translateY(-10vh) rotate(0deg); opacity: 1 } to { transform: translateY(110vh) rotate(var(--giro)); opacity: .9 } }`}</style>
      {piezas.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 block rounded-[2px]"
          style={{
            left: `${p.left}%`, width: p.ancho, height: p.ancho * 0.45, background: p.color,
            animation: `confeti-caer ${p.dur}s ${p.delay}s cubic-bezier(.25,.6,.4,1) forwards`,
            ['--giro' as string]: `${p.giro}deg`,
            transform: 'translateY(-10vh)',
          }}
        />
      ))}
    </div>
  )
}
