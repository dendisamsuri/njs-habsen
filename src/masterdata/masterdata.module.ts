import { Module } from '@nestjs/common';
import { MasterdataController } from './masterdata.controller';
import { CompaniesController } from './companies.controller';

@Module({
  controllers: [MasterdataController, CompaniesController],
})
export class MasterdataModule {}
