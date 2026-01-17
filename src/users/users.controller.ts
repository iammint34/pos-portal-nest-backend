import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import {
  Permissions,
  CurrentUser,
  CurrentUserData,
} from '../common/decorators';

@ApiTags('users')
@Controller('users')
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('user.create')
  @ApiOperation({ summary: 'Create a new user' })
  create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    // If storeId not provided, use current user's store
    if (!createUserDto.storeId && user?.storeId) {
      createUserDto.storeId = user?.storeId;
    }
    return this.usersService.create(createUserDto, user.userId);
  }

  @Get()
  @Permissions('user.read')
  @ApiOperation({ summary: 'Get all users. Excludes current logged-in user. Owners can see all or filter by storeId.' })
  @ApiQuery({ name: 'storeId', required: false, description: 'Filter by store ID (owners only)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const effectiveStoreId = user?.storeId || storeId;
    return this.usersService.findAll(effectiveStoreId, page, limit, user.userId);
  }

  @Get(':id')
  @Permissions('user.read')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.usersService.findOne(id, user?.storeId);
  }

  @Patch(':id')
  @Permissions('user.update')
  @ApiOperation({ summary: 'Update user' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.usersService.update(
      id,
      updateUserDto,
      user.userId,
      user?.storeId,
    );
  }

  @Delete(':id')
  @Permissions('user.delete')
  @ApiOperation({ summary: 'Delete user' })
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.usersService.remove(id, user.userId, user?.storeId);
  }

  @Post(':id/assign-store')
  @Permissions('user.manage')
  @ApiOperation({ summary: 'Assign user to a store with role' })
  assignToStore(
    @Param('id') userId: string,
    @Body() body: { storeId: string; roleId: string },
  ) {
    return this.usersService.assignToStore(userId, body.storeId, body.roleId);
  }

  @Delete(':id/stores/:storeId')
  @Permissions('user.manage')
  @ApiOperation({ summary: 'Remove user from store' })
  removeFromStore(
    @Param('id') userId: string,
    @Param('storeId') storeId: string,
  ) {
    return this.usersService.removeFromStore(userId, storeId);
  }
}
