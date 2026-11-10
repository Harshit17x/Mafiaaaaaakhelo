import type { IceServerConfig } from '@midnight-city/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL?.trim() || '';

export async function fetchIceServers(): Promise<IceServerConfig[]> {
  try {
    const endpoint = SERVER_URL ? `${SERVER_URL}/api/ice-servers` : '/api/ice-servers';
    const response = await fetch(endpoint);
    if (response.ok) {
      const data = (await response.json()) as { iceServers?: IceServerConfig[] };
      if (Array.isArray(data.iceServers) && data.iceServers.length > 0) {
        return data.iceServers;
      }
    }
  } catch {
  }

  const fallback: IceServerConfig[] = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
      ],
    },
  ];

  const clientTurnUrl = import.meta.env.VITE_TURN_URL?.trim();
  if (clientTurnUrl) {
    fallback.push({
      urls: clientTurnUrl,
      username: import.meta.env.VITE_TURN_USERNAME?.trim() || undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL?.trim() || undefined,
    });
  }

  return fallback;
}

