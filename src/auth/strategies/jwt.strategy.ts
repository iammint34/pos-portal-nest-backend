import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  storeId?: string;
  roleId?: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, deletedAt: null },
      include: {
        storeUsers: {
          where: { deletedAt: null, isActive: true },
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
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Get permissions from the user's store role
    let permissions: string[] = [];
    let storeId: string | undefined;
    let roleId: string | undefined;

    if (payload.storeId) {
      const storeUser = user.storeUsers.find(
        (su) => su.storeId === payload.storeId,
      );
      if (storeUser) {
        storeId = storeUser?.storeId;
        roleId = storeUser.roleId;
        permissions = storeUser.role.rolePermissions.map(
          (rp) => rp.permission.code,
        );
      }
    }

    return {
      userId: user.id,
      email: user.email,
      storeId,
      roleId,
      permissions,
    };
  }
}
