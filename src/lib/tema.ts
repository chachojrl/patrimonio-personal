import { useEffect, useState } from 'react'

export type Tema = 'sistema' | 'claro' | 'oscuro'
export const NOMBRE_TEMA: Record<Tema, string> = { sistema: 'Automático', claro: 'Claro', oscuro: 'Oscuro' }

function leer(): Tema {
  try {
    const t = localStorage.getItem('tema')
    return t === 'claro' || t === 'oscuro' ? t : 'sistema'
  } catch {
    return 'sistema'
  }
}

/** Tema de la app (se recuerda en este dispositivo; index.html lo aplica al arrancar). */
export function useTema(): [Tema, (t: Tema) => void] {
  const [tema, setTema] = useState<Tema>(leer)
  useEffect(() => {
    try {
      localStorage.setItem('tema', tema)
    } catch {
      /* sin almacenamiento */
    }
    const oscuro = tema === 'oscuro' || (tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', oscuro)
  }, [tema])
  return [tema, setTema]
}
