import { Client } from '@hubspot/api-client';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
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
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=hubspot',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('HubSpot not connected');
  }
  return accessToken;
}

export async function getHubSpotClient() {
  const accessToken = await getAccessToken();
  return new Client({ accessToken });
}

export async function createHubSpotDeal(data: {
  tenantName: string;
  email: string;
  domain: string;
  planName: string;
  signupDate: Date;
}) {
  try {
    const client = await getHubSpotClient();
    
    const contactResult = await client.crm.contacts.basicApi.create({
      properties: {
        email: data.email,
        company: data.tenantName,
        website: data.domain,
        hs_lead_status: 'NEW',
      }
    });

    const dealResult = await client.crm.deals.basicApi.create({
      properties: {
        dealname: `${data.tenantName} - Self-Service Signup`,
        pipeline: 'default',
        dealstage: 'appointmentscheduled',
        amount: '0',
        closedate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        description: `Self-service signup from ${data.domain}. Plan: ${data.planName}`,
      }
    });

    if (contactResult.id && dealResult.id) {
      await client.crm.deals.associationsApi.create(
        dealResult.id,
        'contacts',
        contactResult.id,
        [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }]
      );
    }

    console.log('[HubSpot] Created deal for', data.email, '- Deal ID:', dealResult.id);
    return { contactId: contactResult.id, dealId: dealResult.id };
  } catch (error: any) {
    console.error('[HubSpot] Error creating deal:', error.message || error);
    return null;
  }
}

export async function isHubSpotConnected(): Promise<boolean> {
  try {
    console.log('[HubSpot] Checking connection status...');
    await getAccessToken();
    console.log('[HubSpot] Connection check: CONNECTED');
    return true;
  } catch (error: any) {
    console.log('[HubSpot] Connection check: NOT CONNECTED -', error.message || error);
    return false;
  }
}
