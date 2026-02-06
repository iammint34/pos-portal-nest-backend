import { Module, Global } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import {
  FeatureFlagsController,
  FeatureFlagsAdminController,
} from './feature-flags.controller';

@Global() // Make this module global so FeatureFlagsService is available everywhere
@Module({
  controllers: [FeatureFlagsController, FeatureFlagsAdminController],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
