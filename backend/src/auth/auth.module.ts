import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { jwtSecret } from './jwt-secret';
import { LoginThrottleGuard } from './login-throttle.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: jwtSecret(),
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [AuthController],
  // O LoginThrottleGuard guarda a contagem de tentativas dentro dele, entao
  // esta na lista para ficar explicito que e uma instancia unica do modulo -
  // se um dia virasse escopo de requisicao, a contagem zeraria a cada login e
  // o freio deixaria de existir sem ninguem notar.
  providers: [AuthService, JwtStrategy, LoginThrottleGuard],
})
export class AuthModule {}
