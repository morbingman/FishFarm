import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/exceptions/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * FishFarm is operated by a single company that owns all catalog inventory,
 * batches and facilities. Every Admin operates this same company scope, so
 * records are not owned by individual Admin accounts.
 */
@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async current() {
    const company = await this.prisma.company.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!company) {
      throw new AppException('company.notConfigured', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return company;
  }
}
