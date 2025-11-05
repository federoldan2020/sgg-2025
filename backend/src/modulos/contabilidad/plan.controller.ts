// src/modulos/contabilidad/plan.controller.ts
import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ContabilidadService } from './contabilidad.service';

type ReqOrg = Request & { organizacionId?: string };

@Controller('contabilidad/plan')
export class PlanController {
  constructor(private readonly svc: ContabilidadService) {}

  @Get()
  async listar(@Req() req: ReqOrg) {
    const org = req.organizacionId; // 👈 normalizamos a string
    if (!org) throw new Error('Falta organización');
    return this.svc.listarPlan(org);
  }

  @Get('arbol') // 👈 NUEVO
  async arbol(@Req() req: ReqOrg) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return this.svc.planComoArbol(org);
  }

  @Post()
  async crear(
    @Req() req: ReqOrg,
    @Body()
    body: {
      codigo: string;
      nombre: string;
      tipo: string;
      padreId?: string | null; // viene del front como string (o null)
    },
  ) {
    const org = req.organizacionId; // 👈 normalizamos a string
    if (!org) throw new Error('Falta organización');

    const padreIdBig: bigint | null =
      body.padreId && body.padreId.trim() !== '' ? BigInt(body.padreId) : null;

    return this.svc.crearCuenta(org, {
      codigo: body.codigo,
      nombre: body.nombre,
      tipo: body.tipo,
      padreId: padreIdBig, // 👈 el service espera bigint|null
    });
  }
}
