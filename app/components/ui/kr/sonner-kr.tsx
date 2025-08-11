/**
 * 한국화된 Sonner 토스트 컴포넌트
 * Sonner 토스트를 한국어 환경에 맞게 커스터마이징
 */

import { Toaster as Sonner } from 'sonner';
import { useTheme } from 'next-themes';

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function KrToaster({ ...props }: ToasterProps) {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}

/**
 * 한국어 토스트 메시지 사전 정의
 */
export const krToastMessages = {
  // 성공 메시지
  success: {
    default: '성공적으로 완료되었습니다.',
    save: '저장되었습니다.',
    update: '업데이트되었습니다.',
    delete: '삭제되었습니다.',
    copy: '클립보드에 복사되었습니다.',
    send: '전송되었습니다.',
    login: '로그인되었습니다.',
    logout: '로그아웃되었습니다.',
    register: '회원가입이 완료되었습니다.',
    upload: '업로드가 완료되었습니다.',
    download: '다운로드가 시작되었습니다.',
    payment: '결제가 완료되었습니다.',
    subscribe: '구독이 완료되었습니다.',
    unsubscribe: '구독이 취소되었습니다.',
  },
  
  // 오류 메시지
  error: {
    default: '오류가 발생했습니다. 다시 시도해주세요.',
    network: '네트워크 오류가 발생했습니다.',
    server: '서버 오류가 발생했습니다.',
    validation: '입력값을 확인해주세요.',
    auth: '인증에 실패했습니다.',
    permission: '권한이 없습니다.',
    notFound: '찾을 수 없습니다.',
    timeout: '요청 시간이 초과되었습니다.',
    fileSize: '파일 크기가 너무 큽니다.',
    fileType: '지원하지 않는 파일 형식입니다.',
    duplicate: '이미 존재합니다.',
    payment: '결제에 실패했습니다.',
    expired: '만료되었습니다.',
  },
  
  // 경고 메시지
  warning: {
    default: '주의해주세요.',
    unsaved: '저장되지 않은 변경사항이 있습니다.',
    delete: '삭제하면 복구할 수 없습니다.',
    logout: '로그아웃하면 저장되지 않은 작업이 손실됩니다.',
    maintenance: '서비스 점검 예정입니다.',
    lowBalance: '잔액이 부족합니다.',
    expiringSoon: '공 만료 예정입니다.',
    deprecated: '이 기능은 공 지원이 중단될 예정입니다.',
  },
  
  // 정보 메시지
  info: {
    default: '알려드립니다.',
    loading: '불러오는 중...',
    processing: '처리 중...',
    waiting: '대기 중...',
    new: '새로운 항목이 있습니다.',
    update: '업데이트가 있습니다.',
    maintenance: '서비스 점검 중입니다.',
  },
  
  // 액션 메시지
  action: {
    undo: '실행 취소',
    retry: '다시 시도',
    dismiss: '닫기',
    details: '자세히',
    confirm: '확인',
    cancel: '취소',
  },
};

/**
 * 한국어 토스트 헬퍼 함수
 */
import { toast } from 'sonner';

export const krToast = {
  success: (message?: string, options?: any) => {
    toast.success(message || krToastMessages.success.default, options);
  },
  
  error: (message?: string, options?: any) => {
    toast.error(message || krToastMessages.error.default, options);
  },
  
  warning: (message?: string, options?: any) => {
    toast.warning(message || krToastMessages.warning.default, options);
  },
  
  info: (message?: string, options?: any) => {
    toast.info(message || krToastMessages.info.default, options);
  },
  
  loading: (message?: string, options?: any) => {
    return toast.loading(message || krToastMessages.info.loading, options);
  },
  
  promise: <T,>(promise: Promise<T>, options: {
    loading?: string;
    success?: string | ((data: T) => string);
    error?: string | ((error: any) => string);
  }) => {
    return toast.promise(promise, {
      loading: options.loading || krToastMessages.info.processing,
      success: options.success || krToastMessages.success.default,
      error: options.error || krToastMessages.error.default,
    });
  },
  
  custom: (component: React.ReactNode, options?: any) => {
    return toast.custom(component, options);
  },
  
  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId);
  },
};

/**
 * 한국어 토스트 커스텀 컴포넌트
 */
interface KrToastActionProps {
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick: () => void;
  };
}

export function KrToastAction({
  title,
  description,
  action,
  cancel,
}: KrToastActionProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {(action || cancel) && (
        <div className="flex gap-2 mt-2">
          {cancel && (
            <button
              onClick={cancel.onClick}
              className="px-3 py-1 text-sm rounded-md bg-muted hover:bg-muted/80"
            >
              {cancel.label}
            </button>
          )}
          {action && (
            <button
              onClick={action.onClick}
              className="px-3 py-1 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/80"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}