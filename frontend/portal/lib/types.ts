export type ConsultMessagePayload = {
  msgText: string;
  msgType?: string;
  attachment?: {
    attachmentId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  } | null;
};

export type ConsultMessage = {
  id: string;
  convId: number;
  msgId: number;
  senderEmail?: string;
  receivedAt: string;
  payload: ConsultMessagePayload;
};

export type ConsultSummary = {
  id: string;
  convId: number;
  latestMsgId: number;
  senderEmail?: string;
  receivedAt: string;
  snippet: string;
  msgType?: string;
  messageCount: number;
};

export type ConsultDetail = ConsultMessage & {
  thread: ConsultMessage[];
};
