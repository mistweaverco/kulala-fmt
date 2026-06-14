import type { Document } from './DocumentParser';
import { documentToHttp } from './DocumentSerializer';
import { kulalaCore } from '../kulala-core';

const build = async (
  document: Document,
  formatBody: boolean = true,
  filepath?: string,
): Promise<string> => {
  const content = documentToHttp(document);
  return kulalaCore.formatHttp(content, { formatBody, filepath });
};

export const DocumentBuilder = {
  build,
};
