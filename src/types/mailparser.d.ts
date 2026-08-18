declare module 'mailparser' {
  import { Readable } from 'stream';
  
  export interface Attachment {
    filename?: string;
    contentType?: string;
    content: Buffer;
    disposition?: string;
    related?: boolean;
    contentId?: string;
  }
  
  export interface ParsedMail {
    headers?: Record<string, string>;
    from?: { value: Array<{ address?: string; name?: string }> };
    to?: { value: Array<{ address?: string; name?: string }> };
    subject?: string;
    text?: string | Buffer;
    html?: string | Buffer;
    date?: Date;
    attachments?: Attachment[];
  }
  
  export function simpleParser(source: Buffer | string | Readable): Promise<ParsedMail>;
}
