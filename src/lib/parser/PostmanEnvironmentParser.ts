import type { BrunoEnvironment } from './BrunoEnvFiles';

export interface PostmanEnvironmentValue {
  key: string;
  value: string;
  type?: string;
  enabled?: boolean;
}

export interface PostmanEnvironment {
  id?: string;
  name: string;
  values: PostmanEnvironmentValue[];
}

export function isPostmanEnvironment(json: unknown): json is PostmanEnvironment {
  return (
    typeof json === 'object' &&
    json !== null &&
    'values' in json &&
    Array.isArray((json as PostmanEnvironment).values) &&
    !('item' in json)
  );
}

export function isPostmanCollection(json: unknown): boolean {
  return (
    typeof json === 'object' &&
    json !== null &&
    'item' in json &&
    Array.isArray((json as { item: unknown }).item)
  );
}

export function parsePostmanEnvironment(json: PostmanEnvironment): BrunoEnvironment[] {
  const vars: Record<string, string> = {};
  const secrets: Record<string, string> = {};

  for (const entry of json.values) {
    if (entry.enabled === false) continue;

    if (entry.type === 'secret') {
      secrets[entry.key] = entry.value;
    } else {
      vars[entry.key] = entry.value;
    }
  }

  return [
    {
      name: json.name || 'default',
      vars,
      secrets,
    },
  ];
}
