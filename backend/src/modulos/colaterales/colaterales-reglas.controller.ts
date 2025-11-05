import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ColateralesReglasService } from './colaterales-reglas.service';
import { CreateReglaColateralDto, UpdateReglaColateralDto, ToggleDto } from './dtos';

function requireOrg(headers: Record<string, any>): string {
  const h = Object.fromEntries(Object.entries(headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const id = (h['x-organizacion-id'] as string) || (h['x-org-id'] as string);
  if (!id || !id.trim()) throw new BadRequestException('X-Organizacion-ID requerido');
  return id;
}

@Controller('colaterales/reglas')
export class ColateralesReglasController {
  constructor(private readonly service: ColateralesReglasService) {}

  @Get()
  list(
    @Headers() headers: Record<string, any>,
    @Query('activo') activo?: string,
    @Query('parentescoId') parentescoId?: string,
  ): Promise<unknown[]> {
    const organizacionId = requireOrg(headers);
    return this.service.list(organizacionId, {
      activo: typeof activo === 'string' ? activo !== 'false' : undefined,
      parentescoId: parentescoId ? BigInt(parentescoId) : undefined,
    });
  }

  @Post()
  create(
    @Headers() headers: Record<string, any>,
    @Body() dto: CreateReglaColateralDto,
  ): Promise<{ id: string }> {
    const organizacionId = requireOrg(headers);
    return this.service.create(organizacionId, dto);
  }

  @Get(':id')
  get(@Headers() headers: Record<string, any>, @Param('id') id: string): Promise<unknown> {
    const organizacionId = requireOrg(headers);
    return this.service.get(organizacionId, id);
  }

  @Patch(':id')
  update(
    @Headers() headers: Record<string, any>,
    @Param('id') id: string,
    @Body() dto: UpdateReglaColateralDto,
  ): Promise<{ ok: true }> {
    const organizacionId = requireOrg(headers);
    return this.service.update(organizacionId, id, dto);
  }

  @Patch(':id/estado')
  toggle(
    @Headers() headers: Record<string, any>,
    @Param('id') id: string,
    @Body() body: ToggleDto,
  ): Promise<{ id: bigint; activo: boolean }> {
    const organizacionId = requireOrg(headers);
    return this.service.toggle(organizacionId, id, body.activo) as Promise<{
      id: bigint;
      activo: boolean;
    }>;
  }

  @Delete(':id')
  remove(@Headers() headers: Record<string, any>, @Param('id') id: string): Promise<{ ok: true }> {
    const organizacionId = requireOrg(headers);
    return this.service.remove(organizacionId, id);
  }
}
