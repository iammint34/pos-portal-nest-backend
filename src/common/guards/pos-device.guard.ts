import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { POS_DEVICE_KEY } from '../decorators/pos-device.decorator';

@Injectable()
export class PosDeviceGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPosDevice = this.reflector.getAllAndOverride<boolean>(
      POS_DEVICE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If not marked as POS device endpoint, skip this guard
    if (!isPosDevice) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    // Expect format: "PosDevice <deviceIdentifier>:<deviceToken>"
    const [type, credentials] = authHeader.split(' ');

    if (type !== 'PosDevice' || !credentials) {
      throw new UnauthorizedException(
        'Invalid authorization format. Expected: PosDevice <deviceIdentifier>:<deviceToken>',
      );
    }

    const [deviceIdentifier, deviceToken] = credentials.split(':');

    if (!deviceIdentifier || !deviceToken) {
      throw new UnauthorizedException(
        'Invalid credentials format. Expected: <deviceIdentifier>:<deviceToken>',
      );
    }

    // Validate device and token
    const posDevice = await this.prisma.posDevice.findFirst({
      where: {
        deviceIdentifier,
        deletedAt: null,
      },
      include: {
        branch: {
          select: {
            id: true,
            storeId: true,
          },
        },
      },
    });

    if (!posDevice) {
      throw new UnauthorizedException('Device not found');
    }

    if (!posDevice.tokenHash) {
      throw new UnauthorizedException(
        'Device not authenticated. Please authenticate first.',
      );
    }

    if (posDevice.tokenExpiresAt && new Date() > posDevice.tokenExpiresAt) {
      throw new UnauthorizedException(
        'Device token expired. Please re-authenticate.',
      );
    }

    const isValidToken = await bcrypt.compare(deviceToken, posDevice.tokenHash);

    if (!isValidToken) {
      throw new UnauthorizedException('Invalid device token');
    }

    // Update last heartbeat
    await this.prisma.posDevice.update({
      where: { id: posDevice.id },
      data: {
        lastHeartbeatAt: new Date(),
        status: 'ONLINE',
      },
    });

    // Attach device info to request for use in controllers
    request.posDevice = {
      id: posDevice.id,
      deviceIdentifier: posDevice.deviceIdentifier,
      branchId: posDevice.branch.id,
      storeId: posDevice.branch.storeId,
    };

    return true;
  }
}
