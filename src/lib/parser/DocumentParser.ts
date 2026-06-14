export interface Header {
  key: string;
  value: string;
}

interface Request {
  method: string;
  url: string;
  httpVersion: string;
  headers: Header[];
  body: string | null;
}

interface Metadata {
  key: string;
  value: string;
}

interface PreRequestScript {
  script: string;
  inline: boolean;
}

interface PostRequestScript {
  script: string;
  inline: boolean;
}

export interface Variable {
  key: string;
  value: string;
}

export interface BlockRequestSeparator {
  text: string | null;
}

export interface Block {
  requestSeparator: BlockRequestSeparator;
  metadata: Metadata[];
  comments: string[];
  variables?: Variable[];
  request: Request | null;
  preRequestScripts: PreRequestScript[];
  postRequestScripts: PostRequestScript[];
  responseRedirect: string | null;
}

export interface Document {
  variables: Variable[];
  blocks: Block[];
}
