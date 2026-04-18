import { Injectable, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

// ── Tipos mínimos de la API de Culqi ─────────────────────
export interface CulqiSubscription {
  id:         string;   // sbc_live_xxx
  plan_id:    string;
  status:     string;   // 'active' | 'canceled' | ...
  current_period_end: number; // unix timestamp
}

export interface CulqiCharge {
  id:          string;
  amount:      number;
  currency_code: string;
  metadata:    Record<string, string>;
}

/**
 * Documentación oficial: https://culqi.com/docs/api
 * Variables de entorno requeridas:
 *   CULQI_SECRET_KEY   = sk_live_xxx  (o sk_test_xxx en desarrollo)
 *   CULQI_PUBLIC_KEY   = pk_live_xxx  (usada solo en el frontend)
 *   CULQI_PLAN_ID      = pln_live_xxx (crear el plan en el dashboard de Culqi)
 *   CULQI_WEBHOOK_SECRET = tu clave de firma de webhooks (desde dashboard Culqi)
 */
@Injectable()
export class CulqiService {
  private readonly base    = 'https://api.culqi.com/v2';
  private readonly secret:  string;
  private readonly planId:  string;
  private readonly webhookSecret: string;

  constructor(private config: ConfigService) {
    this.secret        = config.get<string>('CULQI_SECRET_KEY', '');
    this.planId        = config.get<string>('CULQI_PLAN_ID',    '');
    this.webhookSecret = config.get<string>('CULQI_WEBHOOK_SECRET', '');
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.secret}`,
      'Content-Type':  'application/json',
    };
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json() as any;

    if (!res.ok) {
      throw new BadGatewayException(
        data?.user_message ?? data?.merchant_message ?? 'Error de Culqi',
      );
    }

    return data as T;
  }

  // ── Suscripciones ─────────────────────────────────────────

  /**
   * Crea una suscripción en Culqi.
   * tokenId viene del modal de Culqi.js en el frontend.
   * Culqi crea el customer internamente a partir del token.
   */
  async createSubscription(tokenId: string): Promise<CulqiSubscription> {
    return this.call<CulqiSubscription>('POST', '/subscriptions', {
      token_id: tokenId,
      plan_id:  this.planId,
    });
  }

  async cancelSubscription(culqiSubId: string): Promise<void> {
    await this.call('DELETE', `/subscriptions/${culqiSubId}`);
  }

  async getSubscription(culqiSubId: string): Promise<CulqiSubscription> {
    return this.call<CulqiSubscription>('GET', `/subscriptions/${culqiSubId}`);
  }

  // ── Webhooks ──────────────────────────────────────────────

  /**
   * Verifica la firma HMAC-SHA256 del webhook de Culqi.
   * Culqi envía la firma en el header 'x-culqi-signature'.
   * Verificar en: https://culqi.com/docs/api/webhooks
   */
  verifySignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) return false;
    const expected = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    return expected === signature;
  }
}
