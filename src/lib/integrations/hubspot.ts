/**
 * HubSpot CRM Integration
 *
 * Enables exporting leads/contacts to HubSpot CRM from monitored results.
 * Uses OAuth 2.0 for authentication.
 */

// HubSpot OAuth configuration
const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;
const HUBSPOT_REDIRECT_URI = process.env.HUBSPOT_REDIRECT_URI || "https://kaulbyapp.com/api/integrations/hubspot/callback";
const HUBSPOT_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
].join(" ");

interface HubSpotTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface HubSpotContact {
  email?: string;
  firstname?: string;
  lastname?: string;
  company?: string;
  website?: string;
  phone?: string;
  // Custom properties for Kaulby
  kaulby_source_platform?: string;
  kaulby_source_url?: string;
  kaulby_sentiment?: string;
  kaulby_lead_score?: number;
  kaulby_first_seen?: string;
  kaulby_notes?: string;
}

/**
 * Generate OAuth authorization URL
 */
export function getAuthorizationUrl(state: string): string {
  if (!HUBSPOT_CLIENT_ID) {
    throw new Error("HUBSPOT_CLIENT_ID not configured");
  }

  const params = new URLSearchParams({
    client_id: HUBSPOT_CLIENT_ID,
    redirect_uri: HUBSPOT_REDIRECT_URI,
    scope: HUBSPOT_SCOPES,
    state,
  });

  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<HubSpotTokens> {
  if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) {
    throw new Error("HubSpot credentials not configured");
  }

  const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: HUBSPOT_CLIENT_ID,
      client_secret: HUBSPOT_CLIENT_SECRET,
      redirect_uri: HUBSPOT_REDIRECT_URI,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<HubSpotTokens> {
  if (!HUBSPOT_CLIENT_ID || !HUBSPOT_CLIENT_SECRET) {
    throw new Error("HubSpot credentials not configured");
  }

  const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: HUBSPOT_CLIENT_ID,
      client_secret: HUBSPOT_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Create or update a contact in HubSpot
 */
export async function upsertContact(
  accessToken: string,
  contact: HubSpotContact
): Promise<{ id: string; isNew: boolean }> {
  // First, try to find existing contact by email
  if (contact.email) {
    const searchResponse = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "email",
                  operator: "EQ",
                  value: contact.email,
                },
              ],
            },
          ],
        }),
      }
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.results?.length > 0) {
        // Update existing contact
        const existingId = searchData.results[0].id;
        await updateContact(accessToken, existingId, contact);
        return { id: existingId, isNew: false };
      }
    }
  }

  // Create new contact
  const createResponse = await fetch(
    "https://api.hubapi.com/crm/v3/objects/contacts",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: contact,
      }),
    }
  );

  if (!createResponse.ok) {
    const error = await createResponse.text();
    throw new Error(`Failed to create contact: ${error}`);
  }

  const data = await createResponse.json();
  return { id: data.id, isNew: true };
}

/**
 * Update an existing contact
 */
async function updateContact(
  accessToken: string,
  contactId: string,
  contact: HubSpotContact
): Promise<void> {
  const response = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: contact,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update contact: ${error}`);
  }
}

/**
 * Get HubSpot account info
 */
export async function getAccountInfo(accessToken: string): Promise<{
  portalId: number;
  timeZone: string;
  currency: string;
}> {
  const response = await fetch(
    "https://api.hubapi.com/integrations/v1/me",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to get account info");
  }

  return response.json();
}

/**
 * Convert a Kaulby result to HubSpot contact properties
 */
export function resultToHubSpotContact(result: {
  platform: string;
  author: string;
  url: string;
  title?: string;
  content?: string;
  sentiment?: string;
  leadScore?: number;
  createdAt: Date;
}): HubSpotContact {
  // Extract potential name from author
  const nameParts = result.author?.split(/[\s_-]/) || [];

  return {
    firstname: nameParts[0] || result.author,
    lastname: nameParts.slice(1).join(" ") || undefined,
    kaulby_source_platform: result.platform,
    kaulby_source_url: result.url,
    kaulby_sentiment: result.sentiment,
    kaulby_lead_score: result.leadScore,
    kaulby_first_seen: result.createdAt.toISOString(),
    kaulby_notes: result.content?.slice(0, 500),
  };
}

/**
 * Check if HubSpot integration is configured
 */
export function isHubSpotConfigured(): boolean {
  return !!(HUBSPOT_CLIENT_ID && HUBSPOT_CLIENT_SECRET);
}
