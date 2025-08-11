// Prometheus 메트릭 엔드포인트

import type { LoaderFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { prometheusRegistry } from '../lib/monitoring/prometheus.server';

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Prometheus 메트릭 수집
    const metrics = await prometheusRegistry.metrics();
    
    return new globalThis.Response(metrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Metrics collection failed:', error);
    
    return new globalThis.Response('# Metrics unavailable', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }
};