import type { CambioRemoto, Config, Datos, Gasto, Tabla } from '../lib/tipos'
import type { PlanMesNuevo } from '../lib/operaciones'

/** Capa de persistencia. La lógica vive en el cliente; el repositorio solo guarda. */
export interface Repo {
  modo: 'supabase' | 'local'
  cargar(): Promise<Datos>
  insertar(tabla: Tabla, filas: object[]): Promise<void>
  actualizar(tabla: Tabla, id: string, patch: Record<string, unknown>): Promise<void>
  actualizarConfig(patch: Partial<Config>): Promise<void>
  borrar(tabla: Tabla, ids: string[]): Promise<void>
  crearMes(plan: PlanMesNuevo): Promise<void>
  reemplazarTodo(datos: Datos): Promise<void>
  /** Gastos de aportación a cuentas compartidas (los recalcula el servidor al cambiar ingresos). */
  leerAportaciones?(): Promise<Gasto[]>
  /** Recibe en tiempo real los cambios de esta cuenta hechos desde otros dispositivos. Devuelve cómo dejar de escuchar. */
  suscribir?(alCambiar: (c: CambioRemoto) => void): () => void
}

export class NoAutorizadoError extends Error {
  constructor() {
    super('Tu usuario no está autorizado para usar esta aplicación.')
  }
}
