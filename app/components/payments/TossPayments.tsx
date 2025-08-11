/**
 * 토스페이먼츠 결제 컴포넌트
 * 토스페이먼츠 SDK를 통한 결제 UI
 */

import { useEffect, useRef, useState } from 'react';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { useToast } from '~/components/ui/use-toast';
import { Loader2, CreditCard, Smartphone, Building } from 'lucide-react';
import { krToast } from '~/components/ui/kr/sonner-kr';

export interface TossPaymentsProps {
  clientKey: string;
  customerKey: string;
  orderId: string;
  orderName: string;
  amount: number;
  successUrl: string;
  failUrl: string;
  customerName?: string;
  customerEmail?: string;
  customerMobilePhone?: string;
  onSuccess?: (paymentKey: string) => void;
  onError?: (error: Error) => void;
}

export function TossPayments({
  clientKey,
  customerKey,
  orderId,
  orderName,
  amount,
  successUrl,
  failUrl,
  customerName,
  customerEmail,
  customerMobilePhone,
  onSuccess,
  onError,
}: TossPaymentsProps) {
  const [tossPayments, setTossPayments] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('card');
  const [isLoading, setIsLoading] = useState(false);
  const [easyPayProvider, setEasyPayProvider] = useState<string>('');
  const paymentWidgetRef = useRef<HTMLDivElement>(null);
  const agreementWidgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTossPayments(clientKey).then(setTossPayments);
  }, [clientKey]);

  useEffect(() => {
    if (tossPayments && paymentWidgetRef.current) {
      // 결제 위젯 렌더링
      const paymentWidget = tossPayments.widgets({
        customerKey,
      });

      // 결제 방법 위젯
      paymentWidget.setAmount({
        currency: 'KRW',
        value: amount,
      });

      paymentWidget.renderPaymentMethods(
        '#payment-widget',
        { value: amount },
        { variantKey: 'DEFAULT' }
      );

      // 이용약관 위젯
      paymentWidget.renderAgreement('#agreement-widget', { 
        variantKey: 'AGREEMENT' 
      });
    }
  }, [tossPayments, customerKey, amount]);

  const handlePayment = async () => {
    if (!tossPayments) {
      krToast.error('결제 시스템이 준비되지 않았습니다.');
      return;
    }

    setIsLoading(true);

    try {
      if (paymentMethod === 'card') {
        // 카드 결제
        await tossPayments.requestPayment('카드', {
          amount,
          orderId,
          orderName,
          customerName,
          customerEmail,
          customerMobilePhone,
          successUrl,
          failUrl,
        });
      } else if (paymentMethod === 'transfer') {
        // 계좌이체
        await tossPayments.requestPayment('계좌이체', {
          amount,
          orderId,
          orderName,
          customerName,
          customerEmail,
          customerMobilePhone,
          successUrl,
          failUrl,
          cashReceipt: {
            type: '소득공제',
          },
        });
      } else if (paymentMethod === 'virtualAccount') {
        // 가상계좌
        await tossPayments.requestPayment('가상계좌', {
          amount,
          orderId,
          orderName,
          customerName,
          customerEmail,
          customerMobilePhone,
          successUrl,
          failUrl,
          cashReceipt: {
            type: '소득공제',
          },
          validHours: 24,
        });
      } else if (paymentMethod === 'mobile') {
        // 휴대폰 결제
        await tossPayments.requestPayment('휴대폰', {
          amount,
          orderId,
          orderName,
          customerName,
          customerEmail,
          customerMobilePhone,
          successUrl,
          failUrl,
        });
      } else if (paymentMethod === 'easyPay') {
        // 간편결제
        await tossPayments.requestPayment(easyPayProvider, {
          amount,
          orderId,
          orderName,
          successUrl,
          failUrl,
        });
      }
    } catch (error) {
      console.error('결제 요청 실패:', error);
      krToast.error(error.message || '결제 요청에 실패했습니다.');
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>주문 정보</CardTitle>
          <CardDescription>결제할 상품 정보를 확인해주세요</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">상품명</span>
              <span className="font-medium">{orderName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">주문번호</span>
              <span className="font-mono text-sm">{orderId}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <span>총 결제금액</span>
              <span className="text-primary">{formatAmount(amount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>결제 수단 선택</CardTitle>
          <CardDescription>원하시는 결제 수단을 선택해주세요</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
            <div className="grid grid-cols-2 gap-4">
              <Label
                htmlFor="card"
                className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
              >
                <RadioGroupItem value="card" id="card" className="sr-only" />
                <CreditCard className="mb-2 h-6 w-6" />
                <span>신용/체크카드</span>
              </Label>

              <Label
                htmlFor="transfer"
                className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
              >
                <RadioGroupItem value="transfer" id="transfer" className="sr-only" />
                <Building className="mb-2 h-6 w-6" />
                <span>계좌이체</span>
              </Label>

              <Label
                htmlFor="virtualAccount"
                className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
              >
                <RadioGroupItem value="virtualAccount" id="virtualAccount" className="sr-only" />
                <Building className="mb-2 h-6 w-6" />
                <span>가상계좌</span>
              </Label>

              <Label
                htmlFor="mobile"
                className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
              >
                <RadioGroupItem value="mobile" id="mobile" className="sr-only" />
                <Smartphone className="mb-2 h-6 w-6" />
                <span>휴대폰 결제</span>
              </Label>
            </div>
          </RadioGroup>

          {paymentMethod === 'easyPay' && (
            <div className="mt-4">
              <Label>간편결제 서비스 선택</Label>
              <RadioGroup value={easyPayProvider} onValueChange={setEasyPayProvider}>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Label
                    htmlFor="tosspay"
                    className="flex items-center justify-center rounded-md border p-2 cursor-pointer [&:has([data-state=checked])]:border-primary"
                  >
                    <RadioGroupItem value="토스페이" id="tosspay" className="sr-only" />
                    <span className="text-sm">토스페이</span>
                  </Label>
                  <Label
                    htmlFor="naverpay"
                    className="flex items-center justify-center rounded-md border p-2 cursor-pointer [&:has([data-state=checked])]:border-primary"
                  >
                    <RadioGroupItem value="네이버페이" id="naverpay" className="sr-only" />
                    <span className="text-sm">네이버페이</span>
                  </Label>
                  <Label
                    htmlFor="kakaopay"
                    className="flex items-center justify-center rounded-md border p-2 cursor-pointer [&:has([data-state=checked])]:border-primary"
                  >
                    <RadioGroupItem value="카카오페이" id="kakaopay" className="sr-only" />
                    <span className="text-sm">카카오페이</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 토스 결제 위젯 영역 */}
      <div id="payment-widget" ref={paymentWidgetRef} />
      <div id="agreement-widget" ref={agreementWidgetRef} />

      <Button
        onClick={handlePayment}
        disabled={isLoading || !tossPayments}
        size="lg"
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            결제 처리 중...
          </>
        ) : (
          `${formatAmount(amount)} 결제하기`
        )}
      </Button>
    </div>
  );
}