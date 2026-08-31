import { Module } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import * as authService from '../../auth_service';

@Injectable()
export class AuthService {
  generateChallenge = authService.generateChallenge;
  verifySignature = authService.verifySignature;
  issueJwt = authService.issueJwt;
  verifyJwt = authService.verifyJwt;
}

@Module({
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
