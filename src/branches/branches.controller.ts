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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto } from './dto';
import {
  Permissions,
  CurrentUser,
  CurrentUserData,
} from '../common/decorators';

@ApiTags('branches')
@Controller('branches')
@ApiBearerAuth('JWT-auth')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @Permissions('branch.create')
  @ApiOperation({ summary: 'Create a new branch' })
  create(
    @Body() createBranchDto: CreateBranchDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    // Use user's storeId if available, otherwise use the one from DTO (for owners)
    const storeId = createBranchDto?.storeId || user?.storeId;
    if (!storeId) {
      throw new BadRequestException('Store ID is required');
    }
    return this.branchesService.create(storeId, createBranchDto, user.userId);
  }

  @Get()
  @Permissions('branch.read')
  @ApiOperation({
    summary:
      'Get all branches. If user has storeId, filters by store. Owners can see all or filter by storeId query param.',
  })
  @ApiQuery({
    name: 'storeId',
    required: false,
    description: 'Filter by store ID (owners only)',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query('storeId') storeId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    // If user has a storeId, use it (they can only see their store)
    // If user doesn't have storeId (owner), use the query param or return all
    const effectiveStoreId = storeId || user?.storeId;
    return this.branchesService.findAll(effectiveStoreId, page, limit);
  }

  @Get(':id')
  @Permissions('branch.read')
  @ApiOperation({ summary: 'Get branch by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.branchesService.findOne(id, user?.storeId);
  }

  @Get(':id/stats')
  @Permissions('branch.read')
  @ApiOperation({ summary: 'Get branch statistics' })
  getStats(@Param('id') id: string) {
    return this.branchesService.getBranchStats(id);
  }

  @Patch(':id')
  @Permissions('branch.update')
  @ApiOperation({ summary: 'Update branch' })
  update(
    @Param('id') id: string,
    @Body() updateBranchDto: UpdateBranchDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.branchesService.update(
      id,
      updateBranchDto,
      user?.storeId,
      user.userId,
    );
  }

  @Delete(':id')
  @Permissions('branch.delete')
  @ApiOperation({ summary: 'Delete branch' })
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.branchesService.remove(id, user?.storeId, user.userId);
  }
}
