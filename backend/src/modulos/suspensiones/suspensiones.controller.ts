import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Usuario } from '@prisma/client';
import { ParametrosService } from './parametros.service';
import { CoberturaService } from './cobertura.service';
import { SuspensionesService } from './suspensiones.service';
import { ExcepcionesService } from './excepciones.service';
import { CierreMensualService } from './cierre-mensual.service';
import { ObligacionesMensualesService } from './obligaciones-mensuales.service';
import {
  CalcularCoberturaDto,
  CierreMensualDto,
  CrearExcepcionDto,
  CrearParametroDto,
  MaterializarMensualDto,
  RehabilitarDto,
  RevertirSuspensionDto,
  SuspenderManualDto,
} from './dto/suspensiones.dto';

type ReqOrg = Request & { organizacionId?: string };

function requireOrg(req: ReqOrg): string {
  if (!req.organizacionId) throw new BadRequestException('Falta organización');
  return req.organizacionId;
}

@Controller('parametros')
export class ParametrosController {
  constructor(private readonly service: ParametrosService) {}

  @Public()
  @Get('j17-minimo')
  async listarMinimo(@Req() req: ReqOrg) {
    return this.service.listar(requireOrg(req), 'J17_MINIMO');
  }

  @Public()
  @Get('j17-minimo/vigente')
  async vigenteMinimo(@Req() req: ReqOrg) {
    return this.service.getVigente(requireOrg(req), new Date(), 'J17_MINIMO');
  }

  @Public()
  @Post('j17-minimo')
  async crearMinimo(
    @Req() req: ReqOrg,
    @Body() dto: CrearParametroDto,
    @CurrentUser() user?: Usuario,
  ) {
    return this.service.crear(
      requireOrg(req),
      'J17_MINIMO',
      dto.valor,
      new Date(dto.vigenteDesde),
      user?.id?.toString(),
    );
  }

  @Public()
  @Delete('j17-minimo/ultima')
  async eliminarUltimaMinimo(@Req() req: ReqOrg) {
    return this.service.eliminarUltima(requireOrg(req), 'J17_MINIMO');
  }

  @Public()
  @Get('j17-cuota-04')
  async listarCuota04(@Req() req: ReqOrg) {
    return this.service.listar(requireOrg(req), 'J17_CUOTA_04');
  }

  @Public()
  @Get('j17-cuota-04/vigente')
  async vigenteCuota04(@Req() req: ReqOrg) {
    return this.service.getVigente(requireOrg(req), new Date(), 'J17_CUOTA_04');
  }

  @Public()
  @Post('j17-cuota-04')
  async crearCuota04(
    @Req() req: ReqOrg,
    @Body() dto: CrearParametroDto,
    @CurrentUser() user?: Usuario,
  ) {
    return this.service.crear(
      requireOrg(req),
      'J17_CUOTA_04',
      dto.valor,
      new Date(dto.vigenteDesde),
      user?.id?.toString(),
    );
  }

  @Public()
  @Delete('j17-cuota-04/ultima')
  async eliminarUltimaCuota04(@Req() req: ReqOrg) {
    return this.service.eliminarUltima(requireOrg(req), 'J17_CUOTA_04');
  }
}

@Controller('afiliados/:afiliadoId/cobertura')
export class CoberturaController {
  constructor(private readonly service: CoberturaService) {}

  @Public()
  @Get('historial')
  async historial(
    @Req() req: ReqOrg,
    @Param('afiliadoId', ParseIntPipe) afiliadoId: number,
    @Query('limit') limit?: string,
  ) {
    return this.service.historial(requireOrg(req), BigInt(afiliadoId), limit ? Number(limit) : 6);
  }

  @Public()
  @Get(':periodo')
  async obtener(
    @Req() req: ReqOrg,
    @Param('afiliadoId', ParseIntPipe) afiliadoId: number,
    @Param('periodo') periodo: string,
  ) {
    return this.service.obtener(requireOrg(req), BigInt(afiliadoId), periodo);
  }

  @Public()
  @Post('recalcular')
  async recalcular(
    @Req() req: ReqOrg,
    @Param('afiliadoId', ParseIntPipe) afiliadoId: number,
    @Body() dto: CalcularCoberturaDto,
  ) {
    return this.service.calcular(requireOrg(req), BigInt(afiliadoId), dto.periodo);
  }
}

@Controller('afiliados/:afiliadoId/suspension')
export class SuspensionesController {
  constructor(
    private readonly service: SuspensionesService,
    private readonly excepciones: ExcepcionesService,
  ) {}

  @Public()
  @Get()
  async historial(
    @Req() req: ReqOrg,
    @Param('afiliadoId', ParseIntPipe) afiliadoId: number,
  ) {
    return this.service.historial(requireOrg(req), BigInt(afiliadoId));
  }

  @Public()
  @Post('suspender')
  async suspender(
    @Req() req: ReqOrg,
    @Param('afiliadoId', ParseIntPipe) afiliadoId: number,
    @Body() dto: SuspenderManualDto,
    @CurrentUser() user?: Usuario,
  ) {
    return this.service.suspender(
      requireOrg(req),
      BigInt(afiliadoId),
      dto.periodoOrigen,
      { usuarioId: user?.id?.toString(), observacion: dto.observacion },
    );
  }

  @Public()
  @Post('rehabilitar')
  async rehabilitar(
    @Req() req: ReqOrg,
    @Param('afiliadoId', ParseIntPipe) afiliadoId: number,
    @Body() dto: RehabilitarDto,
    @CurrentUser() user?: Usuario,
  ) {
    return this.service.rehabilitar(
      requireOrg(req),
      BigInt(afiliadoId),
      dto.motivo ?? 'manual',
      { usuarioId: user?.id?.toString() },
    );
  }

  @Public()
  @Post('revertir')
  async revertir(
    @Req() req: ReqOrg,
    @Param('afiliadoId', ParseIntPipe) afiliadoId: number,
    @Body() dto: RevertirSuspensionDto,
    @CurrentUser() user?: Usuario,
  ) {
    return this.service.revertir(
      requireOrg(req),
      BigInt(afiliadoId),
      dto.motivo,
      user?.id?.toString(),
    );
  }
}

@Controller('afiliados/:afiliadoId/excepciones-suspension')
export class ExcepcionesController {
  constructor(private readonly service: ExcepcionesService) {}

  @Public()
  @Get()
  async listar(
    @Req() req: ReqOrg,
    @Param('afiliadoId', ParseIntPipe) afiliadoId: number,
  ) {
    return this.service.listarPorAfiliado(requireOrg(req), BigInt(afiliadoId));
  }

  @Public()
  @Post()
  async crear(
    @Req() req: ReqOrg,
    @Param('afiliadoId', ParseIntPipe) afiliadoId: number,
    @Body() dto: CrearExcepcionDto,
    @CurrentUser() user?: Usuario,
  ) {
    const usuarioCtx = {
      id: user?.id?.toString() ?? '',
      roles: (user as any)?.roles ?? [],
    };
    return this.service.crear(
      requireOrg(req),
      BigInt(afiliadoId),
      dto.motivo,
      dto.vigenciaHasta ? new Date(dto.vigenciaHasta) : null,
      usuarioCtx,
    );
  }

  @Public()
  @Delete(':id')
  async desactivar(
    @Req() req: ReqOrg,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user?: Usuario,
  ) {
    const usuarioCtx = {
      id: user?.id?.toString() ?? '',
      roles: (user as any)?.roles ?? [],
    };
    return this.service.desactivar(requireOrg(req), BigInt(id), usuarioCtx);
  }
}

@Controller('cierre-mensual')
export class CierreMensualController {
  constructor(
    private readonly service: CierreMensualService,
    private readonly suspensiones: SuspensionesService,
  ) {}

  @Public()
  @Get()
  async listar(@Req() req: ReqOrg, @Query('limit') limit?: string) {
    return this.service.listar(requireOrg(req), limit ? Number(limit) : 12);
  }

  @Public()
  @Get('periodo-sugerido')
  async periodoSugerido() {
    return { periodo: CierreMensualService.periodoCierreActual() };
  }

  @Public()
  @Get(':id')
  async detalle(@Req() req: ReqOrg, @Param('id', ParseIntPipe) id: number) {
    return this.service.detalle(requireOrg(req), BigInt(id));
  }

  @Public()
  @Post('ejecutar')
  async ejecutar(
    @Req() req: ReqOrg,
    @Body() dto: CierreMensualDto,
    @CurrentUser() user?: Usuario,
  ) {
    return this.service.ejecutar({
      organizacionId: requireOrg(req),
      periodo: dto.periodo,
      dryRun: !!dto.dryRun,
      usuarioId: user?.id?.toString(),
    });
  }

  @Public()
  @Post('convertir-firmes')
  async convertirFirmes(@Req() req: ReqOrg) {
    return this.suspensiones.convertirProvisoriasAFirmes(requireOrg(req));
  }
}

@Controller('excepciones-suspension')
export class ExcepcionesGlobalController {
  constructor(private readonly service: ExcepcionesService) {}

  @Public()
  @Get('activas')
  async listarActivas(@Req() req: ReqOrg) {
    return this.service.listarActivas(requireOrg(req));
  }
}

@Controller('obligaciones-mensuales')
export class ObligacionesMensualesController {
  constructor(private readonly service: ObligacionesMensualesService) {}

  @Public()
  @Post('materializar')
  async materializar(
    @Req() req: ReqOrg,
    @Body() dto: MaterializarMensualDto,
    @CurrentUser() user?: Usuario,
  ) {
    return this.service.materializarExAnte({
      organizacionId: requireOrg(req),
      periodo: dto.periodo,
      dryRun: !!dto.dryRun,
      usuarioId: user?.id?.toString(),
    });
  }
}
