export interface KulalaOperator {
  name: string;
  args?: string;
  commentStyle?: '#' | '//';
}

export interface KulalaComment {
  content: string;
}

export interface KulalaHeaderSectionEntry {
  type: 'header' | 'comment';
  name?: string;
  value?: string;
  comment?: KulalaComment;
}

export interface KulalaBlock {
  name: string;
  preamble: Array<KulalaOperator | KulalaComment>;
  comments: KulalaComment[];
  operators: KulalaOperator[];
  request: {
    method: string;
    url: string;
    headerSection: KulalaHeaderSectionEntry[];
    body?: string | object;
    sourceBodyText?: string;
  };
  preambleVariables?: Record<string, string>;
}

export interface KulalaParsedDocument {
  filepath?: string;
  variables?: Record<string, string | number | boolean>;
  fileHeaderVariables?: Record<string, string>;
  blocks: KulalaBlock[];
}
