// TossPayments 웹훅 처리 시스템

import crypto from 'crypto';
import { prisma } from '../db.server';
import { sendSMS } from '../notifications/sms.server';

// TossPayments 설정
const TOSS_CONFIG = {
  secretKey: process.env.TOSS_SECRET_KEY!,
  clientKey: process.env.TOSS_CLIENT_KEY!,
  webhookSecret: process.env.TOSS_WEBHOOK_SECRET!,
  apiUrl: 'https://api.tosspayments.com'
};

// 결제 상태 타입
type PaymentStatus = 
  | 'READY' 
  | 'IN_PROGRESS' 
  | 'WAITING_FOR_DEPOSIT'
  | 'DONE'
  | 'CANCELED'
  | 'PARTIAL_CANCELED'
  | 'ABORTED'
  | 'EXPIRED';

// 웹훅 이벤트 타입
interface TossWebhookEvent {
  eventType: string;
  createdAt: string;
  data: {
    paymentKey: string;
    type: string;
    orderId: string;
    orderName: string;
    mId: string;
    currency: string;
    method: string;
    totalAmount: number;
    balanceAmount: number;
    status: PaymentStatus;
    requestedAt: string;
    approvedAt?: string;
    useEscrow: boolean;
    lastTransactionKey?: string;
    suppliedAmount: number;
    vat: number;
    cultureExpense: boolean;
    taxFreeAmount: number;
    taxExemptionAmount: number;
    cancels?: Array<{
      cancelAmount: number;
      cancelReason: string;
      taxFreeAmount: number;
      taxExemptionAmount: number;
      refundableAmount: number;
      easyPayDiscountAmount: number;
      canceledAt: string;
      transactionKey: string;
    }>;
    secret?: string;
    card?: {
      amount: number;
      issuerCode: string;
      acquirerCode?: string;
      number: string;
      installmentPlanMonths: number;
      approveNo: string;
      useCardPoint: boolean;
      cardType: string;
      ownerType: string;
      acquireStatus: string;
      isInterestFree: boolean;
      interestPayer?: string;
    };
    virtualAccount?: {
      accountType: string;
      accountNumber: string;
      bankCode: string;
      customerName: string;
      dueDate: string;
      refundStatus: string;
      expired: boolean;
      settlementStatus: string;
      refundReceiveAccount?: {
        bankCode: string;
        accountNumber: string;
        holderName: string;
      };
    };
    transfer?: {
      bankCode: string;
      settlementStatus: string;
    };
    mobilePhone?: {
      settlementStatus: string;
      receiptUrl: string;
    };
    giftCertificate?: {
      approveNo: string;
      settlementStatus: string;
    };
    cashReceipt?: {
      type: string;
      receiptKey: string;
      issueNumber: string;
      receiptUrl: string;
      amount: number;
      taxFreeAmount: number;
    };
    cashReceipts?: Array<{
      receiptKey: string;
      orderId: string;
      orderName: string;
      type: string;
      issueNumber: string;
      receiptUrl: string;
      businessNumber: string;
      transactionType: string;
      amount: number;
      taxFreeAmount: number;
      issueStatus: string;
      failure?: {
        code: string;
        message: string;
      };
      customerIdentityNumber: string;
      requestedAt: string;
    }>;
    discount?: {
      amount: number;
    };
    country: string;
    failure?: {
      code: string;
      message: string;
    };
    isPartialCancelable: boolean;
    receipt?: {
      url: string;
    };
    checkout?: {
      url: string;
    };
  };
}

// 웹훅 서명 검증
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('웹훅 서명 검증 실패:', error);
    return false;
  }
}

// 결제 승인 처리
async function handlePaymentApproved(event: TossWebhookEvent): Promise<void> {
  const { data } = event;
  
  try {
    // 결제 정보 업데이트
    const payment = await prisma.payment.update({
      where: { paymentKey: data.paymentKey },
      data: {
        status: 'COMPLETED',
        approvedAt: data.approvedAt ? new Date(data.approvedAt) : new Date(),
        method: data.method,
        totalAmount: data.totalAmount,
        balanceAmount: data.balanceAmount,
        suppliedAmount: data.suppliedAmount,
        vat: data.vat,
        taxFreeAmount: data.taxFreeAmount,
        metadata: {
          card: data.card,
          virtualAccount: data.virtualAccount,
          transfer: data.transfer,
          mobilePhone: data.mobilePhone,
          giftCertificate: data.giftCertificate,
          cashReceipt: data.cashReceipt,
          receipt: data.receipt
        }
      },
      include: {
        order: {
          include: {
            user: true,
            orderItems: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (!payment.order) {
      throw new Error('주문 정보를 찾을 수 없습니다');
    }

    // 주문 상태 업데이트
    await prisma.order.update({
      where: { id: payment.order.id },
      data: {
        status: 'PAID',
        paidAt: new Date()
      }
    });

    // 재고 차감 처리
    for (const item of payment.order.orderItems) {
      if (item.product.trackInventory) {
        await prisma.product.update({
          where: { id: item.product.id },
          data: {
            inventory: {
              decrement: item.quantity
            }
          }
        });
      }
    }

    // 결제 완료 알림 발송
    if (payment.order.user.phone) {
      await sendSMS(
        payment.order.user.phone,
        'PAYMENT_SUCCESS',
        {
          amount: data.totalAmount.toLocaleString(),
          orderNumber: payment.order.orderNumber
        }
      );
    }

    // 결제 완료 이메일 발송 (추가 구현 가능)
    // await sendPaymentConfirmationEmail(payment.order);

    console.log(`결제 승인 처리 완료: ${data.paymentKey}`);
  } catch (error) {
    console.error('결제 승인 처리 실패:', error);
    
    // 실패 로그 기록
    await prisma.paymentLog.create({
      data: {
        paymentKey: data.paymentKey,
        event: 'APPROVAL_FAILED',
        data: JSON.stringify(data),
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    });
    
    throw error;
  }
}

// 결제 취소 처리
async function handlePaymentCanceled(event: TossWebhookEvent): Promise<void> {
  const { data } = event;
  
  try {
    // 부분 취소인지 전체 취소인지 확인
    const isPartialCancel = data.status === 'PARTIAL_CANCELED';
    const totalCancelAmount = data.cancels?.reduce((sum, cancel) => sum + cancel.cancelAmount, 0) || 0;

    // 결제 정보 업데이트
    const payment = await prisma.payment.update({
      where: { paymentKey: data.paymentKey },
      data: {
        status: data.status as any,
        canceledAmount: totalCancelAmount,
        balanceAmount: data.balanceAmount,
        metadata: {
          ...((payment.metadata as any) || {}),
          cancels: data.cancels
        }
      },
      include: {
        order: {
          include: {
            user: true,
            orderItems: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (!payment.order) {
      throw new Error('주문 정보를 찾을 수 없습니다');
    }

    // 주문 상태 업데이트
    if (!isPartialCancel) {
      await prisma.order.update({
        where: { id: payment.order.id },
        data: {
          status: 'CANCELED',
          canceledAt: new Date()
        }
      });

      // 전체 취소 시 재고 복원
      for (const item of payment.order.orderItems) {
        if (item.product.trackInventory) {
          await prisma.product.update({
            where: { id: item.product.id },
            data: {
              inventory: {
                increment: item.quantity
              }
            }
          });
        }
      }
    }

    // 취소 알림 발송
    if (payment.order.user.phone) {
      const lastCancel = data.cancels?.[data.cancels.length - 1];
      
      await sendSMS(
        payment.order.user.phone,
        'ORDER_CANCELED', // 새로운 템플릿 필요
        {
          orderNumber: payment.order.orderNumber,
          cancelAmount: (lastCancel?.cancelAmount || 0).toLocaleString(),
          cancelReason: lastCancel?.cancelReason || '고객 요청'
        }
      );
    }

    console.log(`결제 취소 처리 완료: ${data.paymentKey}`);
  } catch (error) {
    console.error('결제 취소 처리 실패:', error);
    
    await prisma.paymentLog.create({
      data: {
        paymentKey: data.paymentKey,
        event: 'CANCEL_FAILED',
        data: JSON.stringify(data),
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    });
    
    throw error;
  }
}

// 가상계좌 입금 완료 처리
async function handleVirtualAccountDeposit(event: TossWebhookEvent): Promise<void> {
  const { data } = event;
  
  try {
    // 결제 정보 업데이트
    const payment = await prisma.payment.update({
      where: { paymentKey: data.paymentKey },
      data: {
        status: 'COMPLETED',
        approvedAt: new Date(),
        totalAmount: data.totalAmount,
        balanceAmount: data.balanceAmount,
        metadata: {
          ...((payment.metadata as any) || {}),
          virtualAccount: data.virtualAccount
        }
      },
      include: {
        order: {
          include: {
            user: true
          }
        }
      }
    });

    if (!payment.order) {
      throw new Error('주문 정보를 찾을 수 없습니다');
    }

    // 주문 상태 업데이트
    await prisma.order.update({
      where: { id: payment.order.id },
      data: {
        status: 'PAID',
        paidAt: new Date()
      }
    });

    // 입금 확인 알림 발송
    if (payment.order.user.phone) {
      await sendSMS(
        payment.order.user.phone,
        'PAYMENT_SUCCESS',
        {
          amount: data.totalAmount.toLocaleString(),
          orderNumber: payment.order.orderNumber
        }
      );
    }

    console.log(`가상계좌 입금 처리 완료: ${data.paymentKey}`);
  } catch (error) {
    console.error('가상계좌 입금 처리 실패:', error);
    
    await prisma.paymentLog.create({
      data: {
        paymentKey: data.paymentKey,
        event: 'VIRTUAL_ACCOUNT_DEPOSIT_FAILED',
        data: JSON.stringify(data),
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    });
    
    throw error;
  }
}

// 결제 실패 처리
async function handlePaymentFailed(event: TossWebhookEvent): Promise<void> {
  const { data } = event;
  
  try {
    // 결제 정보 업데이트
    await prisma.payment.update({
      where: { paymentKey: data.paymentKey },
      data: {
        status: 'FAILED',
        failure: data.failure,
        metadata: {
          ...((payment.metadata as any) || {}),
          failure: data.failure
        }
      }
    });

    // 주문 상태 업데이트
    const payment = await prisma.payment.findUnique({
      where: { paymentKey: data.paymentKey },
      include: { order: true }
    });

    if (payment?.order) {
      await prisma.order.update({
        where: { id: payment.order.id },
        data: {
          status: 'PAYMENT_FAILED'
        }
      });
    }

    console.log(`결제 실패 처리 완료: ${data.paymentKey}`);
  } catch (error) {
    console.error('결제 실패 처리 실패:', error);
    
    await prisma.paymentLog.create({
      data: {
        paymentKey: data.paymentKey,
        event: 'FAILURE_HANDLING_FAILED',
        data: JSON.stringify(data),
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      }
    });
  }
}

// 웹훅 이벤트 처리 메인 함수
export async function handleTossWebhook(
  payload: string,
  signature: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 서명 검증
    if (!verifyWebhookSignature(payload, signature, TOSS_CONFIG.webhookSecret)) {
      console.error('TossPayments 웹훅 서명 검증 실패');
      return { success: false, error: 'Invalid signature' };
    }

    const event: TossWebhookEvent = JSON.parse(payload);
    
    // 웹훅 로그 기록
    await prisma.paymentLog.create({
      data: {
        paymentKey: event.data.paymentKey,
        event: event.eventType,
        data: payload
      }
    });

    console.log(`TossPayments 웹훅 수신: ${event.eventType} - ${event.data.paymentKey}`);

    // 이벤트 타입별 처리
    switch (event.eventType) {
      case 'PAYMENT_STATUS_CHANGED':
        switch (event.data.status) {
          case 'DONE':
            await handlePaymentApproved(event);
            break;
          case 'CANCELED':
          case 'PARTIAL_CANCELED':
            await handlePaymentCanceled(event);
            break;
          case 'ABORTED':
          case 'EXPIRED':
            await handlePaymentFailed(event);
            break;
          default:
            console.log(`처리하지 않는 결제 상태: ${event.data.status}`);
        }
        break;
        
      case 'VIRTUAL_ACCOUNT_DEPOSIT':
        await handleVirtualAccountDeposit(event);
        break;
        
      case 'PAYMENT_FAILED':
        await handlePaymentFailed(event);
        break;
        
      default:
        console.log(`처리하지 않는 이벤트 타입: ${event.eventType}`);
    }

    return { success: true };
  } catch (error) {
    console.error('TossPayments 웹훅 처리 실패:', error);
    
    try {
      const event = JSON.parse(payload);
      await prisma.paymentLog.create({
        data: {
          paymentKey: event.data?.paymentKey || 'unknown',
          event: 'WEBHOOK_ERROR',
          data: payload,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        }
      });
    } catch {
      // 로그 저장 실패는 무시
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

// TossPayments API 호출 헬퍼
export async function callTossAPI(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any
): Promise<any> {
  const url = `${TOSS_CONFIG.apiUrl}${endpoint}`;
  const auth = Buffer.from(`${TOSS_CONFIG.secretKey}:`).toString('base64');
  
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: data ? JSON.stringify(data) : undefined
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`TossPayments API 오류: ${errorData.message || response.statusText}`);
  }

  return await response.json();
}

// 결제 정보 조회
export async function getPaymentInfo(paymentKey: string): Promise<any> {
  return await callTossAPI(`/v1/payments/${paymentKey}`);
}

// 결제 취소
export async function cancelPayment(
  paymentKey: string,
  cancelReason: string,
  cancelAmount?: number
): Promise<any> {
  const data: any = { cancelReason };
  if (cancelAmount) {
    data.cancelAmount = cancelAmount;
  }
  
  return await callTossAPI(`/v1/payments/${paymentKey}/cancel`, 'POST', data);
}

// 현금영수증 발급
export async function issueCashReceipt(
  paymentKey: string,
  type: 'PERSONAL' | 'CORPORATE',
  customerIdentityNumber: string
): Promise<any> {
  return await callTossAPI(`/v1/payments/${paymentKey}/cash-receipt`, 'POST', {
    type,
    customerIdentityNumber
  });
}

// 정산 내역 조회
export async function getSettlements(
  dateFrom: string,
  dateTo: string,
  page = 0,
  size = 100
): Promise<any> {
  const params = new URLSearchParams({
    dateFrom,
    dateTo,
    page: page.toString(),
    size: size.toString()
  });
  
  return await callTossAPI(`/v1/settlements?${params.toString()}`);
}