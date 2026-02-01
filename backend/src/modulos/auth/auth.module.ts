import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { AuditoriaController } from './auditoria.controller';
import { TestAuthController } from './test-auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-key',
      signOptions: {
        expiresIn: '15m', // Access token corto
      },
    }),
  ],
  controllers: [AuthController, UsuariosController, AuditoriaController, TestAuthController],
  providers: [
    AuthService,
    UsuariosService,
    AuditService,
    JwtStrategy,
    JwtRefreshStrategy,
    PrismaService,
  ],
  exports: [AuthService, UsuariosService, AuditService],
})
export class AuthModule {}
