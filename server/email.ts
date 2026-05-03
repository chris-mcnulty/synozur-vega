import sgMail from '@sendgrid/mail';
import crypto from 'crypto';

let connectionSettings: any;
let cachedCredentials: { apiKey: string; email: string } | null = null;

async function getCredentials(): Promise<{ apiKey: string; email: string }> {
  // Return cached credentials if available
  if (cachedCredentials) {
    return cachedCredentials;
  }

  // First, check for standard environment variables (works in production)
  const envApiKey = process.env.SENDGRID_API_KEY;
  const envFromEmail = process.env.SENDGRID_FROM_EMAIL;
  
  if (envApiKey && envFromEmail) {
    console.log('[Email] Using SendGrid credentials from environment variables');
    cachedCredentials = { apiKey: envApiKey, email: envFromEmail };
    return cachedCredentials;
  }

  // Fall back to Replit connector (works in development)
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!hostname || !xReplitToken) {
    throw new Error('SendGrid not configured. Please set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL environment variables, or connect SendGrid via Replit connector.');
  }

  try {
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
      throw new Error('SendGrid not connected via Replit connector');
    }
    
    console.log('[Email] Using SendGrid credentials from Replit connector');
    cachedCredentials = { apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email };
    return cachedCredentials;
  } catch (error) {
    console.error('[Email] Failed to get SendGrid credentials:', error);
    throw new Error('SendGrid not configured. Please set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL environment variables for production.');
  }
}

export async function getUncachableSendGridClient() {
  const {apiKey, email} = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

// Use REPLIT_DEV_DOMAIN for development, AZURE_BASE_URL for production
const getAppUrl = () => {
  // In development, prefer REPLIT_DEV_DOMAIN so verification links work in dev
  if (process.env.NODE_ENV === 'development' && process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  // In production, use AZURE_BASE_URL
  if (process.env.AZURE_BASE_URL) {
    return process.env.AZURE_BASE_URL;
  }
  // Fallback
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return 'http://localhost:5000';
};

const APP_URL = getAppUrl();


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
                    <td style="padding: 30px 40px; border-top: 1px solid #2a2a2a; text-align: center;">
                      <p style="margin: 0 0 15px; font-size: 14px; font-weight: 600; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                        Vega Company OS
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #666666;">
                        If you didn't create a Vega account, you can safely ignore this email.
                      </p>
                      <p style="margin: 10px 0 0; font-size: 12px; color: #666666;">
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
                    <td style="padding: 30px 40px; border-top: 1px solid #2a2a2a; text-align: center;">
                      <p style="margin: 0 0 15px; font-size: 14px; font-weight: 600; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                        Vega Company OS
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #666666;">
                        This is an automated message. Please do not reply to this email.
                      </p>
                      <p style="margin: 10px 0 0; font-size: 12px; color: #666666;">
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

export async function sendWelcomeEmail(to: string, userName?: string, organizationName?: string) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  
  const loginUrl = `${APP_URL}/login`;
  const userGuideUrl = `${APP_URL}/help`;
  
  const msg = {
    to,
    from: fromEmail,
    subject: `Welcome to Vega${organizationName ? ` - ${organizationName}` : ''}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Vega</title>
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
                        Your account has been created${organizationName ? ` for <strong>${organizationName}</strong>` : ''}. You can now access Vega to manage your organization's strategy, OKRs, and focus rhythm.
                      </p>
                      
                      <!-- CTA Button -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
                        <tr>
                          <td style="border-radius: 8px; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%);">
                            <a href="${loginUrl}" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                              Sign In to Vega
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <div style="margin: 30px 0; padding: 20px; background-color: rgba(129, 15, 251, 0.1); border-radius: 8px;">
                        <h3 style="margin: 0 0 10px; font-size: 16px; font-weight: 600; color: #ffffff;">
                          Getting Started
                        </h3>
                        <p style="margin: 0 0 15px; font-size: 14px; line-height: 1.6; color: #cccccc;">
                          Check out our User Guide to learn how to make the most of Vega:
                        </p>
                        <a href="${userGuideUrl}" style="display: inline-block; padding: 10px 20px; font-size: 14px; font-weight: 500; color: #810FFB; text-decoration: none; border: 1px solid #810FFB; border-radius: 6px;">
                          View User Guide
                        </a>
                      </div>
                      
                      <div style="margin: 30px 0; padding: 20px; background-color: rgba(230, 12, 179, 0.1); border-radius: 8px;">
                        <h3 style="margin: 0 0 10px; font-size: 16px; font-weight: 600; color: #ffffff;">
                          Learn About Company OS
                        </h3>
                        <p style="margin: 0 0 15px; font-size: 14px; line-height: 1.6; color: #cccccc;">
                          Want to understand how a Company Operating System can transform your organization?
                        </p>
                        <a href="https://www.synozur.com/solutions/company-os" style="display: inline-block; padding: 10px 20px; font-size: 14px; font-weight: 500; color: #E60CB3; text-decoration: none; border: 1px solid #E60CB3; border-radius: 6px;">
                          Learn More
                        </a>
                      </div>
                      
                      <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #999999;">
                        If you have any questions, reach out to your administrator or consultant.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; border-top: 1px solid #2a2a2a; text-align: center;">
                      <p style="margin: 0 0 15px; font-size: 14px; font-weight: 600; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                        Vega Company OS
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #666666;">
                        This is an automated welcome message.
                      </p>
                      <p style="margin: 10px 0 0; font-size: 12px; color: #666666;">
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
    text: `Welcome${userName ? `, ${userName}` : ''}!\n\nYour Vega account has been created${organizationName ? ` for ${organizationName}` : ''}.\n\nSign in at: ${loginUrl}\n\nCheck out our User Guide to get started: ${userGuideUrl}\n\nLearn more about Company OS and how it can transform your organization: https://www.synozur.com/solutions/company-os\n\nIf you have any questions, reach out to your administrator or consultant.`
  };
  
  await client.send(msg);
}

// Send welcome email with license information for self-service signups
export async function sendSelfServiceWelcomeEmail(
  to: string, 
  userName: string, 
  organizationName: string, 
  servicePlan: { displayName: string; durationDays: number | null; maxReadWriteUsers: number | null }
) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  
  const loginUrl = `${APP_URL}/login`;
  const expiresText = servicePlan.durationDays 
    ? `Your ${servicePlan.displayName} plan is valid for ${servicePlan.durationDays} days.`
    : 'Your plan has no expiration date.';
  const usersText = servicePlan.maxReadWriteUsers 
    ? `You can have up to ${servicePlan.maxReadWriteUsers} read/write user${servicePlan.maxReadWriteUsers > 1 ? 's' : ''}.`
    : 'You have unlimited users available.';

  const msg = {
    to,
    from: fromEmail,
    subject: `Welcome to Vega - Your ${servicePlan.displayName} Plan is Active`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border-radius: 12px; border: 1px solid #2a2a2a;">
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center;">
                      <h1 style="margin: 0; font-size: 32px; font-weight: 700; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Vega</h1>
                      <p style="margin: 10px 0 0; font-size: 14px; color: #999999;">AI-Augmented Company OS</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #ffffff;">Welcome to Vega, ${userName}!</h2>
                      
                      <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #cccccc;">
                        Your organization <strong>${organizationName}</strong> has been created and your <strong>${servicePlan.displayName}</strong> plan is now active.
                      </p>
                      
                      <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px; font-size: 18px; color: #ffffff;">Your Plan Details</h3>
                        <p style="margin: 0 0 10px; font-size: 14px; color: #cccccc;">• ${expiresText}</p>
                        <p style="margin: 0; font-size: 14px; color: #cccccc;">• ${usersText}</p>
                      </div>
                      
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
                        <tr>
                          <td style="border-radius: 8px; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%);">
                            <a href="${loginUrl}" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                              Get Started
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <div style="margin: 30px 0; padding: 20px; background-color: rgba(129, 15, 251, 0.1); border-radius: 8px;">
                        <h3 style="margin: 0 0 10px; font-size: 16px; font-weight: 600; color: #ffffff;">
                          Getting Started
                        </h3>
                        <p style="margin: 0 0 15px; font-size: 14px; line-height: 1.6; color: #cccccc;">
                          Check out our User Guide to learn how to make the most of Vega:
                        </p>
                        <a href="${APP_URL}/help" style="display: inline-block; padding: 10px 20px; font-size: 14px; font-weight: 500; color: #810FFB; text-decoration: none; border: 1px solid #810FFB; border-radius: 6px;">
                          View User Guide
                        </a>
                      </div>
                      
                      <div style="margin: 30px 0; padding: 20px; background-color: rgba(230, 12, 179, 0.1); border-radius: 8px;">
                        <h3 style="margin: 0 0 10px; font-size: 16px; font-weight: 600; color: #ffffff;">
                          Learn About Company OS
                        </h3>
                        <p style="margin: 0 0 15px; font-size: 14px; line-height: 1.6; color: #cccccc;">
                          Want to understand how a Company Operating System can transform your organization?
                        </p>
                        <a href="https://www.synozur.com/solutions/company-os" style="display: inline-block; padding: 10px 20px; font-size: 14px; font-weight: 500; color: #E60CB3; text-decoration: none; border: 1px solid #E60CB3; border-radius: 6px;">
                          Learn More
                        </a>
                      </div>
                      
                      <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 14px; color: #cccccc;">
                          <strong>Need to extend your plan or add more users?</strong><br>
                          Contact us at <a href="mailto:vega@synozur.com" style="color: #810FFB;">vega@synozur.com</a>
                        </p>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px 40px; border-top: 1px solid #2a2a2a; text-align: center;">
                      <p style="margin: 0 0 15px; font-size: 14px; font-weight: 600; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                        Vega Company OS
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #666666;">© ${new Date().getFullYear()} Synozur Alliance LLC. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `Welcome to Vega, ${userName}!\n\nYour organization ${organizationName} has been created and your ${servicePlan.displayName} plan is now active.\n\nPlan Details:\n• ${expiresText}\n• ${usersText}\n\nGet started: ${loginUrl}\n\nGetting Started:\nCheck out our User Guide to learn how to make the most of Vega: ${APP_URL}/help\n\nLearn About Company OS:\nWant to understand how a Company Operating System can transform your organization? Visit: https://www.synozur.com/solutions/company-os\n\nNeed to extend your plan or add more users? Contact us at vega@synozur.com`
  };
  
  await client.send(msg);
}

// Send plan expiration reminder email
export async function sendPlanExpirationReminderEmail(
  to: string,
  userName: string,
  organizationName: string,
  planName: string,
  daysRemaining: number,
  expirationDate: Date
) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  
  const urgencyText = daysRemaining === 0 
    ? 'Your plan expires TODAY!'
    : daysRemaining === 1 
    ? 'Your plan expires TOMORROW!'
    : `Your plan expires in ${daysRemaining} days.`;

  const msg = {
    to,
    from: fromEmail,
    subject: `[Action Required] Your Vega ${planName} Plan ${daysRemaining === 0 ? 'Expires Today' : `Expires in ${daysRemaining} Day${daysRemaining > 1 ? 's' : ''}`}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border-radius: 12px; border: 1px solid #2a2a2a;">
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center;">
                      <h1 style="margin: 0; font-size: 32px; font-weight: 700; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Vega</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      <div style="background: ${daysRemaining <= 3 ? '#4a1111' : '#1a1a1a'}; border: 1px solid ${daysRemaining <= 3 ? '#8b2222' : '#2a2a2a'}; border-radius: 8px; padding: 20px; margin: 0 0 20px; text-align: center;">
                        <h2 style="margin: 0; font-size: 20px; color: ${daysRemaining <= 3 ? '#ff6b6b' : '#ffffff'};">${urgencyText}</h2>
                      </div>
                      
                      <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #cccccc;">
                        Hi ${userName},
                      </p>
                      
                      <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #cccccc;">
                        Your <strong>${planName}</strong> plan for <strong>${organizationName}</strong> will expire on <strong>${expirationDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>.
                      </p>
                      
                      <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #cccccc;">
                        To continue using Vega without interruption, please contact us to extend your plan or upgrade to a higher tier.
                      </p>
                      
                      <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                        <p style="margin: 0 0 10px; font-size: 16px; color: #ffffff;"><strong>Contact us to extend or upgrade:</strong></p>
                        <a href="mailto:vega@synozur.com" style="display: inline-block; padding: 12px 30px; font-size: 16px; font-weight: 600; color: #ffffff; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); text-decoration: none; border-radius: 8px;">
                          vega@synozur.com
                        </a>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px 40px; border-top: 1px solid #2a2a2a; text-align: center;">
                      <p style="margin: 0 0 15px; font-size: 14px; font-weight: 600; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                        Vega Company OS
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #666666;">© ${new Date().getFullYear()} Synozur Alliance LLC. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `${urgencyText}\n\nHi ${userName},\n\nYour ${planName} plan for ${organizationName} will expire on ${expirationDate.toLocaleDateString()}.\n\nTo continue using Vega without interruption, please contact us to extend your plan or upgrade.\n\nContact: vega@synozur.com`
  };
  
  await client.send(msg);
}

// Send job failure notification email to admins
export async function sendJobFailureNotificationEmail(
  to: string,
  jobName: string,
  jobDisplayName: string,
  errorMessage: string,
  errorStack: string | null,
  failedAt: Date
) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  
  const adminUrl = `${APP_URL}/system-admin`;
  const failedAtStr = failedAt.toISOString().replace('T', ' ').split('.')[0] + ' UTC';
  
  const msg = {
    to,
    from: fromEmail,
    subject: `[Alert] Scheduled Job Failed: ${jobDisplayName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border-radius: 12px; border: 1px solid #dc2626;">
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center;">
                      <h1 style="margin: 0; font-size: 32px; font-weight: 700; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Vega</h1>
                      <p style="margin: 10px 0 0; font-size: 14px; color: #999999;">System Alert</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      <div style="background: rgba(220, 38, 38, 0.1); border: 1px solid #dc2626; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                        <h2 style="margin: 0 0 10px; font-size: 20px; font-weight: 600; color: #dc2626;">
                          Scheduled Job Failed
                        </h2>
                        <p style="margin: 0; font-size: 14px; color: #cccccc;">
                          A background job encountered an error and failed to complete.
                        </p>
                      </div>
                      
                      <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px; font-size: 16px; color: #ffffff;">Job Details</h3>
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0; font-size: 14px; color: #999999; width: 120px;">Job Name:</td>
                            <td style="padding: 8px 0; font-size: 14px; color: #ffffff; font-weight: 500;">${jobDisplayName}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; font-size: 14px; color: #999999;">Job ID:</td>
                            <td style="padding: 8px 0; font-size: 14px; color: #cccccc; font-family: monospace;">${jobName}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; font-size: 14px; color: #999999;">Failed At:</td>
                            <td style="padding: 8px 0; font-size: 14px; color: #cccccc;">${failedAtStr}</td>
                          </tr>
                        </table>
                      </div>
                      
                      <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px; font-size: 16px; color: #dc2626;">Error Message</h3>
                        <p style="margin: 0; font-size: 14px; color: #ffffff; font-family: monospace; word-break: break-word; white-space: pre-wrap;">${errorMessage}</p>
                      </div>
                      
                      ${errorStack ? `
                      <details style="margin: 20px 0;">
                        <summary style="cursor: pointer; font-size: 14px; color: #999999; margin-bottom: 10px;">View Stack Trace</summary>
                        <div style="background: #0a0a0a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 15px; overflow-x: auto;">
                          <pre style="margin: 0; font-size: 12px; color: #999999; white-space: pre-wrap; word-break: break-word;">${errorStack}</pre>
                        </div>
                      </details>
                      ` : ''}
                      
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 30px 0;">
                        <tr>
                          <td style="border-radius: 8px; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%);">
                            <a href="${adminUrl}" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                              View Job Dashboard
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 20px 0 0; font-size: 14px; color: #999999;">
                        This is an automated system alert. Please investigate the issue at your earliest convenience.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px 40px; border-top: 1px solid #2a2a2a; text-align: center;">
                      <p style="margin: 0; font-size: 12px; color: #666666;">© ${new Date().getFullYear()} Synozur Alliance LLC. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `SCHEDULED JOB FAILED\n\nJob Name: ${jobDisplayName}\nJob ID: ${jobName}\nFailed At: ${failedAtStr}\n\nError Message:\n${errorMessage}\n\n${errorStack ? `Stack Trace:\n${errorStack}\n\n` : ''}View the job dashboard: ${adminUrl}\n\nThis is an automated system alert. Please investigate the issue at your earliest convenience.`
  };
  
  await client.send(msg);
}

export async function sendReassignmentEmail(
  to: string,
  recipientName: string,
  options: {
    role: 'recipient' | 'previous-owner';
    fromUserName: string;
    fromUserEmail: string;
    toUserName: string;
    toUserEmail: string;
    performedByName: string;
    counts: {
      objectivesPrimary: number;
      objectivesCoOwner: number;
      objectivesCheckIn: number;
      keyResults: number;
      bigRocksOwner: number;
      bigRocksAccountable: number;
      ambitions: number;
      strategies: number;
      meetingsFacilitator: number;
      meetingsAttendee: number;
      supportTickets: number;
      total: number;
    };
  }
) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  const dashboardUrl = `${APP_URL}/dashboard`;
  const { role, fromUserName, fromUserEmail, toUserName, toUserEmail, performedByName, counts } = options;

  const escapeHtml = (s: string) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const isRecipient = role === 'recipient';
  const fromDisplay = fromUserName || fromUserEmail;
  const toDisplay = toUserName || toUserEmail;
  const subject = isRecipient
    ? `You've been assigned items previously owned by ${fromDisplay}`
    : `Items previously owned by you have been reassigned to ${toDisplay}`;
  const heading = isRecipient ? 'Items Transferred to You' : 'Your Items Were Reassigned';
  const introHtml = isRecipient
    ? `${escapeHtml(performedByName)} reassigned the following items from <strong>${escapeHtml(fromDisplay)}</strong> to you.`
    : `${escapeHtml(performedByName)} reassigned the following items from you to <strong>${escapeHtml(toDisplay)}</strong>.`;

  const rows: Array<[string, number]> = [
    ['Objectives (owner)', counts.objectivesPrimary],
    ['Objectives (co-owner)', counts.objectivesCoOwner],
    ['Objectives (check-in owner)', counts.objectivesCheckIn],
    ['Key Results', counts.keyResults],
    ['Big Rocks (owner)', counts.bigRocksOwner],
    ['Big Rocks (accountable)', counts.bigRocksAccountable],
    ['Ambitions', counts.ambitions],
    ['Strategies', counts.strategies],
    ['Meetings (facilitator)', counts.meetingsFacilitator],
    ['Meetings (attendee)', counts.meetingsAttendee],
    ['Support Tickets', counts.supportTickets],
  ].filter(([, n]) => (n as number) > 0) as Array<[string, number]>;

  const tableRows = rows
    .map(
      ([label, n]) =>
        `<tr><td style="padding: 8px 12px; font-size: 13px; color: #b0b0b0; border-bottom: 1px solid #2a2a2a;">${escapeHtml(label)}</td><td style="padding: 8px 12px; font-size: 13px; color: #e0e0e0; border-bottom: 1px solid #2a2a2a; text-align: right;">${n}</td></tr>`
    )
    .join('');

  const textRows = rows.map(([label, n]) => `  ${label}: ${n}`).join('\n');

  const msg = {
    to,
    from: fromEmail,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
                  <tr>
                    <td style="padding: 30px 40px; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);">
                      <h1 style="margin: 0; font-size: 22px; color: #ffffff;">${heading}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px 40px;">
                      <p style="margin: 0 0 16px; font-size: 15px; color: #e0e0e0;">Hi ${escapeHtml(recipientName || 'there')},</p>
                      <p style="margin: 0 0 20px; font-size: 14px; color: #b0b0b0;">${introHtml}</p>
                      <p style="margin: 0 0 8px; font-size: 13px; color: #888;">Items transferred:</p>
                      <table style="width: 100%; border-collapse: collapse; margin: 0 0 24px;">${tableRows}
                        <tr><td style="padding: 10px 12px; font-size: 13px; color: #ffffff; font-weight: 600;">Total</td><td style="padding: 10px 12px; font-size: 13px; color: #ffffff; font-weight: 600; text-align: right;">${counts.total}</td></tr>
                      </table>
                      <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px;">Open Vega</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 40px; border-top: 1px solid #2a2a2a; text-align: center;">
                      <p style="margin: 0; font-size: 12px; color: #666666;">&copy; ${new Date().getFullYear()} Synozur Alliance LLC. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `${heading}\n\nHi ${recipientName || 'there'},\n\n${
      isRecipient
        ? `${performedByName} reassigned items from ${fromUserName || fromUserEmail} to you.`
        : `${performedByName} reassigned your items to ${toUserName || toUserEmail}.`
    }\n\nItems transferred:\n${textRows}\n  Total: ${counts.total}\n\nOpen Vega: ${dashboardUrl}`,
  };

  await client.send(msg);
}

export async function sendSupportTicketAcknowledgement(
  to: string,
  userName: string,
  ticketNumber: number,
  subject: string,
  category: string,
  priority: string
) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  const ticketUrl = `${APP_URL}/support`;
  
  const msg = {
    to,
    from: fromEmail,
    subject: `Vega Support Ticket #${ticketNumber} - We've received your request`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
                  <tr>
                    <td style="padding: 30px 40px; background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);">
                      <h1 style="margin: 0; font-size: 24px; color: #ffffff;">Support Ticket Received</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px 40px;">
                      <p style="margin: 0 0 20px; font-size: 16px; color: #e0e0e0;">Hi ${userName || 'there'},</p>
                      <p style="margin: 0 0 20px; font-size: 14px; color: #b0b0b0;">Thank you for contacting Vega Support. We've received your ${category.replace('_', ' ')} and a member of our team will review it shortly.</p>
                      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                        <tr><td style="padding: 8px 12px; font-size: 13px; color: #888; border-bottom: 1px solid #333;">Ticket #</td><td style="padding: 8px 12px; font-size: 13px; color: #e0e0e0; border-bottom: 1px solid #333;">${ticketNumber}</td></tr>
                        <tr><td style="padding: 8px 12px; font-size: 13px; color: #888; border-bottom: 1px solid #333;">Subject</td><td style="padding: 8px 12px; font-size: 13px; color: #e0e0e0; border-bottom: 1px solid #333;">${subject}</td></tr>
                        <tr><td style="padding: 8px 12px; font-size: 13px; color: #888; border-bottom: 1px solid #333;">Priority</td><td style="padding: 8px 12px; font-size: 13px; color: #e0e0e0; border-bottom: 1px solid #333;">${priority}</td></tr>
                        <tr><td style="padding: 8px 12px; font-size: 13px; color: #888;">Status</td><td style="padding: 8px 12px; font-size: 13px; color: #e0e0e0;">Open</td></tr>
                      </table>
                      <p style="margin: 0 0 20px; font-size: 14px; color: #b0b0b0;">You can track your ticket status in Vega:</p>
                      <a href="${ticketUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px;">View My Tickets</a>
                      <p style="margin: 20px 0 0; font-size: 13px; color: #888;">We typically respond within 1 business day.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 40px; border-top: 1px solid #2a2a2a; text-align: center;">
                      <p style="margin: 0; font-size: 12px; color: #666666;">&copy; ${new Date().getFullYear()} Synozur Alliance LLC. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `Hi ${userName || 'there'},\n\nThank you for contacting Vega Support. We've received your ${category.replace('_', ' ')}.\n\nTicket #: ${ticketNumber}\nSubject: ${subject}\nPriority: ${priority}\nStatus: Open\n\nYou can track your ticket: ${ticketUrl}\n\nWe typically respond within 1 business day.\n\nThe Vega Team`
  };
  
  await client.send(msg);
}

export async function sendSupportTicketInternalNotification(
  to: string,
  ticketNumber: number,
  userName: string,
  userEmail: string,
  tenantName: string,
  category: string,
  priority: string,
  subject: string,
  description: string
) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  const adminUrl = `${APP_URL}/system-admin?tab=support`;
  
  const msg = {
    to,
    from: fromEmail,
    subject: `[Vega Support] New ${priority} ${category.replace('_', ' ')} from ${userName} (${tenantName})`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
                  <tr>
                    <td style="padding: 30px 40px; background: ${priority === 'high' ? '#dc2626' : priority === 'medium' ? '#d97706' : '#2563eb'};">
                      <h1 style="margin: 0; font-size: 20px; color: #ffffff;">New Support Ticket #${ticketNumber}</h1>
                      <p style="margin: 5px 0 0; font-size: 14px; color: rgba(255,255,255,0.8);">${priority.toUpperCase()} priority ${category.replace('_', ' ')}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px 40px;">
                      <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px;">
                        <tr><td style="padding: 8px 12px; font-size: 13px; color: #888; border-bottom: 1px solid #333;">User</td><td style="padding: 8px 12px; font-size: 13px; color: #e0e0e0; border-bottom: 1px solid #333;">${userName} (${userEmail})</td></tr>
                        <tr><td style="padding: 8px 12px; font-size: 13px; color: #888; border-bottom: 1px solid #333;">Tenant</td><td style="padding: 8px 12px; font-size: 13px; color: #e0e0e0; border-bottom: 1px solid #333;">${tenantName}</td></tr>
                        <tr><td style="padding: 8px 12px; font-size: 13px; color: #888;">Subject</td><td style="padding: 8px 12px; font-size: 13px; color: #e0e0e0;">${subject}</td></tr>
                      </table>
                      <div style="padding: 16px; background: #111; border-radius: 8px; margin: 0 0 20px;">
                        <p style="margin: 0; font-size: 13px; color: #888; margin-bottom: 8px;">Description:</p>
                        <p style="margin: 0; font-size: 14px; color: #e0e0e0; white-space: pre-wrap;">${description.substring(0, 500)}${description.length > 500 ? '...' : ''}</p>
                      </div>
                      <a href="${adminUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px;">View in Admin</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 40px; border-top: 1px solid #2a2a2a; text-align: center;">
                      <p style="margin: 0; font-size: 12px; color: #666666;">&copy; ${new Date().getFullYear()} Synozur Alliance LLC. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `New Support Ticket #${ticketNumber}\n\nUser: ${userName} (${userEmail})\nTenant: ${tenantName}\nCategory: ${category}\nPriority: ${priority}\n\nSubject: ${subject}\n\nDescription:\n${description}\n\nView ticket: ${adminUrl}`
  };
  
  await client.send(msg);
}

export async function sendSupportTicketReplyNotification(
  to: string,
  userName: string,
  ticketNumber: number,
  subject: string,
  replierName: string,
  replyMessage: string,
  direction: 'staff_to_user' | 'user_to_staff'
) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  const isStaffToUser = direction === 'staff_to_user';
  const ticketUrl = isStaffToUser ? `${APP_URL}/support` : `${APP_URL}/system-admin?tab=support`;
  const headerBg = isStaffToUser
    ? 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)'
    : 'linear-gradient(135deg, #d97706 0%, #dc2626 100%)';
  const heading = isStaffToUser
    ? `New Reply on Ticket #${ticketNumber}`
    : `User Reply on Ticket #${ticketNumber}`;
  const intro = isStaffToUser
    ? `The Vega support team has replied to your ticket.`
    : `${replierName} has posted a reply on support ticket #${ticketNumber}.`;
  const buttonLabel = isStaffToUser ? 'View My Tickets' : 'View in Admin';

  const msg = {
    to,
    from: fromEmail,
    subject: `[Vega Support] ${heading} - ${subject}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;">
            <tr>
              <td style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
                  <tr>
                    <td style="padding: 30px 40px; background: ${headerBg};">
                      <h1 style="margin: 0; font-size: 20px; color: #ffffff;">${heading}</h1>
                      <p style="margin: 5px 0 0; font-size: 14px; color: rgba(255,255,255,0.8);">${subject}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px 40px;">
                      <p style="margin: 0 0 20px; font-size: 16px; color: #e0e0e0;">Hi ${userName || 'there'},</p>
                      <p style="margin: 0 0 20px; font-size: 14px; color: #b0b0b0;">${intro}</p>
                      <div style="padding: 16px; background: #111; border-radius: 8px; margin: 0 0 20px; border-left: 3px solid #2563eb;">
                        <p style="margin: 0 0 8px; font-size: 12px; color: #888;">${replierName} wrote:</p>
                        <p style="margin: 0; font-size: 14px; color: #e0e0e0; white-space: pre-wrap;">${replyMessage.substring(0, 1000)}${replyMessage.length > 1000 ? '...' : ''}</p>
                      </div>
                      <a href="${ticketUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px;">${buttonLabel}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 40px; border-top: 1px solid #2a2a2a; text-align: center;">
                      <p style="margin: 0; font-size: 12px; color: #666666;">&copy; ${new Date().getFullYear()} Synozur Alliance LLC. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `Hi ${userName || 'there'},\n\n${intro}\n\n${replierName} wrote:\n${replyMessage.substring(0, 1000)}\n\nView ticket: ${ticketUrl}\n\nThe Vega Team`
  };

  await client.send(msg);
}

export async function sendCommentMentionEmail(
  to: string,
  recipientName: string,
  authorName: string,
  entityTitle: string,
  snippet: string,
  linkPath: string,
) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const linkUrl = linkPath.startsWith("http") ? linkPath : `${APP_URL}${linkPath}`;
    const safeSnippet = (snippet || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const msg = {
      to,
      from: fromEmail,
      subject: `${authorName} mentioned you on “${entityTitle}”`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#0a0a0a;color:#ffffff;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#0a0a0a;">
              <tr>
                <td style="padding:40px 20px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:linear-gradient(135deg,#1a1a1a 0%,#0a0a0a 100%);border-radius:12px;border:1px solid #2a2a2a;">
                    <tr>
                      <td style="padding:40px 40px 20px;text-align:center;">
                        <h1 style="margin:0;font-size:28px;font-weight:700;background:linear-gradient(135deg,#810FFB 0%,#E60CB3 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">Vega</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:20px 40px 40px;">
                        <h2 style="margin:0 0 16px;font-size:20px;color:#ffffff;">Hi ${recipientName},</h2>
                        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cccccc;">
                          <strong style="color:#ffffff;">${authorName}</strong> mentioned you in a comment on
                          <strong style="color:#ffffff;">“${entityTitle}”</strong>.
                        </p>
                        <div style="margin:20px 0;padding:16px;background-color:#161616;border-left:3px solid #810FFB;border-radius:4px;color:#cccccc;font-size:14px;line-height:1.6;white-space:pre-wrap;">${safeSnippet}</div>
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0;">
                          <tr>
                            <td style="border-radius:8px;background:linear-gradient(135deg,#810FFB 0%,#E60CB3 100%);">
                              <a href="${linkUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">View Comment</a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:24px 0 0;font-size:12px;color:#777;">
                          You're receiving this because someone mentioned you in Vega.
                          You can manage notification preferences in your account settings.
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
      text: `Hi ${recipientName},\n\n${authorName} mentioned you in a comment on "${entityTitle}":\n\n${snippet}\n\nView: ${linkUrl}\n\n— Vega`,
    };
    await client.send(msg);
  } catch (err) {
    console.error("[email] sendCommentMentionEmail failed:", err);
  }
}

// Hash a token for secure storage (similar to password hashing)
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Generate a cryptographically secure random token
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// Generate verification token - returns both plaintext (for email) and hash (for DB)
export function generateVerificationToken(): { plaintext: string; hash: string } {
  const plaintext = generateSecureToken(32);
  const hash = hashToken(plaintext);
  return { plaintext, hash };
}

// Generate reset token - returns both plaintext (for email) and hash (for DB)
export function generateResetToken(): { plaintext: string; hash: string } {
  const plaintext = generateSecureToken(32);
  const hash = hashToken(plaintext);
  return { plaintext, hash };
}

// ============================================================================
// Weekly AI Digest (Task #62)
// ============================================================================

interface WeeklyDigestKrLine {
  id: string;
  title: string;
  progress: number;
  status: string | null;
  paceStatus: string | null;
  reason: string;
  url: string;
}

interface WeeklyDigestObjectiveLine {
  id: string;
  title: string;
  progress: number;
  status: string | null;
  url: string;
}

export interface WeeklyDigestEmailPayload {
  user: { id: string; name: string | null; email: string };
  tenant: { id: string; name: string };
  periodStart: string;
  periodLabel: string;
  narrative: string;
  needsAttention: WeeklyDigestKrLine[];
  wins: WeeklyDigestKrLine[];
  ownedCount: number;
  ownedObjectives: WeeklyDigestObjectiveLine[];
  totalCheckInsThisWeek: number;
  aiUsed: boolean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderKrRow(line: WeeklyDigestKrLine, accentColor: string): string {
  const safeTitle = escapeHtml(line.title);
  const safeReason = escapeHtml(line.reason);
  const progress = Math.max(0, Math.min(100, Math.round(line.progress)));
  return `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #2a2a2a;">
        <a href="${line.url}" style="color: #ffffff; text-decoration: none; font-weight: 500; font-size: 14px;">${safeTitle}</a>
        <div style="font-size: 12px; color: ${accentColor}; margin-top: 4px;">${safeReason}</div>
        <div style="margin-top: 8px; height: 4px; background: #2a2a2a; border-radius: 2px; overflow: hidden;">
          <div style="height: 4px; width: ${progress}%; background: ${accentColor};"></div>
        </div>
      </td>
    </tr>
  `;
}

export function renderWeeklyDigestHtml(payload: WeeklyDigestEmailPayload): string {
  const greetingName = payload.user.name?.split(' ')[0] ?? payload.user.email.split('@')[0];
  const safeNarrative = escapeHtml(payload.narrative).replace(/\n/g, '<br>');
  const safeTenant = escapeHtml(payload.tenant.name);
  const safePeriod = escapeHtml(payload.periodLabel);
  const safeGreeting = escapeHtml(greetingName);

  const needsAttentionRows = payload.needsAttention
    .map((l) => renderKrRow(l, '#f59e0b'))
    .join('');
  const winsRows = payload.wins.map((l) => renderKrRow(l, '#10b981')).join('');

  const dashUrl = `${APP_URL}/dashboard`;
  const okrsUrl = `${APP_URL}/okrs`;
  const prefsUrl = `${APP_URL}/notifications/preferences`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your weekly Vega digest</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a; color: #ffffff;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0a0a0a;">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 640px; margin: 0 auto; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border-radius: 12px; border: 1px solid #2a2a2a;">
                <tr>
                  <td style="padding: 32px 32px 16px; text-align: center;">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Vega</h1>
                    <p style="margin: 6px 0 0; font-size: 13px; color: #999999;">${safePeriod} · ${safeTenant}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 32px 24px;">
                    <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 600; color: #ffffff;">Hi ${safeGreeting},</h2>
                    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #d4d4d4;">${safeNarrative}</p>
                  </td>
                </tr>

                ${
                  payload.needsAttention.length > 0
                    ? `
                <tr>
                  <td style="padding: 0 32px 16px;">
                    <h3 style="margin: 16px 0 8px; font-size: 14px; font-weight: 600; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.06em;">Needs Attention</h3>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #141414; border: 1px solid #2a2a2a; border-radius: 8px;">
                      ${needsAttentionRows}
                    </table>
                  </td>
                </tr>
                `
                    : ''
                }

                ${
                  payload.wins.length > 0
                    ? `
                <tr>
                  <td style="padding: 0 32px 16px;">
                    <h3 style="margin: 16px 0 8px; font-size: 14px; font-weight: 600; color: #10b981; text-transform: uppercase; letter-spacing: 0.06em;">Wins</h3>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background: #141414; border: 1px solid #2a2a2a; border-radius: 8px;">
                      ${winsRows}
                    </table>
                  </td>
                </tr>
                `
                    : ''
                }

                <tr>
                  <td style="padding: 16px 32px 8px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0;">
                      <tr>
                        <td style="border-radius: 8px; background: linear-gradient(135deg, #810FFB 0%, #E60CB3 100%);">
                          <a href="${dashUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                            Open your dashboard
                          </a>
                        </td>
                        <td style="padding-left: 12px;">
                          <a href="${okrsUrl}" target="_blank" style="display: inline-block; padding: 14px 22px; font-size: 14px; font-weight: 500; color: #d4d4d4; text-decoration: none; border: 1px solid #2a2a2a; border-radius: 8px;">
                            View OKRs
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 24px 32px 28px; border-top: 1px solid #2a2a2a;">
                    <p style="margin: 0 0 6px; font-size: 12px; color: #666666;">
                      ${payload.totalCheckInsThisWeek} check-in${payload.totalCheckInsThisWeek === 1 ? '' : 's'} logged this week · ${payload.ownedCount} item${payload.ownedCount === 1 ? '' : 's'} you own
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #666666;">
                      <a href="${prefsUrl}" style="color: #999999;">Manage email preferences</a> · ${payload.aiUsed ? 'Summarized by Vega AI' : 'Summary'}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export function renderWeeklyDigestText(payload: WeeklyDigestEmailPayload): string {
  const lines: string[] = [];
  lines.push(`Your weekly Vega digest — ${payload.periodLabel}`);
  lines.push('');
  lines.push(payload.narrative);
  if (payload.needsAttention.length > 0) {
    lines.push('');
    lines.push('NEEDS ATTENTION');
    for (const x of payload.needsAttention) {
      lines.push(`- ${x.title} (${x.reason}) — ${x.url}`);
    }
  }
  if (payload.wins.length > 0) {
    lines.push('');
    lines.push('WINS');
    for (const x of payload.wins) {
      lines.push(`- ${x.title} (${x.reason}) — ${x.url}`);
    }
  }
  lines.push('');
  lines.push(`Open your dashboard: ${APP_URL}/dashboard`);
  lines.push(`Manage email preferences: ${APP_URL}/notifications/preferences`);
  return lines.join('\n');
}

export async function sendWeeklyDigestEmail(to: string, payload: WeeklyDigestEmailPayload) {
  const { client, fromEmail } = await getUncachableSendGridClient();
  const subject = `Your weekly Vega digest — ${payload.periodLabel}`;
  await client.send({
    to,
    from: fromEmail,
    subject,
    html: renderWeeklyDigestHtml(payload),
    text: renderWeeklyDigestText(payload),
  });
}
