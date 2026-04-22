import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getScanProgress } from '@/common/api/resources/scanProgress';

/**
 * 스캔 진행률 폴링 훅.
 * scanning=true일 때 500ms, false일 때 30초 간격으로 폴링한다.
 * 스캔 완료(scanning: true→false) 감지 시 관련 쿼리를 자동 갱신한다.
 */
export function useScanProgress() {
  const queryClient = useQueryClient();
  const wasScanning = useRef(false);

  const query = useQuery({
    queryKey: ['scan-progress'],
    queryFn: getScanProgress,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.scanning ? 500 : 30000;
    },
    staleTime: 1000,
  });

  const isScanning = query.data?.scanning ?? false;

  // 스캔 완료 감지: true → false 전환 시 관련 쿼리 갱신
  useEffect(() => {
    if (wasScanning.current && !isScanning) {
      void queryClient.invalidateQueries({ queryKey: ['config'] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['components'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
    wasScanning.current = isScanning;
  }, [isScanning, queryClient]);

  return {
    ...query,
    isScanning,
    projects: query.data?.projects ?? [],
  };
}
