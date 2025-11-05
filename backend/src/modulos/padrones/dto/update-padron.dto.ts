import { PartialType } from '@nestjs/mapped-types';
import { CreatePadronDto } from './create-padron.dto';

/**
 * Update parcial de cualquier campo del padrón.
 * Considerá que si cambiás 'padron' respeta el unique por organización.
 */
export class UpdatePadronDto extends PartialType(CreatePadronDto) {}
