import type { Block } from './DocumentParser';
import type { KulalaOAuth2PrivateConfig, KulalaOAuth2PublicConfig } from './BrunoEnvFiles';

export interface PostmanAuthEntry {
  key: string;
  value: string;
  type?: string;
}

export interface PostmanAuth {
  type: string;
  oauth2?: PostmanAuthEntry[];
  bearer?: PostmanAuthEntry[];
  basic?: PostmanAuthEntry[];
  apikey?: PostmanAuthEntry[];
}

export interface PostmanOAuth2Conversion {
  authId: string;
  publicConfig: KulalaOAuth2PublicConfig;
  privateConfig: KulalaOAuth2PrivateConfig;
}

const POSTMAN_GRANT_TYPES: Record<string, KulalaOAuth2PublicConfig['Grant Type']> = {
  authorization_code: 'Authorization Code',
  client_credentials: 'Client Credentials',
  password: 'Password',
  implicit: 'Implicit',
  device_code: 'Device Authorization',
};

const POSTMAN_DEFAULT_REDIRECT_URL = 'https://oauth.pstmn.io/v1/browser-callback';

export function authToMap(entries?: PostmanAuthEntry[]): Record<string, string> {
  if (!entries) return {};
  return Object.fromEntries(entries.map(({ key, value }) => [key, value]));
}

export function toAuthId(tokenName?: string): string {
  if (!tokenName) return 'default';

  const sanitized = tokenName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w.-]/g, '');

  return sanitized || 'default';
}

function inferGrantType(config: Record<string, string>): KulalaOAuth2PublicConfig['Grant Type'] {
  const grantType = config.grant_type;
  if (grantType && POSTMAN_GRANT_TYPES[grantType]) {
    return POSTMAN_GRANT_TYPES[grantType]!;
  }

  if (config.authUrl) return 'Authorization Code';
  if (config.accessTokenUrl) return 'Client Credentials';
  return 'Authorization Code';
}

function mapClientCredentials(clientAuthentication?: string): string {
  switch (clientAuthentication) {
    case 'body':
      return 'in body';
    case 'header':
      return 'basic';
    default:
      return 'basic';
  }
}

export function convertPostmanOAuth2(auth: PostmanAuth): PostmanOAuth2Conversion | null {
  if (auth.type !== 'oauth2') return null;

  const config = authToMap(auth.oauth2);
  const authId = toAuthId(config.tokenName);
  const grantType = inferGrantType(config);

  const publicConfig: KulalaOAuth2PublicConfig = {
    Type: 'OAuth2',
    'Grant Type': grantType,
    'Client ID': config.clientId ?? '',
  };

  if (config.authUrl) {
    publicConfig['Auth URL'] = config.authUrl;
  }

  if (config.accessTokenUrl) {
    publicConfig['Token URL'] = config.accessTokenUrl;
  }

  if (config.redirect_uri) {
    publicConfig['Redirect URL'] = config.redirect_uri;
  } else if (grantType === 'Authorization Code' || grantType === 'Implicit') {
    publicConfig['Redirect URL'] = POSTMAN_DEFAULT_REDIRECT_URL;
  }

  if (config.client_authentication) {
    publicConfig['Client Credentials'] = mapClientCredentials(config.client_authentication);
  } else if (config.clientSecret) {
    publicConfig['Client Credentials'] = 'in body';
  }

  if (config.scope) {
    publicConfig.Scope = config.scope;
  }

  if (config.username) {
    publicConfig.Username = config.username;
  }

  if (config.challengeAlgorithm && config.challengeAlgorithm !== 'Plain') {
    publicConfig.PKCE = {
      'Code Challenge Method':
        config.challengeAlgorithm === 'S256' ? 'SHA-256' : config.challengeAlgorithm,
    };
  }

  const privateConfig: KulalaOAuth2PrivateConfig = {};

  if (config.clientSecret) {
    privateConfig['Client Secret'] = config.clientSecret;
  }

  if (config.password) {
    privateConfig.Password = config.password;
  }

  return { authId, publicConfig, privateConfig };
}

export function applyPostmanAuth(block: Block, auth?: PostmanAuth): void {
  if (!auth || !block.request) return;

  const hasAuthHeader = block.request.headers.some(
    (header) => header.key.toLowerCase() === 'authorization',
  );

  switch (auth.type) {
    case 'oauth2': {
      const config = authToMap(auth.oauth2);
      const addTokenTo = config.addTokenTo || 'header';
      if (addTokenTo === 'header' && !hasAuthHeader) {
        const authId = toAuthId(config.tokenName);
        block.request.headers.push({
          key: 'Authorization',
          value: `Bearer {{ $auth.token("${authId}") }}`,
        });
      }
      break;
    }
    case 'bearer': {
      if (hasAuthHeader) break;
      const config = authToMap(auth.bearer);
      const token = config.token ?? '';
      block.request.headers.push({
        key: 'Authorization',
        value: `Bearer ${token}`,
      });
      break;
    }
    case 'basic': {
      if (hasAuthHeader) break;
      const config = authToMap(auth.basic);
      const username = config.username ?? '';
      const password = config.password ?? '';
      if (username.includes('{{') || password.includes('{{')) break;
      block.request.headers.push({
        key: 'Authorization',
        value: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      });
      break;
    }
    case 'apikey': {
      const config = authToMap(auth.apikey);
      const location = config.in || 'header';
      if (location !== 'header') break;
      const key = config.key || 'X-API-Key';
      const value = config.value ?? '';
      if (!block.request.headers.some((header) => header.key === key)) {
        block.request.headers.push({ key, value });
      }
      break;
    }
  }
}

export function extractTemplateVariables(...texts: Array<string | null | undefined>): Set<string> {
  const variables = new Set<string>();
  const pattern = /\{\{([^}]+)\}\}/g;

  for (const text of texts) {
    if (!text) continue;

    for (const match of text.matchAll(pattern)) {
      const name = match[1]?.trim();
      if (name && !name.startsWith('$')) {
        variables.add(name);
      }
    }
  }

  return variables;
}

export function collectAuthHeaderSecretVars(blocks: Block[]): Set<string> {
  const secretVars = new Set<string>();

  for (const block of blocks) {
    if (!block.request) continue;

    for (const header of block.request.headers) {
      if (header.key.toLowerCase() !== 'authorization') continue;

      for (const variable of extractTemplateVariables(header.value)) {
        secretVars.add(variable);
      }
    }
  }

  return secretVars;
}

export function collectBlockText(block: Block): string[] {
  const texts: string[] = [];

  if (block.request) {
    texts.push(block.request.url);
    for (const header of block.request.headers) {
      texts.push(header.value);
    }
    if (block.request.body) {
      texts.push(block.request.body);
    }
  }

  return texts;
}
