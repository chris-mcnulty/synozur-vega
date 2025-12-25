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
