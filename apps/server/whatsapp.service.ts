import { SERVER_CONFIG } from "./config.ts";

export class WhatsappService {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor() {
    let url = SERVER_CONFIG.WhatsappApiUrl ?? "";
    if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
      url = `http://${url}`;
    }
    this.apiUrl = url.replace(/\/+$/, "");
    this.apiKey = SERVER_CONFIG.WhatsappApiToken ?? "";
  }

  get isConfigured(): boolean {
    return this.apiUrl.length > 0 && this.apiKey.length > 0;
  }

  async sendMessage(to: string, message: string): Promise<unknown> {
    if (!this.isConfigured) {
      throw new Error("WhatsApp API URL or token is not configured");
    }

    console.log(`[WhatsappService] Enviando mensagem para ${to}`);

    const response = await fetch(`${this.apiUrl}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey,
      },
      body: JSON.stringify({
        number: to,
        text: message,
      }),
    });

    const contentType = response.headers.get("content-type") ?? "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      console.error(`[WhatsappService] Erro na API do WhatsApp: Status ${response.status}`, data);
      throw new Error(`WhatsApp API returned ${response.status}`);
    }

    return data;
  }
}
