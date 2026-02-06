import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

export const POS_DEVICE_KEY = 'isPosDevice';

/**
 * Marks an endpoint as requiring POS device authentication
 * instead of regular user authentication
 */
export const PosDevice = () => SetMetadata(POS_DEVICE_KEY, true);

/**
 * Extracts the current POS device from the request
 * Use in conjunction with @PosDevice() decorator
 */
export const CurrentPosDevice = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.posDevice;
  },
);
