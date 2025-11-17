import sgMail from '@sendgrid/mail';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }
  return {apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email};
}

export async function getUncachableSendGridClient() {
  const {apiKey, email} = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

const APP_URL = process.env.REPLIT_DEV_DOMAIN 
  ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
  : 'http://localhost:5000';

export async function sendVerificationEmail(to: string, verificationToken: string, userName?: string) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  
  const verificationUrl = `${APP_URL}/verify-email?token=${verificationToken}`;
  
  const msg = {
    to,
    from: fromEmail,
    subject: 'Verify Your Vega Account',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border-radius: 12px; border: 1px solid #2a2a2a;">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center;">
                      <h1 style="margin: 0; font-size: 32px; font-weight: 700; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                        Vega
                      </h1>
                      <p style="margin: 10px 0 0; font-size: 14px; color: #999999;">
                        AI-Augmented Company OS
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #ffffff;">
                        Welcome${userName ? `, ${userName}` : ''}!
                      </h2>
                      
                      <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #cccccc;">
                        Thank you for creating your Vega account. To get started, please verify your email address by clicking the button below:
                      </p>
                      
                      <!-- CTA Button -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
                        <tr>
                          <td style="border-radius: 8px; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%);">
                            <a href="${verificationUrl}" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                              Verify Email Address
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #999999;">
                        Or copy and paste this link into your browser:<br>
                        <a href="${verificationUrl}" style="color: #810FFB; text-decoration: none; word-break: break-all;">
                          ${verificationUrl}
                        </a>
                      </p>
                      
                      <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #999999;">
                        This verification link will expire in 24 hours for security purposes.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; border-top: 1px solid #2a2a2a;">
                      <p style="margin: 0; font-size: 12px; color: #666666; text-align: center;">
                        If you didn't create a Vega account, you can safely ignore this email.
                      </p>
                      <p style="margin: 10px 0 0; font-size: 12px; color: #666666; text-align: center;">
                        © ${new Date().getFullYear()} Synozur Alliance LLC. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `Welcome${userName ? `, ${userName}` : ''}!\n\nThank you for creating your Vega account. Please verify your email address by visiting:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you didn't create a Vega account, you can safely ignore this email.`
  };
  
  await client.send(msg);
}

export async function sendPasswordResetEmail(to: string, resetToken: string, userName?: string) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;
  
  const msg = {
    to,
    from: fromEmail,
    subject: 'Reset Your Vega Password',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border-radius: 12px; border: 1px solid #2a2a2a;">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center;">
                      <h1 style="margin: 0; font-size: 32px; font-weight: 700; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                        Vega
                      </h1>
                      <p style="margin: 10px 0 0; font-size: 14px; color: #999999;">
                        AI-Augmented Company OS
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #ffffff;">
                        Password Reset Request
                      </h2>
                      
                      <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #cccccc;">
                        ${userName ? `Hi ${userName}, we` : 'We'} received a request to reset your Vega password. Click the button below to create a new password:
                      </p>
                      
                      <!-- CTA Button -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
                        <tr>
                          <td style="border-radius: 8px; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%);">
                            <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #999999;">
                        Or copy and paste this link into your browser:<br>
                        <a href="${resetUrl}" style="color: #810FFB; text-decoration: none; word-break: break-all;">
                          ${resetUrl}
                        </a>
                      </p>
                      
                      <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #999999;">
                        This password reset link will expire in 1 hour for security purposes.
                      </p>
                      
                      <div style="margin: 30px 0 0; padding: 20px; background-color: rgba(230, 12, 179, 0.1); border-left: 4px solid #E60CB3; border-radius: 4px;">
                        <p style="margin: 0; font-size: 14px; color: #cccccc;">
                          <strong>Security Note:</strong> If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                        </p>
                      </div>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; border-top: 1px solid #2a2a2a;">
                      <p style="margin: 0; font-size: 12px; color: #666666; text-align: center;">
                        This is an automated message. Please do not reply to this email.
                      </p>
                      <p style="margin: 10px 0 0; font-size: 12px; color: #666666; text-align: center;">
                        © ${new Date().getFullYear()} Synozur Alliance LLC. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `Password Reset Request\n\n${userName ? `Hi ${userName}, we` : 'We'} received a request to reset your Vega password. Visit the following link to create a new password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request a password reset, you can safely ignore this email.`
  };
  
  await client.send(msg);
}

export function generateVerificationToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function generateResetToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
}
