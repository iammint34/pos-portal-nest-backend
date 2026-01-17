import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(createUserDto: CreateUserDto, createdBy?: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        passwordHash,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
      },
    });

    // If storeId and roleId provided, create store user association
    if (createUserDto.storeId && createUserDto.roleId) {
      await this.prisma.storeUser.create({
        data: {
          userId: user.id,
          storeId: createUserDto.storeId,
          roleId: createUserDto.roleId,
        },
      });
    }

    await this.auditService.log({
      userId: createdBy,
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      newValue: { email: user.email, firstName: user.firstName, lastName: user.lastName },
    });

    return user;
  }

  async findAll(storeId?: string, page = 1, limit = 20, excludeUserId?: string) {
    const where = {
      deletedAt: null,
      ...(excludeUserId && { id: { not: excludeUserId } }),
      ...(storeId && {
        storeUsers: {
          some: {
            storeId,
            deletedAt: null,
          },
        },
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
          storeUsers: {
            where: { deletedAt: null },
            select: {
              id: true,
              storeId: true,
              roleId: true,
              store: {
                select: {
                  id: true,
                  name: true,
                },
              },
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, storeId?: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(storeId && {
          storeUsers: {
            some: { storeId, deletedAt: null },
          },
        }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        storeUsers: {
          where: { deletedAt: null },
          select: {
            storeId: true,
            store: {
              select: {
                id: true,
                name: true,
              },
            },
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    updatedBy?: string,
    storeId?: string,
  ) {
    const user = await this.findOne(id, storeId);

    const updateData: Record<string, unknown> = {};

    if (updateUserDto.firstName) updateData.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName) updateData.lastName = updateUserDto.lastName;
    if (updateUserDto.isActive !== undefined)
      updateData.isActive = updateUserDto.isActive;
    if (updateUserDto.password) {
      updateData.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isActive: true,
        updatedAt: true,
      },
    });

    await this.auditService.log({
      userId: updatedBy,
      storeId,
      action: 'UPDATE',
      entityType: 'User',
      entityId: id,
      oldValue: { firstName: user.firstName, lastName: user.lastName },
      newValue: updateUserDto,
    });

    return updatedUser;
  }

  async remove(id: string, deletedBy?: string, storeId?: string) {
    await this.findOne(id, storeId);

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId: deletedBy,
      storeId,
      action: 'DELETE',
      entityType: 'User',
      entityId: id,
    });

    return { message: 'User deleted successfully' };
  }

  async assignToStore(userId: string, storeId: string, roleId: string) {
    const existingAssignment = await this.prisma.storeUser.findUnique({
      where: { userId_storeId: { userId, storeId } },
    });

    if (existingAssignment) {
      return this.prisma.storeUser.update({
        where: { id: existingAssignment.id },
        data: { roleId, isActive: true, deletedAt: null },
      });
    }

    return this.prisma.storeUser.create({
      data: { userId, storeId, roleId },
    });
  }

  async removeFromStore(userId: string, storeId: string) {
    await this.prisma.storeUser.updateMany({
      where: { userId, storeId },
      data: { deletedAt: new Date() },
    });

    return { message: 'User removed from store successfully' };
  }
}
