import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { searchContacts, createContact, getHubspotClient, getHubspotAuthUrl, getHubspotTokens, saveHubspotCredentials } from '../services/hubspot.service';
import pool from '../config/db';

const router = Router();

// Get HubSpot connection status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const result = await pool.query(
      'SELECT access_token FROM user_credentials WHERE user_id = $1 AND service = $2',
      [userId, 'hubspot']
    );

    const isConnected = result.rows.length > 0 && result.rows[0].access_token;
    res.json({ connected: isConnected });
  } catch (error) {
    console.error('Error checking HubSpot status:', error);
    res.status(500).json({ error: 'Failed to check HubSpot status' });
  }
});

// Get all contacts
router.get('/contacts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const contacts = await searchContacts(userId.toString(), '');
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Search contacts
router.get('/contacts/search', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { q } = req.query;
    
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const contacts = await searchContacts(userId.toString(), q as string || '');
    res.json(contacts);
  } catch (error) {
    console.error('Error searching contacts:', error);
    res.status(500).json({ error: 'Failed to search contacts' });
  }
});

// Get contact by ID
router.get('/contacts/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const client = await getHubspotClient(userId.toString());
    const contact = await client.crm.contacts.basicApi.getById(id);
    res.json(contact);
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact' });
  }
});

// Create new contact
router.post('/contacts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const contactDetails = req.body;
    
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const contact = await createContact(userId.toString(), contactDetails);
    res.json(contact);
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// Update contact
router.put('/contacts/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const updates = req.body;
    
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const client = await getHubspotClient(userId.toString());
    const contact = await client.crm.contacts.basicApi.update(id, { properties: updates });
    res.json(contact);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// Get HubSpot auth URL
router.get('/auth-url', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    
    // Include user ID in state parameter for OAuth callback
    const authUrl = getHubspotAuthUrl(userId.toString());
    res.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating HubSpot auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// HubSpot OAuth callback - No authentication required for OAuth callbacks
router.get('/callback', async (req, res) => {
  try {
    console.log('HubSpot callback received:', req.query);
    const { code, state } = req.query;
    
    if (!code || typeof code !== 'string') {
      console.log('No authorization code received');
      res.status(400).json({ error: 'Authorization code required' });
      return;
    }

    // Get user ID from state parameter
    const userId = state as string;
    if (!userId) {
      console.log('No user ID in state parameter');
      res.status(400).json({ error: 'Invalid state parameter' });
      return;
    }

    console.log('Getting tokens from HubSpot for user:', userId);
    const tokens = await getHubspotTokens(code);
    console.log('Tokens received:', !!tokens.access_token);
    
    console.log('Saving credentials...');
    await saveHubspotCredentials(userId, tokens);
    console.log('Credentials saved successfully');

    // Redirect to frontend with success message
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/settings?hubspot=success`);
  } catch (error: any) {
    console.error('HubSpot callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/settings?hubspot=error&message=${encodeURIComponent(error.message)}`);
  }
});

// Disconnect HubSpot
router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    await pool.query(
      'DELETE FROM user_credentials WHERE user_id = $1 AND service = $2',
      [userId, 'hubspot']
    );

    res.json({ success: true, message: 'HubSpot disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting HubSpot:', error);
    res.status(500).json({ error: 'Failed to disconnect HubSpot' });
  }
});

export default router; 