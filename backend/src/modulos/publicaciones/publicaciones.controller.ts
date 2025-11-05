// src/modulos/publicaciones/publicaciones.controller.ts
import { Body, Controller, Delete, Get, Headers, Param, Post } from '@nestjs/common';
import { PublicacionesService } from './publicaciones.service';
import { CrearPublicacionDto, DraftColateralDto, PublicarDto } from './dtos';

/**
 * Exponemos ambos prefijos para compatibilidad:
 * - /colaterales/publicaciones/...
 * - /publicaciones/...
 */
@Controller(['colaterales/publicaciones', 'publicaciones'])
export class PublicacionesController {
  constructor(private readonly service: PublicacionesService) {}

  /** Crear publicación explícitamente (opcional si usás /abierta) */
  @Post()
  crear(@Headers() h: Record<string, any>, @Body() dto: CrearPublicacionDto) {
    return this.service.crearPublicacion(h, dto);
  }

  /** Obtener una publicación por id */
  @Get(':id')
  get(@Headers() h: Record<string, any>, @Param('id') id: string) {
    return this.service.getPublicacion(h, id);
  }

  /** Abrir o crear la publicación abierta (draft) */
  @Post('abierta')
  abrir(@Headers() h: Record<string, any>, @Body() dto: CrearPublicacionDto) {
    return this.service.abrirPublicacion(h, dto);
  }

  /** Consultar si hay publicación abierta (draft) */
  @Get('abierta')
  getAbierta(@Headers() h: Record<string, any>) {
    return this.service.getPublicacionAbierta(h);
  }

  /** Drafts (si los usás) */
  @Post(':id/drafts')
  agregarDraft(
    @Headers() h: Record<string, any>,
    @Param('id') id: string,
    @Body() body: DraftColateralDto,
  ) {
    return this.service.agregarDraftColateral(h, id, body);
  }

  @Delete(':id/drafts/:draftId')
  eliminarDraft(
    @Headers() h: Record<string, any>,
    @Param('id') id: string,
    @Param('draftId') draftId: string,
  ) {
    return this.service.eliminarDraft(h, id, draftId);
  }

  @Get(':id/dry-run')
  dryRun(@Headers() h: Record<string, any>, @Param('id') id: string) {
    return this.service.dryRun(h, id);
  }

  /** Publicar: encola recálculo; el worker marcará como 'publicada' */
  @Post(':id/publicar')
  publicar(@Headers() h: Record<string, any>, @Param('id') id: string, @Body() body: PublicarDto) {
    return this.service.publicar(h, id, body?.comentario);
  }

  /** Cancelar un borrador */
  @Post(':id/cancelar')
  cancelar(@Headers() h: Record<string, any>, @Param('id') id: string) {
    return this.service.cancelar(h, id);
  }
}
