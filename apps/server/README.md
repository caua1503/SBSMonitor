# sbsmonitor

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## Metric alerts

The server can send a WhatsApp message when an agent reports CPU, RAM or disk
usage greater than or equal to the configured limits.

Configure these environment variables:

```bash
WHATSAPP_API_URL=http://localhost:8080
WHATSAPP_API_TOKEN=token-do-provedor
WHATSAPP_ALERT_GROUP_ID=id-do-grupo
ALERT_CPU_THRESHOLD_PCT=90
ALERT_MEMORY_THRESHOLD_PCT=90
ALERT_DISK_THRESHOLD_PCT=90
```

Alerts are sent once per agent and metric while the metric stays above the
limit. When the metric goes below the limit, the alert state is released without
sending a recovery message. If WhatsApp URL, token or group are missing, metric
collection continues normally and only notifications are disabled.

This project was created using `bun init` in bun v1.3.14. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
