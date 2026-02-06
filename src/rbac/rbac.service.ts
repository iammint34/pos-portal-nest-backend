import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class RbacService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // ========== Permissions ==========

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
  }

  async getPermissionsByModule() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });

    const grouped: Record<string, typeof permissions> = {};
    for (const permission of permissions) {
      if (!grouped[permission.module]) {
        grouped[permission.module] = [];
      }
      grouped[permission.module].push(permission);
    }

    // Return as array of { module, permissions } for frontend
    return Object.entries(grouped).map(([module, perms]) => ({
      module,
      permissions: perms,
    }));
  }

  // ========== Roles ==========

  async createRole(
    storeId: string,
    createRoleDto: CreateRoleDto,
    createdBy?: string,
  ) {
    // Check for duplicate role name in the same store
    const existingRole = await this.prisma.role.findUnique({
      where: { storeId_name: { storeId, name: createRoleDto.name } },
    });

    if (existingRole) {
      throw new ConflictException(
        'Role with this name already exists in store',
      );
    }

    const role = await this.prisma.role.create({
      data: {
        name: createRoleDto.name,
        description: createRoleDto.description,
        storeId,
      },
    });

    // Assign permissions if provided
    if (createRoleDto.permissions && createRoleDto.permissions.length > 0) {
      await this.assignPermissionsToRole(role.id, createRoleDto.permissions);
    }

    await this.auditService.log({
      userId: createdBy,
      storeId,
      action: 'CREATE',
      entityType: 'Role',
      entityId: role.id,
      newValue: createRoleDto,
    });

    return this.getRoleById(role.id);
  }

  async getRolesByStore(storeId?: string) {
    const roles = await this.prisma.role.findMany({
      where: {
        deletedAt: null,
        ...(storeId && { storeId }),
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            storeUsers: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transform to include permissions array for frontend
    return roles.map((role) => ({
      ...role,
      permissions: role.rolePermissions.map((rp) => rp.permission),
    }));
  }

  async getRoleById(roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, deletedAt: null },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      ...role,
      permissions: role.rolePermissions.map((rp) => rp.permission),
    };
  }

  async updateRole(
    roleId: string,
    updateRoleDto: UpdateRoleDto,
    updatedBy?: string,
    storeId?: string,
  ) {
    const role = await this.getRoleById(roleId);

    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be modified');
    }

    // Check for duplicate name if updating name
    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existingRole = await this.prisma.role.findUnique({
        where: {
          storeId_name: { storeId: role.storeId, name: updateRoleDto.name },
        },
      });

      if (existingRole) {
        throw new ConflictException(
          'Role with this name already exists in store',
        );
      }
    }

    await this.prisma.role.update({
      where: { id: roleId },
      data: {
        name: updateRoleDto.name,
        description: updateRoleDto.description,
      },
    });

    // Update permissions if provided
    if (updateRoleDto.permissions) {
      // Remove existing permissions
      await this.prisma.rolePermission.deleteMany({
        where: { roleId },
      });

      // Add new permissions
      if (updateRoleDto.permissions.length > 0) {
        await this.assignPermissionsToRole(roleId, updateRoleDto.permissions);
      }
    }

    await this.auditService.log({
      userId: updatedBy,
      storeId,
      action: 'UPDATE',
      entityType: 'Role',
      entityId: roleId,
      oldValue: { name: role.name, description: role.description },
      newValue: updateRoleDto,
    });

    return this.getRoleById(roleId);
  }

  async deleteRole(roleId: string, deletedBy?: string, storeId?: string) {
    const role = await this.getRoleById(roleId);

    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deleted');
    }

    // Check if role is in use
    const usersWithRole = await this.prisma.storeUser.count({
      where: { roleId, deletedAt: null },
    });

    if (usersWithRole > 0) {
      throw new BadRequestException(
        `Cannot delete role: ${usersWithRole} users are assigned to this role`,
      );
    }

    await this.prisma.role.update({
      where: { id: roleId },
      data: { deletedAt: new Date() },
    });

    await this.auditService.log({
      userId: deletedBy,
      storeId,
      action: 'DELETE',
      entityType: 'Role',
      entityId: roleId,
    });

    return { message: 'Role deleted successfully' };
  }

  private async assignPermissionsToRole(
    roleId: string,
    permissionCodes: string[],
  ) {
    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
    });

    if (permissions.length !== permissionCodes.length) {
      const foundCodes = permissions.map((p) => p.code);
      const notFoundCodes = permissionCodes.filter(
        (c) => !foundCodes.includes(c),
      );
      throw new BadRequestException(
        `Invalid permissions: ${notFoundCodes.join(', ')}`,
      );
    }

    await this.prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId,
        permissionId: permission.id,
      })),
    });
  }

  // ========== User Role Check ==========

  async getUserPermissions(userId: string, storeId: string): Promise<string[]> {
    const storeUser = await this.prisma.storeUser.findUnique({
      where: {
        userId_storeId: { userId, storeId },
        deletedAt: null,
        isActive: true,
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!storeUser) {
      return [];
    }

    return storeUser.role.rolePermissions.map((rp) => rp.permission.code);
  }

  async hasPermission(
    userId: string,
    storeId: string,
    permission: string,
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, storeId);
    return permissions.includes(permission);
  }
}
