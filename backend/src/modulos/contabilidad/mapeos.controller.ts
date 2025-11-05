// src/modulos/contabilidad/mapeos.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ContabilidadService } from './contabilidad.service';

type ReqOrg = Request & { organizacionId?: string };

// ===== DTOs bien tipados (sin any) =====
type UpsertMapeoDto = {
  origen: string;
  conceptoCodigo?: string | null;
  metodoPago?: string | null;
  debeCodigo: string;
  haberCodigo: string;
  descripcion?: string | null;
};

type CrearMapeoDto = UpsertMapeoDto;
type ActualizarMapeoDto = Partial<UpsertMapeoDto> & { activo?: boolean };

type ListarQuery = {
  q?: string;
  origen?: string;
  activo?: string; // 'true' | 'false' | undefined
  page?: string; // números como string
  pageSize?: string; // números como string
};

type BuscarCuentasQuery = {
  q: string;
  imputableOnly?: string; // 'true' | 'false'
  limit?: string; // número como string
};

@Controller('contabilidad/mapeos')
export class MapeosController {
  constructor(private readonly svc: ContabilidadService) {}

  // === LISTAR (compat simple o paginado/filtrado) ===
  @Get()
  async listar(@Req() req: ReqOrg, @Query() q: ListarQuery) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');

    const usingPaging = Boolean(q.page || q.pageSize || q.q || q.origen || q.activo !== undefined);
    if (!usingPaging) {
      // compat: listado activo=true
      return this.svc.listarMapeos(org);
    }

    const activo =
      q.activo === undefined
        ? null
        : q.activo === 'true'
          ? true
          : q.activo === 'false'
            ? false
            : null;

    return this.svc.listarMapeosPaginado(org, {
      q: q.q ?? null,
      origen: q.origen ?? null,
      activo,
      page: q.page ? Number(q.page) : 1,
      pageSize: q.pageSize ? Number(q.pageSize) : 20,
    });
  }

  // === COMPAT: upsert y toggle (¡no se tocan rutas existentes!) ===
  @Post()
  async upsert(@Req() req: ReqOrg, @Body() body: UpsertMapeoDto) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return this.svc.upsertMapeo(org, body);
  }

  @Patch(':id/toggle')
  async toggle(@Req() req: ReqOrg, @Param('id') id: string, @Body() body: { activo: boolean }) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return this.svc.toggleMapeo(org, BigInt(id), Boolean(body.activo));
  }

  // === CRUD nuevo y explícito ===
  @Post('create')
  async create(@Req() req: ReqOrg, @Body() body: CrearMapeoDto) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return this.svc.crearMapeo(org, body);
  }

  @Get(':id')
  async getById(@Req() req: ReqOrg, @Param('id') id: string) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return this.svc.obtenerMapeo(org, BigInt(id));
  }

  @Put(':id')
  async update(@Req() req: ReqOrg, @Param('id') id: string, @Body() body: ActualizarMapeoDto) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return this.svc.actualizarMapeo(org, BigInt(id), body);
  }

  @Delete(':id')
  async remove(@Req() req: ReqOrg, @Param('id') id: string) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return this.svc.eliminarMapeo(org, BigInt(id));
  }

  // === Extra útil para la UI: autocompletar cuentas ===
  // GET /contabilidad/mapeos/cuentas?q=1101&imputableOnly=true&limit=10
  @Get('cuentas/search')
  async buscarCuentas(@Req() req: ReqOrg, @Query() query: BuscarCuentasQuery) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');

    const q = (query.q ?? '').trim();
    if (!q) return [];

    const imputableOnly = query.imputableOnly === 'true';
    const limit = query.limit ? Number(query.limit) : 20;

    return this.svc.buscarCuentas({ organizacionId: org, q, imputableOnly, limit });
  }

  //SOLO PARA EL SEED
  @Post('seed-cierre')
  async seedCierre(@Req() req: ReqOrg) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return this.svc.seedMapeosCierreCaja(org);
  }

  // POST /contabilidad/mapeos/seed-terceros
  @Post('seed-terceros')
  async seedTerceros(
    @Req() req: ReqOrg,
    @Body()
    body?: {
      rol?: 'PROVEEDOR' | 'PRESTADOR' | 'AFILIADO' | 'OTRO' | null;
      cuentas?: {
        puente?: string;
        cxp?: string;
        gasto?: string;
        ivaCredito?: string;
        exento?: string;
        noGravado?: string;
        otros?: string;
        gastoAdmin?: string;
        impInterno?: string;
        impMunicipal?: string;
        percepIVA?: string;
        retIVA?: string;
        retGan?: string;
        percepIIBB?: string;
        retIIBB?: string;
        mp_efectivo?: string;
        mp_transferencia?: string;
        mp_cheque?: string;
        mp_otro?: string;
      };
    },
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return this.svc.seedMapeosTerceros(org, body);
  }
}
