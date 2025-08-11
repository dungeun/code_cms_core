/**
 * 타입 가드 및 타입 안전 유틸리티
 * 런타임 타입 체크를 통한 타입 안전성 보장
 */

// 기본 타입 가드
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isFunction(value: unknown): value is Function {
  return typeof value === 'function';
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

// null/undefined 체크
export function isNull(value: unknown): value is null {
  return value === null;
}

export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// 문자열 검증
export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

export function isEmail(value: unknown): value is string {
  if (!isString(value)) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

export function isURL(value: unknown): value is string {
  if (!isString(value)) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function isSlug(value: unknown): value is string {
  if (!isString(value)) return false;
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(value);
}

// 숫자 검증
export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

export function isNonNegativeNumber(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

export function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value);
}

export function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0;
}

// 배열 검증
export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return isArray(value) && value.length > 0;
}

export function isArrayOf<T>(
  value: unknown,
  typeGuard: (item: unknown) => item is T
): value is T[] {
  return isArray(value) && value.every(typeGuard);
}

export function isStringArray(value: unknown): value is string[] {
  return isArrayOf(value, isString);
}

export function isNumberArray(value: unknown): value is number[] {
  return isArrayOf(value, isNumber);
}

// 객체 검증
export function hasProperty<T extends PropertyKey>(
  obj: unknown,
  prop: T
): obj is Record<T, unknown> {
  return isObject(obj) && prop in obj;
}

export function hasStringProperty<T extends PropertyKey>(
  obj: unknown,
  prop: T
): obj is Record<T, string> {
  return hasProperty(obj, prop) && isString(obj[prop]);
}

export function hasNumberProperty<T extends PropertyKey>(
  obj: unknown,
  prop: T
): obj is Record<T, number> {
  return hasProperty(obj, prop) && isNumber(obj[prop]);
}

export function hasBooleanProperty<T extends PropertyKey>(
  obj: unknown,
  prop: T
): obj is Record<T, boolean> {
  return hasProperty(obj, prop) && isBoolean(obj[prop]);
}

// 도메인 특화 타입 가드
export function isValidPostData(value: unknown): value is {
  title: string;
  content: string;
  menuId: string;
  authorId: string;
} {
  return (
    isObject(value) &&
    hasStringProperty(value, 'title') &&
    hasStringProperty(value, 'content') &&
    hasStringProperty(value, 'menuId') &&
    hasStringProperty(value, 'authorId') &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.content)
  );
}

export function isValidUserData(value: unknown): value is {
  username: string;
  email: string;
  password: string;
} {
  return (
    isObject(value) &&
    hasStringProperty(value, 'username') &&
    hasStringProperty(value, 'email') &&
    hasStringProperty(value, 'password') &&
    isNonEmptyString(value.username) &&
    isEmail(value.email) &&
    value.password.length >= 8
  );
}

export function isValidMenuData(value: unknown): value is {
  name: string;
  slug: string;
} {
  return (
    isObject(value) &&
    hasStringProperty(value, 'name') &&
    hasStringProperty(value, 'slug') &&
    isNonEmptyString(value.name) &&
    isSlug(value.slug)
  );
}

// 고급 타입 유틸리티
export function parseJSON<T>(
  jsonString: string,
  typeGuard?: (value: unknown) => value is T
): T | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (typeGuard && !typeGuard(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function safeAccess<T, K extends keyof T>(
  obj: T | null | undefined,
  key: K
): T[K] | undefined {
  return obj?.[key];
}

export function safeCall<T extends unknown[], R>(
  fn: ((...args: T) => R) | null | undefined,
  ...args: T
): R | undefined {
  return fn?.(...args);
}

// 에러 처리 타입 가드
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function isErrorWithMessage(value: unknown): value is { message: string } {
  return (
    isObject(value) &&
    hasStringProperty(value, 'message')
  );
}

// Result 타입 (에러 처리용)
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export function createSuccess<T>(data: T): Result<T> {
  return { success: true, data };
}

export function createError<T, E = Error>(error: E): Result<T, E> {
  return { success: false, error };
}

export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success;
}

export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}

// 안전한 형변환
export function toNumber(value: unknown, defaultValue: number = 0): number {
  if (isNumber(value)) return value;
  if (isString(value)) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

export function toString(value: unknown, defaultValue: string = ''): string {
  if (isString(value)) return value;
  if (value === null || value === undefined) return defaultValue;
  return String(value);
}

export function toBoolean(value: unknown, defaultValue: boolean = false): boolean {
  if (isBoolean(value)) return value;
  if (isString(value)) {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
  }
  if (isNumber(value)) {
    return value !== 0;
  }
  return defaultValue;
}