import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { POS_DEVICE_KEY } from '../../common/decorators/pos-device.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Skip JWT auth for POS device endpoints (handled by PosDeviceGuard)
    const isPosDevice = this.reflector.getAllAndOverride<boolean>(POS_DEVICE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPosDevice) {
      return true;
    }

    return super.canActivate(context);
  }
}
