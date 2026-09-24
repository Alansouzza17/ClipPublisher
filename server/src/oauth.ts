import crypto from 'node:crypto';
import { google } from 'googleapis';
import { config } from './config.js';
import { saveTokens } from './security.js';

const states = new Map<string, { platform: string; expires: number }>();

const makeState = (platform: string) => {
  const s = crypto.randomBytes(32).toString('hex');
  states.set(s, {
    platform,
    expires: Date.now() + 600000,
  });
  return s;
};

export const verifyState = (s: string, p: string) => {
  const x = states.get(s);
  states.delete(s);
  return !!x && x.platform === p && x.expires > Date.now();
};

export function youtubeClient() {
  return new google.auth.OAuth2(
    config.google.id,
    config.google.secret,
    config.google.redirect
  );
}

export function youtubeAuthUrl() {
  const state = makeState('youtube');

  return youtubeClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/youtube.upload'],
    state,
  });
}

export async function youtubeCallback(code: string) {
  const c = youtubeClient();

  const { tokens } = await c.getToken(code);

  if (!tokens.access_token) {
    throw new Error('Google não retornou token de acesso.');
  }

  await saveTokens('youtube', {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || undefined,
    expiryDate: tokens.expiry_date || undefined,
  });
}

export function tiktokConfigError() {
  const { key, secret, redirect } = config.tiktok;

  if (!key || !secret) {
    return 'TIKTOK_CLIENT_KEY e TIKTOK_CLIENT_SECRET não estão configurados.';
  }

  if (!redirect) {
    return 'TIKTOK_REDIRECT_URI não está configurado.';
  }

  if (/your-domain\.example/i.test(redirect)) {
    return 'TIKTOK_REDIRECT_URI ainda contém o domínio de exemplo.';
  }

  try {
    const url = new URL(redirect);

    if (url.protocol !== 'https:') {
      return 'TIKTOK_REDIRECT_URI deve utilizar HTTPS.';
    }

    if (url.search || url.hash) {
      return 'TIKTOK_REDIRECT_URI não pode conter parâmetros.';
    }
  } catch {
    return 'TIKTOK_REDIRECT_URI inválida.';
  }

  return '';
}

export function tiktokAuthUrl() {
  const state = makeState('tiktok');

  const q = new URLSearchParams({
    client_key: config.tiktok.key,
    response_type: 'code',
    scope: 'video.publish',
    redirect_uri: config.tiktok.redirect,
    state,
  });

  return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
}

export async function tiktokCallback(code: string) {
  const response = await fetch(
    'https://open.tiktokapis.com/v2/oauth/token/',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: new URLSearchParams({
        client_key: config.tiktok.key,
        client_secret: config.tiktok.secret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.tiktok.redirect,
      }),
    }
  );

  const data: any = await response.json().catch(() => ({}));

  const error =
    typeof data.error === 'string'
      ? data.error
      : data.error?.code;

  if (
    !response.ok ||
    (error && error !== 'ok') ||
    !data.access_token
  ) {
    throw new Error(
      `TikTok recusou a troca do código (${error || response.status}): ${
        data.error_description ||
        data.error?.message ||
        data.message ||
        'Sem detalhes'
      }`
    );
  }

  await saveTokens('tiktok', {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiryDate: Date.now() + (data.expires_in || 0) * 1000,
  });
}