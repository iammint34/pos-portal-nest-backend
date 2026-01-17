import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RbacService } from './rbac.service';
import { CreateRoleDto, UpdateRoleDto } from './dto';
import {
  Permissions,
  CurrentUser,
  CurrentUserData,
} from '../common/decorators';

@ApiTags('rbac')
@Controller('rbac')
@ApiBearerAuth('JWT-auth')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  // ========== Permissions ==========

  @Get('permissions')
  @Permissions('role.read')
  @ApiOperation({ summary: 'Get all available permissions' })
  getAllPermissions() {
    return this.rbacService.getAllPermissions();
  }

  @Get('permissions/grouped')
  @Permissions('role.read')
  @ApiOperation({ summary: 'Get permissions grouped by module' })
  getPermissionsByModule() {
    return this.rbacService.getPermissionsByModule();
  }

  // ========== Roles ==========

  @Post('roles')
  @Permissions('role.create')
  @ApiOperation({ summary: 'Create a new role' })
  createRole(
    @Body() createRoleDto: CreateRoleDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const storeId = user?.storeId || createRoleDto.storeId;
    if (!storeId) {
      throw new BadRequestException('Store ID is required');
    }
    return this.rbacService.createRole(
      storeId,
      createRoleDto,
      user.userId,
    );
  }

  @Get('roles')
  @Permissions('role.read')
  @ApiOperation({ summary: 'Get all roles. If user has storeId, filters by store. Owners can see all or filter by storeId query param.' })
  @ApiQuery({ name: 'storeId', required: false, description: 'Filter by store ID (owners only)' })
  getRoles(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
  ) {
    const effectiveStoreId = user?.storeId || storeId;
    return this.rbacService.getRolesByStore(effectiveStoreId);
  }

  @Get('roles/:id')
  @Permissions('role.read')
  @ApiOperation({ summary: 'Get role by ID' })
  getRoleById(@Param('id') id: string) {
    return this.rbacService.getRoleById(id);
  }

  @Patch('roles/:id')
  @Permissions('role.update')
  @ApiOperation({ summary: 'Update role' })
  updateRole(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.rbacService.updateRole(
      id,
      updateRoleDto,
      user.userId,
      user?.storeId,
    );
  }

  @Delete('roles/:id')
  @Permissions('role.delete')
  @ApiOperation({ summary: 'Delete role' })
  deleteRole(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.rbacService.deleteRole(id, user.userId, user?.storeId);
  }

  // ========== User Permissions Check ==========

  @Get('my-permissions')
  @ApiOperation({ summary: 'Get current user permissions' })
  getMyPermissions(@CurrentUser() user: CurrentUserData) {
    return {
      permissions: user.permissions,
      storeId: user?.storeId,
      roleId: user.roleId,
    };
  }
}
