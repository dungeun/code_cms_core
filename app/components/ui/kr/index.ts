/**
 * 한국형 UI 컴포넌트 모음
 * shadcn/ui를 한국 환경에 맞게 확장한 컴포넌트
 */

// 날짜/시간 컴포넌트
export { KrDatePicker, KrDateRangePicker } from './date-picker';
export type { KrDatePickerProps, KrDateRangePickerProps } from './date-picker';

// 전화번호 컴포넌트
export { KrPhoneInput, KrMobileInput } from './phone-input';
export type { KrPhoneInputProps, KrMobileInputProps } from './phone-input';

// 주소 컴포넌트
export {
  KrAddressInput,
  KrAddressDisplay,
  validateKrAddress,
  formatKrAddress,
} from './address-input';
export type {
  KrAddress,
  KrAddressInputProps,
  KrAddressDisplayProps,
} from './address-input';

// 통화 컴포넌트
export {
  KrCurrencyInput,
  KrCurrencyDisplay,
  toKoreanCurrency,
} from './currency-input';
export type {
  KrCurrencyInputProps,
  KrCurrencyDisplayProps,
} from './currency-input';

// 사업자/법인 번호 컴포넌트
export {
  KrBusinessNumberInput,
  KrCorporateNumberInput,
} from './business-number-input';
export type {
  KrBusinessNumberInputProps,
  KrCorporateNumberInputProps,
} from './business-number-input';