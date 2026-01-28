export type ConsultSummary = {
  id: string;
  senderEmail?: string;
  receivedAt: string;
  snippet: string;
  msgType: string;
};

export type ConsultDetail = ConsultSummary & {
  convId: number;
  msgId: number;
  payload: {
    msgText: string;
    msgType: string;
    attachment?: {
      attachmentId: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
    } | null;
  };
};
