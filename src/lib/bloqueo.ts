// Bloqueo con Face ID / huella (WebAuthn con el autenticador del propio dispositivo).
// La app nunca ve la cara ni la huella: el sistema solo confirma que es el dueño del móvil.
// Es una preferencia de cada dispositivo (se guarda en el navegador).

const CLAVE = 'presupuesto-bloqueo'
export const MINUTOS_EN_SEGUNDO_PLANO = 1

interface Guardado {
  credencial: string // id de la credencial, en base64url
}

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const deB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
const aleatorio = (n: number) => crypto.getRandomValues(new Uint8Array(n))

function leer(): Guardado | null {
  try {
    const s = localStorage.getItem(CLAVE)
    return s ? (JSON.parse(s) as Guardado) : null
  } catch {
    return null
  }
}

export function bloqueoActivo(): boolean {
  return leer() !== null
}

/** ¿Este dispositivo tiene Face ID, huella o similar disponible para la web? */
export async function bloqueoDisponible(): Promise<boolean> {
  try {
    return typeof PublicKeyCredential !== 'undefined' && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  } catch {
    return false
  }
}

/** Activa el bloqueo: el sistema pide Face ID / huella una vez para crear la credencial. */
export async function activarBloqueo(nombre: string): Promise<void> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: aleatorio(32),
      rp: { name: 'Presupuesto' },
      user: { id: aleatorio(16), name: nombre || 'presupuesto', displayName: nombre || 'Presupuesto' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error('No se pudo activar.')
  localStorage.setItem(CLAVE, JSON.stringify({ credencial: b64(cred.rawId) } satisfies Guardado))
}

export function desactivarBloqueo() {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    /* nada */
  }
}

/** Pide Face ID / huella. true si el sistema confirma que es el dueño. */
export async function verificarBloqueo(): Promise<boolean> {
  const g = leer()
  if (!g) return true
  const r = (await navigator.credentials.get({
    publicKey: {
      challenge: aleatorio(32),
      allowCredentials: [{ type: 'public-key', id: deB64(g.credencial), transports: ['internal', 'hybrid'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  })) as PublicKeyCredential | null
  if (!r) return false
  // Bit «UV» (usuario verificado) de los datos del autenticador: Face ID / huella / código del móvil
  const datos = new Uint8Array((r.response as AuthenticatorAssertionResponse).authenticatorData)
  return (datos[32] & 0x04) !== 0
}
