// 사용자 인증 단위 테스트

import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { 
  authenticateUser, 
  createUser, 
  updateUser,
  validatePassword,
  hashPassword,
  generateResetToken
} from '../../app/lib/auth.server';
import { prisma } from '../../app/lib/db.server';

// Mock Prisma
vi.mock('../../app/lib/db.server', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn()
    }
  }
}));

describe('사용자 인증 시스템', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('비밀번호 해싱', () => {
    it('비밀번호를 안전하게 해싱해야 한다', async () => {
      const password = 'TestPassword123!';
      const hashedPassword = await hashPassword(password);
      
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword).toHaveLength(60); // bcrypt 해시 길이
      expect(await bcrypt.compare(password, hashedPassword)).toBe(true);
    });

    it('같은 비밀번호라도 다른 해시를 생성해야 한다', async () => {
      const password = 'TestPassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('비밀번호 검증', () => {
    it('유효한 비밀번호를 허용해야 한다', () => {
      const validPasswords = [
        'Password123!',
        'MySecret@456',
        'Test1234#Strong'
      ];

      validPasswords.forEach(password => {
        expect(() => validatePassword(password)).not.toThrow();
      });
    });

    it('약한 비밀번호를 거부해야 한다', () => {
      const invalidPasswords = [
        'short',           // 너무 짧음
        'password123',     // 특수문자 없음
        'PASSWORD123!',    // 소문자 없음
        'password!',       // 숫자 없음
        'Password123'      // 특수문자 없음
      ];

      invalidPasswords.forEach(password => {
        expect(() => validatePassword(password)).toThrow();
      });
    });
  });

  describe('사용자 생성', () => {
    it('새로운 사용자를 생성해야 한다', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Password123!',
        name: '테스트 사용자'
      };

      const mockUser = {
        id: '1',
        email: userData.email,
        name: userData.name,
        role: 'USER',
        createdAt: new Date()
      };

      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.user.create as any).mockResolvedValue(mockUser);

      const user = await createUser(userData);

      expect(user).toEqual(mockUser);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: userData.email,
          passwordHash: expect.any(String),
          name: userData.name,
          role: 'USER'
        }
      });
    });

    it('이미 존재하는 이메일로 사용자 생성을 거부해야 한다', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'Password123!',
        name: '기존 사용자'
      };

      (prisma.user.findUnique as any).mockResolvedValue({ id: '1' });

      await expect(createUser(userData)).rejects.toThrow('이미 등록된 이메일입니다');
    });
  });

  describe('사용자 인증', () => {
    it('올바른 자격증명으로 사용자를 인증해야 한다', async () => {
      const email = 'test@example.com';
      const password = 'Password123!';
      const hashedPassword = await hashPassword(password);

      const mockUser = {
        id: '1',
        email,
        passwordHash: hashedPassword,
        name: '테스트 사용자',
        role: 'USER'
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      const user = await authenticateUser(email, password);

      expect(user).toBeTruthy();
      expect(user?.email).toBe(email);
    });

    it('잘못된 비밀번호로 인증을 거부해야 한다', async () => {
      const email = 'test@example.com';
      const correctPassword = 'Password123!';
      const wrongPassword = 'WrongPassword123!';
      const hashedPassword = await hashPassword(correctPassword);

      const mockUser = {
        id: '1',
        email,
        passwordHash: hashedPassword,
        name: '테스트 사용자'
      };

      (prisma.user.findUnique as any).mockResolvedValue(mockUser);

      const user = await authenticateUser(email, wrongPassword);

      expect(user).toBeNull();
    });

    it('존재하지 않는 사용자 인증을 거부해야 한다', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const user = await authenticateUser('nonexistent@example.com', 'Password123!');

      expect(user).toBeNull();
    });
  });

  describe('비밀번호 재설정', () => {
    it('재설정 토큰을 생성해야 한다', () => {
      const token = generateResetToken();
      
      expect(token).toHaveLength(32);
      expect(token).toMatch(/^[a-f0-9]{32}$/); // 32자 hex 문자열
    });

    it('매번 다른 재설정 토큰을 생성해야 한다', () => {
      const token1 = generateResetToken();
      const token2 = generateResetToken();
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('사용자 업데이트', () => {
    it('사용자 정보를 업데이트해야 한다', async () => {
      const userId = '1';
      const updateData = {
        name: '업데이트된 이름',
        email: 'updated@example.com'
      };

      const updatedUser = {
        id: userId,
        ...updateData,
        role: 'USER',
        updatedAt: new Date()
      };

      (prisma.user.update as any).mockResolvedValue(updatedUser);

      const user = await updateUser(userId, updateData);

      expect(user).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updateData
      });
    });
  });
});

describe('보안 테스트', () => {
  it('타이밍 공격에 안전해야 한다', async () => {
    const email = 'test@example.com';
    const password = 'Password123!';

    // 존재하지 않는 사용자
    (prisma.user.findUnique as any).mockResolvedValue(null);
    
    const start1 = Date.now();
    await authenticateUser('nonexistent@example.com', password);
    const time1 = Date.now() - start1;

    // 존재하지만 잘못된 비밀번호
    const hashedPassword = await hashPassword('CorrectPassword123!');
    (prisma.user.findUnique as any).mockResolvedValue({
      id: '1',
      email,
      passwordHash: hashedPassword
    });

    const start2 = Date.now();
    await authenticateUser(email, 'WrongPassword123!');
    const time2 = Date.now() - start2;

    // 타이밍 차이가 크지 않아야 함 (100ms 이하)
    expect(Math.abs(time1 - time2)).toBeLessThan(100);
  });

  it('SQL 인젝션에 안전해야 한다', async () => {
    const maliciousEmail = "'; DROP TABLE users; --";
    const password = 'Password123!';

    (prisma.user.findUnique as any).mockResolvedValue(null);

    // 에러 없이 처리되어야 함
    const user = await authenticateUser(maliciousEmail, password);
    expect(user).toBeNull();
  });
});

describe('엣지 케이스', () => {
  it('매우 긴 이메일을 처리해야 한다', async () => {
    const longEmail = 'a'.repeat(250) + '@example.com';
    const password = 'Password123!';

    (prisma.user.findUnique as any).mockResolvedValue(null);

    const user = await authenticateUser(longEmail, password);
    expect(user).toBeNull();
  });

  it('특수 문자가 포함된 이메일을 처리해야 한다', async () => {
    const specialEmail = 'test+special@example-domain.co.kr';
    const password = 'Password123!';
    const hashedPassword = await hashPassword(password);

    const mockUser = {
      id: '1',
      email: specialEmail,
      passwordHash: hashedPassword
    };

    (prisma.user.findUnique as any).mockResolvedValue(mockUser);

    const user = await authenticateUser(specialEmail, password);
    expect(user).toBeTruthy();
  });

  it('유니코드 이름을 처리해야 한다', async () => {
    const userData = {
      email: 'korean@example.com',
      password: 'Password123!',
      name: '홍길동 🇰🇷'
    };

    const mockUser = {
      id: '1',
      email: userData.email,
      name: userData.name,
      role: 'USER'
    };

    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue(mockUser);

    const user = await createUser(userData);
    expect(user.name).toBe(userData.name);
  });
});