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
import { CoseguroReglasService } from './coseguro-reglas.service';
import { CreateReglaJ22Dto, UpdateReglaJ22Dto, ToggleDto } from './dtos';

function org(headers: Record<string, any>) {
  const h = Object.fromEntries(Object.entries(headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const id = (h['x-organizacion-id'] as string) || (h['x-org-id'] as string);
  if (!id || !id.trim()) throw new BadRequestException('X-Organizacion-ID requerido');
  return id;
}

@Controller('coseguro/reglas')
export class CoseguroReglasController {
  constructor(private readonly service: CoseguroReglasService) {}

  @Get()
  async list(@Headers() headers: Record<string, any>, @Query('activo') activo?: string) {
    const organizacionId = org(headers);
    return this.service.list(organizacionId, {
      activo: typeof activo === 'string' ? activo !== 'false' : undefined,
    });
  }

  @Post()
  async create(@Headers() headers: Record<string, any>, @Body() dto: CreateReglaJ22Dto) {
    const organizacionId = org(headers);
    return this.service.create(organizacionId, dto);
  }

  @Get(':id')
  async get(@Headers() headers: Record<string, any>, @Param('id') id: string) {
    const organizacionId = org(headers);
    return this.service.get(organizacionId, id);
  }

  @Patch(':id')
  async update(
    @Headers() headers: Record<string, any>,
    @Param('id') id: string,
    @Body() dto: UpdateReglaJ22Dto,
  ) {
    const organizacionId = org(headers);
    return this.service.update(organizacionId, id, dto);
  }

  @Patch(':id/estado')
  async toggle(
    @Headers() headers: Record<string, any>,
    @Param('id') id: string,
    @Body() body: ToggleDto,
  ) {
    const organizacionId = org(headers);
    return this.service.toggle(organizacionId, id, body.activo);
  }

  @Delete(':id')
  async remove(@Headers() headers: Record<string, any>, @Param('id') id: string) {
    const organizacionId = org(headers);
    return this.service.remove(organizacionId, id);
  }
}
