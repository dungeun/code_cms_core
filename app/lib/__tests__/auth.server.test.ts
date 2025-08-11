/**
 * 인증 시스템 단위 테스트
 * 사용자 인증, 세션 관리, 비밀번호 처리 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  createUser,
  getUserByEmail,
  getUserByUsername,
  verifyLogin,
} from '../auth.server';
import { mockFunctions, testData } from '~/test/utils';

// 데이터베이스 모킹
const mockDb = mockFunctions.createMockPrisma();
vi.mock('~/utils/db.server', () => ({
  db: mockDb,
}));

describe('인증 시스템 (auth.server)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('비밀번호 처리', () => {
    it('비밀번호를 안전하게 해시화한다', async () => {
      const password = 'testpassword123';
      const hashedPassword = await hashPassword(password);
      
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword).toMatch(/^\$2[aby]\$/); // bcrypt 해시 패턴
      expect(hashedPassword.length).toBeGreaterThan(50);
    });

    it('올바른 비밀번호를 검증한다', async () => {
      const password = 'testpassword123';
      const hashedPassword = await hashPassword(password);
      
      const isValid = await verifyPassword(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('잘못된 비밀번호를 거부한다', async () => {
      const password = 'testpassword123';
      const wrongPassword = 'wrongpassword';
      const hashedPassword = await hashPassword(password);
      
      const isValid = await verifyPassword(wrongPassword, hashedPassword);
      expect(isValid).toBe(false);
    });

    it('빈 비밀번호를 처리한다', async () => {
      const emptyPassword = '';
      const hashedPassword = await hashPassword(emptyPassword);
      
      const isValid = await verifyPassword(emptyPassword, hashedPassword);
      expect(isValid).toBe(true);
    });
  });

  describe('사용자 생성', () => {
    it('새로운 사용자를 생성한다', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
      };

      const createdUser = testData.createUser({
        ...userData,
        password: 'hashed-password',
      });

      mockDb.user.create.mockResolvedValue(createdUser);

      const result = await createUser(userData);

      expect(mockDb.user.create).toHaveBeenCalledWith({
        data: {
          username: userData.username,
          email: userData.email,
          password: expect.any(String), // 해시된 비밀번호
          name: userData.name,
        },
      });
      expect(result).toEqual(createdUser);
    });

    it('비밀번호가 해시화되어 저장된다', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'plainpassword',
      };

      mockDb.user.create.mockResolvedValue(testData.createUser());

      await createUser(userData);

      const createCall = mockDb.user.create.mock.calls[0][0];
      expect(createCall.data.password).not.toBe(userData.password);
      expect(createCall.data.password).toMatch(/^\$2[aby]\$/);
    });
  });

  describe('사용자 조회', () => {
    it('이메일로 사용자를 조회한다', async () => {
      const user = testData.createUser();
      mockDb.user.findUnique.mockResolvedValue(user);

      const result = await getUserByEmail(user.email);

      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { email: user.email },
      });
      expect(result).toEqual(user);
    });

    it('사용자명으로 사용자를 조회한다', async () => {
      const user = testData.createUser();
      mockDb.user.findUnique.mockResolvedValue(user);

      const result = await getUserByUsername(user.username);

      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { username: user.username },
      });
      expect(result).toEqual(user);
    });

    it('존재하지 않는 이메일에 대해 null을 반환한다', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      const result = await getUserByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('로그인 검증', () => {
    const user = testData.createUser();
    const password = 'correctpassword';

    beforeEach(async () => {
      // 비밀번호 해시화
      user.password = await hashPassword(password);
    });

    it('올바른 이메일과 비밀번호로 로그인한다', async () => {
      mockDb.user.findFirst.mockResolvedValue(user);
      mockDb.user.update.mockResolvedValue(user);

      const result = await verifyLogin(user.email, password);

      expect(mockDb.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: user.email },
            { username: user.email },
          ],
          isActive: true,
        },
      });
      expect(result).toEqual(user);
    });

    it('올바른 사용자명과 비밀번호로 로그인한다', async () => {
      mockDb.user.findFirst.mockResolvedValue(user);
      mockDb.user.update.mockResolvedValue(user);

      const result = await verifyLogin(user.username, password);

      expect(result).toEqual(user);
    });

    it('잘못된 비밀번호로 로그인 실패한다', async () => {
      mockDb.user.findFirst.mockResolvedValue(user);

      const result = await verifyLogin(user.email, 'wrongpassword');

      expect(result).toBeNull();
    });

    it('존재하지 않는 사용자로 로그인 실패한다', async () => {
      mockDb.user.findFirst.mockResolvedValue(null);

      const result = await verifyLogin('nonexistent@example.com', password);

      expect(result).toBeNull();
    });

    it('비활성화된 사용자로 로그인 실패한다', async () => {
      const inactiveUser = testData.createUser({ isActive: false });
      mockDb.user.findFirst.mockResolvedValue(null); // isActive: true 조건으로 찾지 못함

      const result = await verifyLogin(inactiveUser.email, password);

      expect(result).toBeNull();
    });

    it('로그인 성공 시 마지막 로그인 시간을 업데이트한다', async () => {
      mockDb.user.findFirst.mockResolvedValue(user);
      mockDb.user.update.mockResolvedValue(user);

      await verifyLogin(user.email, password);

      expect(mockDb.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('데이터베이스 오류 시 null을 반환한다', async () => {
      mockDb.user.findFirst.mockRejectedValue(new Error('Database error'));

      const result = await verifyLogin(user.email, password);

      expect(result).toBeNull();
    });
  });

  describe('에러 처리', () => {
    it('해시화 실패 시 에러를 던진다', async () => {
      const bcrypt = await import('bcryptjs');
      vi.spyOn(bcrypt, 'hash').mockRejectedValue(new Error('Hash failed'));

      await expect(hashPassword('password')).rejects.toThrow('Hash failed');
    });

    it('검증 실패 시 에러를 던진다', async () => {
      const bcrypt = await import('bcryptjs');
      vi.spyOn(bcrypt, 'compare').mockRejectedValue(new Error('Compare failed'));

      await expect(verifyPassword('password', 'hash')).rejects.toThrow('Compare failed');
    });
  });
});