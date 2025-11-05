import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class BigIntParamPipe implements PipeTransform<string, bigint> {
  transform(value: string): bigint {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException('Id inválido: debe ser numérico');
    }
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException('Id inválido');
    }
  }
}
