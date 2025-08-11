/**
 * 토스페이먼츠 SDK 서버 통합
 * 토스페이먼츠 API를 통한 결제 처리
 */

import crypto from 'crypto';
import { prisma } from '~/lib/prisma.server';
import { getRedisClient } from '~/lib/redis.server';

export interface TossPaymentConfig {
  clientKey: string;
  secretKey: string;
  isProduction: boolean;
}

export interface PaymentRequest {
  orderId: string;
  amount: number;
  orderName: string;
  customerName?: string;
  customerEmail?: string;
  customerMobilePhone?: string;
  successUrl: string;
  failUrl: string;
  metadata?: Record<string, any>;
}

export interface PaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface PaymentResponse {
  mId: string;
  version: string;
  paymentKey: string;
  orderId: string;
  orderName: string;
  currency: string;
  method: string;
  status: string;
  requestedAt: string;
  approvedAt?: string;
  totalAmount: number;
  balanceAmount: number;
  suppliedAmount: number;
  vat: number;
  card?: CardInfo;
  virtualAccount?: VirtualAccountInfo;
  transfer?: TransferInfo;
  mobilePhone?: MobilePhoneInfo;
  receipt?: ReceiptInfo;
  checkout?: CheckoutInfo;
  easyPay?: EasyPayInfo;
  failure?: FailureInfo;
  cashReceipt?: CashReceiptInfo;
  discount?: DiscountInfo;
}

export interface CardInfo {
  company: string;
  number: string;
  installmentPlanMonths: number;
  isInterestFree: boolean;
  approveNo: string;
  useCardPoint: boolean;
  cardType: string;
  ownerType: string;
  acquireStatus: string;
  receiptUrl: string;
}

export interface VirtualAccountInfo {
  accountType: string;
  accountNumber: string;
  bank: string;
  customerName: string;
  dueDate: string;
  refundStatus: string;
  expired: boolean;
  settlementStatus: string;
}

export interface TransferInfo {
  bank: string;
  settlementStatus: string;
}

export interface MobilePhoneInfo {
  carrier: string;
  customerMobilePhone: string;
  settlementStatus: string;
}

export interface ReceiptInfo {
  url: string;
}

export interface CheckoutInfo {
  url: string;
}

export interface EasyPayInfo {
  provider: string;
  amount: number;
  discountAmount: number;
}

export interface FailureInfo {
  code: string;
  message: string;
}

export interface CashReceiptInfo {
  type: string;
  amount: number;
  taxFreeAmount: number;
  issueNumber: string;
  receiptUrl: string;
}

export interface DiscountInfo {
  amount: number;
}

class TossPaymentsService {
  private config: TossPaymentConfig;
  private baseUrl: string;
  private redis = getRedisClient();

  constructor(config: TossPaymentConfig) {
    this.config = config;
    this.baseUrl = config.isProduction
      ? 'https://api.tosspayments.com'
      : 'https://api.tosspayments.com';
  }

  /**
   * 결제 요청 생성
   */
  async createPaymentRequest(request: PaymentRequest): Promise<string> {
    // 주문 ID 중복 체크
    const existingPayment = await prisma.payment.findUnique({
      where: { orderId: request.orderId },
    });

    if (existingPayment) {
      throw new Error('이미 존재하는 주문 ID입니다.');
    }

    // 결제 정보 DB 저장
    await prisma.payment.create({
      data: {
        orderId: request.orderId,
        amount: request.amount,
        orderName: request.orderName,
        customerName: request.customerName,
        customerEmail: request.customerEmail,
        customerMobilePhone: request.customerMobilePhone,
        status: 'PENDING',
        metadata: request.metadata,
      },
    });

    // Redis에 임시 저장 (30분 TTL)
    await this.redis.setex(
      `payment:${request.orderId}`,
      1800,
      JSON.stringify(request)
    );

    return request.orderId;
  }

  /**
   * 결제 승인
   */
  async confirmPayment(
    request: PaymentConfirmRequest
  ): Promise<PaymentResponse> {
    const authHeader = this.getAuthHeader();

    try {
      const response = await fetch(`${this.baseUrl}/v1/payments/confirm`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '결제 승인에 실패했습니다.');
      }

      // 결제 상태 업데이트
      await prisma.payment.update({
        where: { orderId: request.orderId },
        data: {
          paymentKey: data.paymentKey,
          status: data.status,
          approvedAt: data.approvedAt,
          method: data.method,
          cardInfo: data.card,
          virtualAccountInfo: data.virtualAccount,
          receiptUrl: data.receipt?.url,
        },
      });

      // Redis에서 제거
      await this.redis.del(`payment:${request.orderId}`);

      return data as PaymentResponse;
    } catch (error) {
      // 실패 상태 업데이트
      await prisma.payment.update({
        where: { orderId: request.orderId },
        data: {
          status: 'FAILED',
          failureReason: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * 결제 취소
   */
  async cancelPayment(
    paymentKey: string,
    cancelReason: string,
    cancelAmount?: number
  ): Promise<PaymentResponse> {
    const authHeader = this.getAuthHeader();

    const response = await fetch(
      `${this.baseUrl}/v1/payments/${paymentKey}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelReason,
          cancelAmount,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '결제 취소에 실패했습니다.');
    }

    // 취소 상태 업데이트
    await prisma.payment.update({
      where: { paymentKey },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        cancelReason,
        cancelAmount,
      },
    });

    return data as PaymentResponse;
  }

  /**
   * 결제 조회
   */
  async getPayment(
    paymentKeyOrOrderId: string
  ): Promise<PaymentResponse | null> {
    const authHeader = this.getAuthHeader();

    // paymentKey로 조회
    if (paymentKeyOrOrderId.startsWith('toss_')) {
      const response = await fetch(
        `${this.baseUrl}/v1/payments/${paymentKeyOrOrderId}`,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as PaymentResponse;
    }

    // orderId로 조회
    const response = await fetch(
      `${this.baseUrl}/v1/payments/orders/${paymentKeyOrOrderId}`,
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as PaymentResponse;
  }

  /**
   * 결제 목록 조회
   */
  async getPayments(
    startDate: string,
    endDate: string,
    startingAfter?: string,
    limit: number = 100
  ): Promise<PaymentResponse[]> {
    const authHeader = this.getAuthHeader();
    const params = new URLSearchParams({
      startDate,
      endDate,
      limit: String(limit),
    });

    if (startingAfter) {
      params.append('startingAfter', startingAfter);
    }

    const response = await fetch(
      `${this.baseUrl}/v1/transactions?${params}`,
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    if (!response.ok) {
      throw new Error('결제 목록 조회에 실패했습니다.');
    }

    const data = await response.json();
    return data as PaymentResponse[];
  }

  /**
   * 빌링키 발급
   */
  async createBillingKey(
    customerKey: string,
    cardNumber: string,
    cardExpirationYear: string,
    cardExpirationMonth: string,
    cardPassword: string,
    customerIdentityNumber: string
  ): Promise<string> {
    const authHeader = this.getAuthHeader();

    const response = await fetch(`${this.baseUrl}/v1/billing/authorizations/card`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerKey,
        cardNumber,
        cardExpirationYear,
        cardExpirationMonth,
        cardPassword,
        customerIdentityNumber,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '빌링키 발급에 실패했습니다.');
    }

    return data.billingKey;
  }

  /**
   * 빌링키로 결제
   */
  async payWithBillingKey(
    billingKey: string,
    customerKey: string,
    amount: number,
    orderId: string,
    orderName: string
  ): Promise<PaymentResponse> {
    const authHeader = this.getAuthHeader();

    const response = await fetch(`${this.baseUrl}/v1/billing/${billingKey}`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerKey,
        amount,
        orderId,
        orderName,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || '빌링 결제에 실패했습니다.');
    }

    return data as PaymentResponse;
  }

  /**
   * 웹훅 검증
   */
  verifyWebhook(payload: string, signature: string): boolean {
    const hash = crypto
      .createHmac('sha256', this.config.secretKey)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  /**
   * 인증 헤더 생성
   */
  private getAuthHeader(): string {
    const credentials = Buffer.from(
      `${this.config.secretKey}:`
    ).toString('base64');
    return `Basic ${credentials}`;
  }
}

// 싱글톤 인스턴스
let tossPaymentsInstance: TossPaymentsService | null = null;

export function getTossPayments(): TossPaymentsService {
  if (!tossPaymentsInstance) {
    tossPaymentsInstance = new TossPaymentsService({
      clientKey: process.env.TOSS_CLIENT_KEY!,
      secretKey: process.env.TOSS_SECRET_KEY!,
      isProduction: process.env.NODE_ENV === 'production',
    });
  }
  return tossPaymentsInstance;
}