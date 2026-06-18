import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard para endpoints de la vista pública de farmacia externa.
 *
 * Uso típico (combinado con `@Public()` para que el JwtAuthGuard global
 * no intente validar el token como un usuario):
 *
 *   @Public()
 *   @UseGuards(FarmaciaJwtGuard)
 *   @Get('mis-consumos')
 *   ...
 */
@Injectable()
export class FarmaciaJwtGuard extends AuthGuard('farmacia-jwt') {}
