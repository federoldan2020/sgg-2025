import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { OrgId } from '../../common/decorators/org-id.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Usuario } from '@prisma/client';
import { NovedadesPendientesService } from './novedades-pendientes.service';
import type {
  ConceptoNov,
  DestinoNov,
  EstadoNov,
} from './novedades-pendientes.service';

class ListarQueryDto {
  @IsOptional() @IsIn(['pendiente', 'enviada', 'cancelada']) estado?: EstadoNov;
  @IsOptional() @IsIn(['COMPUTOS', 'ANSES']) destino?: DestinoNov;
  @IsOptional() @IsIn(['J17', 'J22', 'J38']) concepto?: ConceptoNov;
  @IsOptional() @IsString() periodoObjetivo?: string;
  @IsOptional() @IsString() padronId?: string;
  @IsOptional() @IsString() take?: string;
  @IsOptional() @IsString() skip?: string;
}

class CancelarDto {
  @IsString() motivo!: string;
}

class CrearManualDto {
  @IsString() padronId!: string;
  @IsString() afiliadoId!: string;
  @IsIn(['J17', 'J22', 'J38']) concepto!: ConceptoNov;
  @IsIn(['alta', 'baja', 'modificacion']) tipoMovimiento!:
    | 'alta'
    | 'baja'
    | 'modificacion';
  @IsIn(['COMPUTOS', 'ANSES']) destino!: DestinoNov;
  @IsOptional() valor?: number;
  @IsString() periodoObjetivo!: string;
  @IsOptional() @IsString() observacion?: string;
}

@Controller('novedades/pendientes')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Public()
export class NovedadesPendientesController {
  constructor(private readonly svc: NovedadesPendientesService) {}

  @Get()
  async listar(@OrgId() orgId: string, @Query() q: ListarQueryDto) {
    return this.svc.listar(orgId, {
      estado: q.estado,
      destino: q.destino,
      concepto: q.concepto,
      periodoObjetivo: q.periodoObjetivo,
      padronId: q.padronId ? BigInt(q.padronId) : undefined,
      take: q.take ? Number(q.take) : undefined,
      skip: q.skip ? Number(q.skip) : undefined,
    });
  }

  @Get(':id')
  async detalle(@OrgId() orgId: string, @Param('id') id: string) {
    return this.svc.detalle(orgId, BigInt(id));
  }

  @Post()
  async crearManual(
    @OrgId() orgId: string,
    @Body() dto: CrearManualDto,
    @CurrentUser() user?: Usuario,
  ) {
    return this.svc.crear({
      organizacionId: orgId,
      padronId: BigInt(dto.padronId),
      afiliadoId: BigInt(dto.afiliadoId),
      concepto: dto.concepto,
      tipoMovimiento: dto.tipoMovimiento,
      destino: dto.destino,
      valor: dto.valor,
      periodoObjetivo: dto.periodoObjetivo,
      origenEvento: 'manual_operador',
      observacion: dto.observacion,
      creadoPorId: user?.id?.toString(),
    });
  }

  @Patch(':id/cancelar')
  async cancelar(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: CancelarDto,
    @CurrentUser() user?: Usuario,
  ) {
    return this.svc.cancelar(
      orgId,
      BigInt(id),
      dto.motivo,
      user?.id?.toString(),
    );
  }
}
