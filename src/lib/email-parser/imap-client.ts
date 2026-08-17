import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { decrypt } from './crypto';

export interface EmailMessage {
  uid: number;
  subject: string;
  from: string;
  date: Date;
  html?: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    content: Buffer;
  }>;
}

export interface ImapConfig {
  user: string; // 邮箱地址
  host: string;
  port: number;
  password: string; // 加密后的密码
  ssl: boolean;
}

/**
 * 创建IMAP连接
 */
export function createImapConnection(config: ImapConfig): Imap {
  const password = decrypt(config.password);
  
  return new Imap({
    user: config.user,
    password,
    host: config.host,
    port: config.port,
    tls: config.ssl,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 30000,
    connTimeout: 30000,
  });
}

/**
 * 测试IMAP连接
 */
export function testImapConnection(config: ImapConfig): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const imap = createImapConnection(config);
    
    imap.once('ready', () => {
      imap.end();
      resolve(true);
    });
    
    imap.once('error', (err: Error) => {
      reject(err);
    });
    
    imap.connect();
  });
}

/**
 * 获取新邮件(基于UID增量获取)
 */
export function fetchNewEmails(
  imap: Imap,
  lastUid: string | null
): Promise<EmailMessage[]> {
  return new Promise((resolve, reject) => {
    const searchCriteria = lastUid ? ['UNSEEN', ['UID', `${lastUid}:*`]] : ['UNSEEN'];
    
    imap.search(searchCriteria, (err: any, results: number[]) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!results || results.length === 0) {
        resolve([]);
        return;
      }
      
      // 🚨 修复: 使用完整消息体获取，包括附件
      const fetchOptions = {
        bodies: ['HEADER', 'TEXT'],
        struct: true,
      };
      
      const f = imap.fetch(results, fetchOptions);
      const messages: EmailMessage[] = [];
      const messageBuffers: Map<number, Buffer> = new Map();
      
      f.on('message', (msg: any, seqno: number) => {
        const message: EmailMessage = {
          uid: 0,
          subject: '',
          from: '',
          date: new Date(),
          attachments: [],
        };
        
        let fullMessageBuffer = Buffer.alloc(0);
        
        msg.on('body', (stream: any, info: any) => {
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          stream.once('end', () => {
            const buffer = Buffer.concat(chunks);
            
            if (info.which === 'HEADER') {
              const header = Imap.parseHeader(buffer.toString('utf8'));
              message.subject = header.subject?.[0] || '';
              message.from = header.from?.[0] || '';
              message.date = new Date(header.date?.[0] || Date.now());
            } else if (info.which === 'TEXT') {
              // 🚨 保存完整消息体，后续用mailparser解析HTML和附件
              fullMessageBuffer = Buffer.concat([fullMessageBuffer, buffer]);
            }
          });
        });
        
        msg.on('attributes', (attrs: any) => {
          message.uid = attrs.uid;
        });
        
        msg.on('end', async () => {
          // 🚨 使用mailparser解析完整消息体，提取HTML和附件
          if (fullMessageBuffer.length > 0) {
            try {
              const parsed = await simpleParser(fullMessageBuffer);
              
              // 提取HTML正文
              if (parsed.html) {
                message.html = typeof parsed.html === 'string' ? parsed.html : parsed.html.toString();
              } else if (parsed.text) {
                // 如果没有HTML，使用纯文本
                message.html = typeof parsed.text === 'string' ? parsed.text : parsed.text.toString();
              }
              
              // 🚨 提取附件
              if (parsed.attachments && parsed.attachments.length > 0) {
                message.attachments = parsed.attachments.map((att: any) => ({
                  filename: att.filename || 'unknown',
                  contentType: att.contentType || 'application/octet-stream',
                  content: att.content, // Buffer
                }));
              }
            } catch (parseError) {
              console.error(`⚠️ 邮件 ${message.uid} 解析失败:`, parseError);
            }
          }
          
          messages.push(message);
        });
      });
      
      f.once('error', (err: Error) => {
        reject(err);
      });
      
      f.once('end', () => {
        resolve(messages);
      });
    });
  });
}

/**
 * 打开IMAP邮箱
 */
export function openInbox(imap: Imap): Promise<void> {
  return new Promise((resolve, reject) => {
    imap.openBox('INBOX', false, (err: Error) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
