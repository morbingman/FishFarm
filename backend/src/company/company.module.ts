import { Global, Module } from '@nestjs/common';
import { CompanyService } from './company.service.js';

@Global()
@Module({
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
