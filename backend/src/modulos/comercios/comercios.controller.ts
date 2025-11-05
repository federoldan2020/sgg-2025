import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ComerciosService } from './comercios.service';
import { CreateComercioDto, UpdateComercioDto } from './dto';
import { Comercio, Prisma } from '@prisma/client';
import { OrgId } from '../../common/decorators/org-id.decorator'; // <-- decorador correcto

@Controller('comercios')
export class ComerciosController {
  constructor(private readonly svc: ComerciosService) {}

  @Get()
  async search(@OrgId() organizacionId: string, @Query('q') q = ''): Promise<Comercio[]> {
    return await this.svc.search(organizacionId, q);
  }

  @Get(':id')
  async get(@OrgId() organizacionId: string, @Param('id') id: string): Promise<Comercio> {
    return await this.svc.get(BigInt(id), organizacionId);
  }

  @Post()
  async create(@OrgId() organizacionId: string, @Body() dto: CreateComercioDto): Promise<Comercio> {
    const data: Prisma.ComercioCreateInput = { ...dto, organizacionId };
    return await this.svc.create(data);
  }

  @Put(':id')
  async update(
    @OrgId() organizacionId: string,
    @Param('id') id: string,
    @Body() dto: UpdateComercioDto,
  ): Promise<Comercio> {
    const data: Prisma.ComercioUpdateInput = { ...dto };
    return await this.svc.update(BigInt(id), organizacionId, data);
  }

  @Post(':id/soft-delete')
  async softDelete(@OrgId() organizacionId: string, @Param('id') id: string): Promise<Comercio> {
    return await this.svc.softDelete(BigInt(id), organizacionId);
  }
}
