# Operations Guide

## TLS Certificate Renewal

### How Replit manages TLS for custom domains

When a custom domain (e.g. `vega.synozur.com`) is added to a Replit deployment,
Replit automatically provisions a Let's Encrypt certificate and handles renewals
through its own infrastructure.  Auto-renewal fires approximately **30 days before
the current certificate expires**.

### Verifying renewal status

1. Open the [Replit Deployments dashboard](https://replit.com/deployments).
2. Select the **vega** deployment.
3. Navigate to **Settings → Custom Domains**.
4. Locate `vega.synozur.com` – the status badge shows whether the certificate is
   **Active**, **Pending**, or **Expired**.

The app also exposes a lightweight health endpoint that shows the live expiry
data from the TLS handshake:

```
GET /health/tls          (requires platform-admin login)
```

Example response (HTTP 200 when ≥ 30 days remain, HTTP 503 otherwise):

```json
{
  "domain": "vega.synozur.com",
  "expiresAt": "2025-09-01T12:00:00.000Z",
  "daysRemaining": 58,
  "status": "ok"
}
```

The startup log also prints the expiry date every time the server starts, so
it is visible in deployment logs without making a separate request.

### What to do if auto-renewal has not fired

If the certificate is within 30 days of expiry and the Replit dashboard shows
it has **not** been renewed:

1. **Re-verify the custom domain** in Replit Deployments → Custom Domains.
   Click the domain name and follow the "Verify" prompt.  This re-triggers the
   Let's Encrypt ACME challenge and forces Replit to issue a fresh certificate.
2. Wait up to 5 minutes for DNS propagation and certificate issuance to complete.
3. Confirm the new expiry date via `GET /health/tls` or by running:
   ```bash
   echo | openssl s_client -connect vega.synozur.com:443 -servername vega.synozur.com 2>/dev/null \
     | openssl x509 -noout -dates
   ```

If re-verification does not resolve the issue, contact **Replit Support** and
reference the deployment ID shown in the Replit Deployments dashboard.

### Monitoring thresholds

| Status     | Condition            | HTTP status from `/health/tls` |
|------------|----------------------|--------------------------------|
| `ok`       | ≥ 30 days remaining  | 200                            |
| `warning`  | 1 – 29 days remaining| 503                            |
| `critical` | 0 or fewer days      | 503                            |

Set up an external uptime monitor (e.g. UptimeRobot, Better Uptime) to poll
`/health/tls` (with an admin session cookie or internal network access) and
alert on non-200 responses for an automated early-warning system.
