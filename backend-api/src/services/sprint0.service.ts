import {
  Sprint0Repository,
  Sprint0StatusRecord,
} from '../repositories/sprint0.repository';

export interface Sprint0StatusResult {
  ok: boolean;
  source: string;
  data: Sprint0StatusRecord;
}

/**
 * Capa de Lógica de Negocio (Service):
 * Coordina la obtención del estado de la base técnica TS-00 y normaliza la respuesta.
 */
export class Sprint0Service {
  private readonly repository: Sprint0Repository;

  constructor(repository = new Sprint0Repository()) {
    this.repository = repository;
  }

  async obtenerEstadoBaseTecnica(): Promise<Sprint0StatusResult> {
    const { source, record } =
      await this.repository.getOrCreateStatusDocument();

    return {
      ok: true,
      source,
      data: record,
    };
  }
}
