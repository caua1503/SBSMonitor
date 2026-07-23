interface Env {
    WHATSAPP_API_URL: string;
    WHATSAPP_API_KEY: string;
    SERVER_URL: string;
}

export function validateEnv(): Env {
    const required = [
        "WHATSAPP_API_URL",
        "WHATSAPP_API_KEY",
        "SERVER_URL",
    ];
    for (const key of required) {
        if (!Bun.env[key]) throw new Error(`Missing required env var: ${key}`);
    }
    return {
        WHATSAPP_API_URL: String(Bun.env.WHATSAPP_API_URL),
        WHATSAPP_API_KEY: String(Bun.env.WHATSAPP_API_KEY),
        SERVER_URL: String(Bun.env.SERVER_URL),
    };
}

export const Env = validateEnv();
