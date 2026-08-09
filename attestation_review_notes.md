# M365 Publisher Attestation — Review Notes (Synozur Vega)

Companion to `attestation_completed.csv`. Answers fall into two groups: **verified from code** and **organizational assumption — please confirm before submitting**.

## ⚠️ Action required before submitting
- **AZUREAPPID** — paste your Azure app (client) ID from the Entra admin portal (App registrations → Vega → Application (client) ID). It is currently stored as the `AZURE_CLIENT_ID` secret and was intentionally not printed here.

## Verified from code
| Item | Answer | Rationale |
|---|---|---|
| DHP_G07 process customer data | TRUE | Server consumes Microsoft Graph (mail, calendar, files, Planner, groups). |
| DHP_G04 data collected | Profile/mail/calendar/files/Planner/Teams metadata | Matches OAuth scopes requested in `server/routes-entra.ts`. |
| DHP_G16 TLS 1.2+ | TRUE | Replit hosting, Azure AD, Microsoft Graph, and Neon Postgres all enforce TLS 1.2+. |
| DHP_G06 store customer data | TRUE | Graph tokens and synced content persisted in Postgres. |
| DHP_G05 data stored | Profiles, encrypted Graph OAuth tokens, OKRs, meeting notes, strategy docs, AI usage metadata, Planner metadata | From schema/storage layer. |
| DHP_G08 storage location | United States | Neon Postgres (US region) + Replit US hosting. |
| DHP_G09 retention/disposal | TRUE | Soft-delete with 30-day scheduled purge (`migrations/0005_soft_delete.sql`). |
| DHP_G10 access/secrets management | TRUE | Secrets in environment variables / Replit secrets manager; tokens encrypted at rest. |
| DHP_G11 transfer to sub-processors | TRUE | OpenAI, Anthropic, SendGrid, HubSpot, Google reCAPTCHA. |
| IDD01 / DHP_G01 / IDD19 | TRUE | Entra ID multi-tenant SSO via `@azure/msal-node`. |
| IDD02/IDD03 Conditional Access | TRUE | Standard authorization-code flow honors tenant CA policies (MFA, device compliance, location). |
| ZTR05 CAE | FALSE | No CAE claims-challenge handling in code. |
| ZTR06 credentials in code | FALSE | All credentials via environment secrets. |
| DHP21 additional MS APIs | FALSE | Microsoft Graph only (Planner/Outlook/OneDrive/SharePoint all via graph.microsoft.com); OTHERAPI marked NA. |
| PRV04 automated decision making | FALSE | AI assists drafting only; no legal-effect profiling. PRV05 left blank accordingly. |
| PRV07 sensitive categories | FALSE; PRV08 minors FALSE / PRV09 NA | Business productivity app; no such data collected. |
| PRV12 correct/update data | TRUE | Users can edit their profile. |
| GEN20 hosting environment | PaaS/Serverless | Replit + Neon (corrected from the pre-filled "Saas"). |
| SEC37 OWASP secure coding | TRUE | Documented threat model (`threat_model.md`) and secure-coding practices in repo. |

## Organizational assumption — please confirm
| Item | Default answer | Notes |
|---|---|---|
| LEG03 retention after account termination | Less than 30 days | Verified for *deleted content* (30-day purge). **Confirm** the same applies to full account/tenant termination. |
| DHP_G12 data sharing agreements | TRUE | Assumes standard provider DPAs (OpenAI, Anthropic, SendGrid, HubSpot, Google) are accepted/in place. |
| PRV06 secondary processing (marketing/analytics) | TRUE | Google Ads / Tag Manager on the marketing site. Ensure the privacy notice covers this. |
| PRV10 delete personal data on request | TRUE | Admin/tenant deletion cascades exist; **no self-service deletion endpoint** — requests handled manually. |
| PRV11 restrict processing on request | TRUE | Handled operationally, not via an in-app control. |
| PRV13 privacy reviews / DPIAs | TRUE | Confirm reviews are actually performed on a cadence. |
| GEN30_appInfoUrl | https://www.synozur.com | Replace with a dedicated Vega info page if one exists. |
| SEC28 annual pen testing | FALSE | Set TRUE only if you commission annual pen tests. |
| SEC26 disaster recovery plan | TRUE | Platform backups (Replit/Neon); confirm a documented DR plan exists. |
| SEC27 anti-malware | Application Controls | Platform-managed environment; no traditional AV agents. |
| SEC29–SEC31 vuln risk ranking / patch SLA / patching | TRUE | Assumes dependency updates are governed by an informal-but-followed policy. |
| SEC32 unsupported software | FALSE | Node/Postgres stacks current; confirm nothing EOL elsewhere. |
| SEC33 quarterly vulnerability scanning | TRUE | Dependency audits/scans; confirm cadence. |
| SEC34 firewall | TRUE | Provided by Replit/Neon platform boundary. |
| SEC35 change management | TRUE | Confirm a review/approval process for production changes. |
| SEC36 additional reviewer for all changes | FALSE | Conservative for a small team; set TRUE if PR review is mandatory. |
| SEC38 MFA coverage | Code Repositories, DNS Management, Credential/Key Stores | Confirm MFA is enforced on all three. |
| SEC39 employee account lifecycle | TRUE | Organizational process. |
| SEC40 IDPS | NA | Platform-managed network perimeter (Replit/Neon). |
| SEC41–SEC42 logging & review | TRUE | App/platform logs exist; confirm regular review. |
| SEC43 automated security alerts | FALSE | No automated alerting pipeline evidenced; set TRUE if configured. |
| SEC44–SEC46 risk mgmt / incident response / 72h breach notice | TRUE | Confirm documented processes exist. |
| CMP items | HIPAA NA, HITRUST NA, SOC 1/2/3 FALSE, PCI NA, ISO 27001 FALSE / 27018 / 27017 / 27002 NA, FedRAMP FALSE, FERPA/COPPA/SOX NA, NIST 800-171 NA, CSA STAR FALSE | No certifications evidenced; update if your organization holds any. |

Once you've confirmed the flagged items (and pasted the Azure app ID), the CSV is ready to submit.
