import { QueryClient } from '@tanstack/react-query';
import { handleError } from '../utils/error-handler';

/**
 * React Query 클라이언트 설정
 * 
 * - 전역 에러 처리
 * - 재시도 전략
 * - 캐싱 정책
 * - 오프라인 모드 지원
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 탭 복귀 시 최신 상태를 항상 재검증
      refetchOnWindowFocus: 'always',

      // 네트워크 재연결 시 자동 재요청
      refetchOnReconnect: true,

      // 오프라인 시에도 캐시 데이터 사용
      networkMode: 'offlineFirst',

      // 실패 시 재시도 횟수
      retry: (failureCount, error) => {
        // 네트워크 에러는 최대 2번 재시도
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          return failureCount < 2;
        }
        // 4xx 에러는 재시도하지 않음
        if (error instanceof Error && 'statusCode' in error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode && statusCode >= 400 && statusCode < 500) {
            return false;
          }
        }
        // 그 외는 1번만 재시도
        return failureCount < 1;
      },

      // 재시도 지연 시간 (ms)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // 캐시 유지 시간 (5분)
      staleTime: 5 * 60 * 1000,

      // 캐시 가비지 컬렉션 시간 (10분)
      gcTime: 10 * 60 * 1000,

      // 전역 에러 핸들러
      throwOnError: false, // 에러를 throw하지 않고 onError로 처리
    },

    mutations: {
      // 전역 에러 핸들러
      onError: (error) => {
        handleError(error);
      },

      // 재시도 비활성화 (mutation은 보통 재시도하지 않음)
      retry: false,

      // 오프라인 시 mutation 대기
      networkMode: 'online',
    },
  },
});
