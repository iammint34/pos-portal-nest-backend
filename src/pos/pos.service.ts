import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import {
  RegisterPosDto,
  UpdatePosDto,
  CreatePosDeviceDto,
  RegisterWithCodeDto,
} from './dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PosService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  /**
   * Generate a random registration code in format XXXX-XXXX
   */
  private generateRegistrationCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes confusing chars like 0/O, 1/I
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  }

  /**
   * Create a new POS device with a registration code (called from Portal)
   */
  async createDevice(createDto: CreatePosDeviceDto, createdBy?: string) {
    // Verify branch exists
    const branch = await this.prisma.branch.findFirst({
      where: { id: createDto.branchId, deletedAt: null },
      include: { store: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Generate unique registration code
    let registrationCode: string;
    let isUnique = false;
    while (!isUnique) {
      registrationCode = this.generateRegistrationCode();
      const existing = await this.prisma.posDevice.findUnique({
        where: { registrationCode },
      });
      if (!existing) isUnique = true;
    }

    // Code expires in 24 hours
    const registrationCodeExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );

    const posDevice = await this.prisma.posDevice.create({
      data: {
        branchId: createDto.branchId,
        name: createDto.name,
        registrationCode,
        registrationCodeExpiresAt,
        isRegistered: false,
        // BIR Compliance Fields
        min: createDto.min,
        serialNumber: createDto.serialNumber,
        permitNumber: createDto.permitNumber,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            store: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    await this.auditService.log({
      userId: createdBy,
      storeId: branch.storeId,
      action: 'CREATE',
      entityType: 'PosDevice',
      entityId: posDevice.id,
      newValue: { name: createDto.name, registrationCode },
    });

    return {
      ...posDevice,
      registrationCode, // Include the code in the response
    };
  }

  /**
   * Register a POS device using registration code (called from POS device)
   */
  async registerWithCode(registerDto: RegisterWithCodeDto) {
    const posDevice = await this.prisma.posDevice.findUnique({
      where: { registrationCode: registerDto.registrationCode },
      include: {
        branch: {
          include: { store: true },
        },
      },
    });

    if (!posDevice) {
      throw new BadRequestException('Invalid registration code');
    }

    if (posDevice.deletedAt) {
      throw new BadRequestException('Device has been deleted');
    }

    if (posDevice.isRegistered) {
      throw new ConflictException('Device has already been registered');
    }

    if (
      posDevice.registrationCodeExpiresAt &&
      new Date() > posDevice.registrationCodeExpiresAt
    ) {
      throw new BadRequestException('Registration code has expired');
    }

    // Check if device identifier already exists
    if (registerDto.deviceIdentifier) {
      const existingDevice = await this.prisma.posDevice.findUnique({
        where: { deviceIdentifier: registerDto.deviceIdentifier },
      });
      if (existingDevice && existingDevice.id !== posDevice.id) {
        throw new ConflictException(
          'Device identifier already registered to another device',
        );
      }
    }

    // Generate device token
    const deviceToken = uuidv4();
    const tokenHash = await bcrypt.hash(deviceToken, 10);
    const expirationDays = parseInt(
      this.configService.get('DEVICE_TOKEN_EXPIRATION', '30d').replace('d', ''),
    );
    const tokenExpiresAt = new Date(
      Date.now() + expirationDays * 24 * 60 * 60 * 1000,
    );

    // Update device with registration info
    const updatedDevice = await this.prisma.posDevice.update({
      where: { id: posDevice.id },
      data: {
        deviceIdentifier: registerDto.deviceIdentifier,
        name: registerDto.deviceName || posDevice.name,
        isRegistered: true,
        registeredAt: new Date(),
        registrationCode: null, // Clear the code after registration
        registrationCodeExpiresAt: null,
        tokenHash,
        tokenExpiresAt,
        status: 'ONLINE',
        lastHeartbeatAt: new Date(),
      },
      include: {
        branch: {
          include: { store: true },
        },
      },
    });

    await this.auditService.log({
      storeId: posDevice.branch.storeId,
      action: 'REGISTER',
      entityType: 'PosDevice',
      entityId: posDevice.id,
      newValue: { deviceIdentifier: registerDto.deviceIdentifier },
    });

    return {
      deviceToken,
      tokenExpiresAt,
      storeId: updatedDevice.branch.storeId,
      storeName: updatedDevice.branch.store.name,
      branchId: updatedDevice.branchId,
      branchName: updatedDevice.branch.name,
      deviceId: updatedDevice.id,
      deviceName: updatedDevice.name,
    };
  }

  /**
   * Regenerate registration code for an unregistered device
   */
  async regenerateCode(id: string, storeId?: string, regeneratedBy?: string) {
    const posDevice = await this.findOne(id, storeId);

    if (posDevice.isRegistered) {
      throw new BadRequestException(
        'Cannot regenerate code for a registered device',
      );
    }

    const registrationCode = this.generateRegistrationCode();
    const registrationCodeExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );

    const updatedDevice = await this.prisma.posDevice.update({
      where: { id },
      data: {
        registrationCode,
        registrationCodeExpiresAt,
      },
    });

    await this.auditService.log({
      userId: regeneratedBy,
      storeId: posDevice.branch.store.id,
      action: 'UPDATE',
      entityType: 'PosDevice',
      entityId: id,
      newValue: { registrationCode },
    });

    return {
      ...updatedDevice,
      registrationCode,
    };
  }

  async register(registerPosDto: RegisterPosDto, registeredBy?: string) {
    // Check if device identifier already exists
    const existingDevice = await this.prisma.posDevice.findUnique({
      where: { deviceIdentifier: registerPosDto.deviceIdentifier },
    });

    if (existingDevice) {
      throw new ConflictException('Device identifier already registered');
    }

    // Verify branch exists
    const branch = await this.prisma.branch.findFirst({
      where: { id: registerPosDto.branchId, deletedAt: null },
      include: { store: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const posDevice = await this.prisma.posDevice.create({
      data: {
        branchId: registerPosDto.branchId,
        deviceIdentifier: registerPosDto.deviceIdentifier,
        name: registerPosDto.name,
        appVersion: registerPosDto.appVersion,
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            store: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    await this.auditService.log({
      userId: registeredBy,
      storeId: branch.storeId,
      action: 'CREATE',
      entityType: 'PosDevice',
      entityId: posDevice.id,
      newValue: { deviceIdentifier: registerPosDto.deviceIdentifier },
    });

    return posDevice;
  }

  async authenticate(deviceIdentifier: string) {
    const posDevice = await this.prisma.posDevice.findFirst({
      where: {
        deviceIdentifier,
        deletedAt: null,
      },
      include: {
        branch: {
          include: {
            store: true,
          },
        },
      },
    });

    if (!posDevice) {
      throw new UnauthorizedException('Device not registered');
    }

    // Generate device token
    const deviceToken = uuidv4();
    const tokenHash = await bcrypt.hash(deviceToken, 10);

    const expirationDays = parseInt(
      this.configService.get('DEVICE_TOKEN_EXPIRATION', '30d').replace('d', ''),
    );
    const tokenExpiresAt = new Date(
      Date.now() + expirationDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.posDevice.update({
      where: { id: posDevice.id },
      data: {
        tokenHash,
        tokenExpiresAt,
        status: 'ONLINE',
        lastHeartbeatAt: new Date(),
      },
    });

    await this.auditService.log({
      storeId: posDevice.branch.storeId,
      action: 'LOGIN',
      entityType: 'PosDevice',
      entityId: posDevice.id,
    });

    return {
      deviceToken,
      expiresAt: tokenExpiresAt,
      posDevice: {
        id: posDevice.id,
        branchId: posDevice.branchId,
        name: posDevice.name || posDevice.deviceIdentifier,
        storeId: posDevice.branch.storeId,
      },
    };
  }

  async validateDeviceToken(
    deviceIdentifier: string,
    deviceToken: string,
  ): Promise<boolean> {
    const posDevice = await this.prisma.posDevice.findFirst({
      where: {
        deviceIdentifier,
        deletedAt: null,
      },
    });

    if (!posDevice || !posDevice.tokenHash) {
      return false;
    }

    if (posDevice.tokenExpiresAt && new Date() > posDevice.tokenExpiresAt) {
      return false;
    }

    return bcrypt.compare(deviceToken, posDevice.tokenHash);
  }

  async findAll(
    storeId?: string,
    options: {
      branchId?: string;
      status?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { branchId, status, page = 1, limit = 20 } = options;

    const where = {
      deletedAt: null,
      branch: {
        deletedAt: null,
        ...(storeId && { storeId }),
      },
      ...(branchId && { branchId }),
      ...(status && { status: status as 'ONLINE' | 'OFFLINE' | 'INACTIVE' }),
    };

    const [devices, total] = await Promise.all([
      this.prisma.posDevice.findMany({
        where,
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              store: {
                select: { id: true, name: true },
              },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.posDevice.count({ where }),
    ]);

    return {
      data: devices,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, storeId?: string) {
    const posDevice = await this.prisma.posDevice.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(storeId && {
          branch: { storeId },
        }),
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            store: {
              select: { id: true, name: true },
            },
          },
        },
        syncLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!posDevice) {
      throw new NotFoundException('POS device not found');
    }

    return posDevice;
  }

  async update(
    id: string,
    updatePosDto: UpdatePosDto,
    storeId?: string,
    updatedBy?: string,
  ) {
    const posDevice = await this.findOne(id, storeId);

    const updatedDevice = await this.prisma.posDevice.update({
      where: { id },
      data: updatePosDto,
      include: {
        branch: {
          select: { id: true, name: true },
        },
      },
    });

    await this.auditService.log({
      userId: updatedBy,
      storeId: posDevice.branch.store.id,
      action: 'UPDATE',
      entityType: 'PosDevice',
      entityId: id,
      oldValue: { name: posDevice.name },
      newValue: updatePosDto,
    });

    return updatedDevice;
  }

  async remove(id: string, storeId?: string, deletedBy?: string) {
    const posDevice = await this.findOne(id, storeId);

    await this.prisma.posDevice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId: deletedBy,
      storeId: posDevice.branch.store.id,
      action: 'DELETE',
      entityType: 'PosDevice',
      entityId: id,
    });

    return { message: 'POS device deleted successfully' };
  }

  async deactivate(id: string, storeId?: string) {
    await this.findOne(id, storeId);

    return this.prisma.posDevice.update({
      where: { id },
      data: {
        status: 'INACTIVE',
        tokenHash: null,
        tokenExpiresAt: null,
      },
    });
  }

  async getDeviceStats(storeId?: string) {
    const branchFilter = storeId ? { branch: { storeId } } : {};

    const [total, online, offline, inactive] = await Promise.all([
      this.prisma.posDevice.count({
        where: { ...branchFilter, deletedAt: null },
      }),
      this.prisma.posDevice.count({
        where: { ...branchFilter, deletedAt: null, status: 'ONLINE' },
      }),
      this.prisma.posDevice.count({
        where: { ...branchFilter, deletedAt: null, status: 'OFFLINE' },
      }),
      this.prisma.posDevice.count({
        where: { ...branchFilter, deletedAt: null, status: 'INACTIVE' },
      }),
    ]);

    return { total, online, offline, inactive };
  }
}
