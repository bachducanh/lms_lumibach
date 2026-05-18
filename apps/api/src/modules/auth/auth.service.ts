import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '@lumibach/db';
import { EmailService } from '../../common/email/email.service';

@Injectable()
export class UserAuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly email: EmailService
  ) {}

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private async createEmailVerificationToken(userId: string): Promise<string> {
    await this.prisma.emailVerificationToken.deleteMany({ where: { userId } });
    const token = this.generateToken();
    await this.prisma.emailVerificationToken.create({
      data: { userId, token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    return token;
  }

  private async createPasswordResetToken(userId: string): Promise<string> {
    await this.prisma.passwordReset.deleteMany({ where: { userId } });
    const token = this.generateToken();
    await this.prisma.passwordReset.create({
      data: { userId, token, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    return token;
  }

  async checkStatus(email: string): Promise<'ok' | 'pending' | 'suspended' | 'not_found'> {
    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
      select: { status: true },
    });
    if (!user) return 'not_found';
    if (user.status === 'PENDING') return 'pending';
    if (user.status === 'SUSPENDED') return 'suspended';
    return 'ok';
  }

  async register(input: { email: string; fullName: string; password: string }): Promise<string> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new BadRequestException('Email này đã được đăng ký.');

    const parts = input.fullName.trim().split(/\s+/);
    const firstName = parts.slice(0, -1).join(' ') || input.fullName;
    const lastName = parts.at(-1) ?? '';
    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        firstName,
        lastName,
        passwordHash,
        role: 'STUDENT',
        status: 'PENDING',
      },
    });

    const token = await this.createEmailVerificationToken(user.id);
    await this.email.sendVerificationEmail(input.email, token);

    return 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.';
  }

  async verifyEmail(token: string): Promise<string> {
    const record = await this.prisma.emailVerificationToken.findUnique({ where: { token } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Liên kết xác thực không hợp lệ hoặc đã hết hạn.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: new Date(), status: 'ACTIVE' },
      }),
      this.prisma.emailVerificationToken.update({
        where: { token },
        data: { usedAt: new Date() },
      }),
    ]);

    return 'Email xác thực thành công! Bạn có thể đăng nhập.';
  }

  async resendVerification(email: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { email, deletedAt: null } });

    if (user && user.status === 'PENDING') {
      const token = await this.createEmailVerificationToken(user.id);
      await this.email.sendVerificationEmail(user.email, token);
    }

    return 'Nếu tài khoản tồn tại, email xác thực đã được gửi lại.';
  }

  async forgotPassword(email: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    if (user && user.status !== 'SUSPENDED') {
      const token = await this.createPasswordResetToken(user.id);
      await this.email.sendPasswordResetEmail(user.email, token);
    }

    return 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu trong vài phút.';
  }

  async resetPassword(input: {
    token: string;
    password: string;
    confirmPassword: string;
  }): Promise<string> {
    if (input.password !== input.confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp.');
    }

    const record = await this.prisma.passwordReset.findUnique({ where: { token: input.token } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { token: input.token },
        data: { usedAt: new Date() },
      }),
    ]);

    return 'Mật khẩu đã được đặt lại thành công. Bạn có thể đăng nhập.';
  }

  async changePassword(
    userId: string,
    input: { currentPassword: string; newPassword: string; confirmPassword: string }
  ): Promise<string> {
    if (input.newPassword !== input.confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) throw new UnauthorizedException('Không tìm thấy tài khoản.');

    const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isValid) throw new BadRequestException('Mật khẩu hiện tại không đúng.');

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    return 'Mật khẩu đã được thay đổi thành công.';
  }
}
