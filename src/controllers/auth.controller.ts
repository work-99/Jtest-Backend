import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel, CreateUserData } from '../modules/user.model';
import { getGoogleAuthUrl, getGoogleTokens, getUserData, saveGoogleCredentials } from '../services/google.service';
import { getHubspotAuthUrl, getHubspotTokens, saveHubspotCredentials } from '../services/hubspot.service';
import { DataImportService } from '../services/data-import.service';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: string;
      };
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUrl = getGoogleAuthUrl();
    res.json({ url: authUrl });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
};

export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('=== Google Callback Started ===');
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      console.log('❌ No authorization code provided');
      res.status(400).json({ error: 'Authorization code required' });
      return;
    }

    console.log('✅ Authorization code received:', code.substring(0, 20) + '...');

    // Get tokens from Google
    console.log('🔄 Getting tokens from Google...');
    const tokens = await getGoogleTokens(code);
    console.log('✅ Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date
    });
    
    // Get user data from Google
    console.log('🔄 Getting user data from Google...');
    const userData = await getUserData(tokens);
    console.log('✅ User data received:', userData);
    
    if (!userData?.email) {
      console.log('❌ No email in user data');
      res.status(400).json({ error: 'Failed to get user email from Google' });
      return;
    }

    // Check if user exists
    console.log('🔄 Looking up user in database...');
    let user = await UserModel.findByEmail(userData.email);
    
    if (!user) {
      console.log('🔄 Creating new user...');
      // Create new user
      const createUserData: CreateUserData = {
        email: userData.email,
        name: userData.name || userData.email,
        avatar: userData.picture,
        provider: 'google',
        provider_id: userData.sub || userData.email
      };
      
      user = await UserModel.create(createUserData);
      console.log('✅ New user created:', user);
    } else {
      console.log('✅ Existing user found:', user);
    }

    // Save Google credentials
    console.log('🔄 Saving Google credentials...');
    await saveGoogleCredentials(user.id.toString(), tokens);
    console.log('✅ Credentials saved');

    // Start background data import
    console.log('🔄 Starting background data import...');
    DataImportService.importAllData(user.id, 1000)
      .then(() => {
        console.log('✅ Background data import completed successfully');
      })
      .catch((error) => {
        console.error('❌ Background data import failed:', error);
      });

    // Generate JWT token
    console.log('🔄 Generating JWT token...');
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    console.log('✅ JWT token generated');

    // Redirect to frontend with token
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`;
    console.log('🔄 Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
    return;
  } catch (error: any) {
    console.error('❌ Google callback error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
    return;
  }
};

export const hubspotAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUrl = getHubspotAuthUrl();
    res.json({ url: authUrl });
  } catch (error) {
    console.error('HubSpot auth error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
};

export const hubspotCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.query;
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }
    
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Authorization code required' });
      return;
    }

    // Get tokens from HubSpot
    const tokens = await getHubspotTokens(code);
    
    // Save HubSpot credentials
    await saveHubspotCredentials(userId.toString(), tokens);

    // Start background HubSpot contacts import
    console.log('🔄 Starting background HubSpot contacts import...');
    DataImportService.importHubSpotContacts(userId)
      .then(() => {
        console.log('✅ Background HubSpot contacts import completed successfully');
      })
      .catch((error) => {
        console.error('❌ Background HubSpot contacts import failed:', error);
      });

    res.json({ success: true, message: 'HubSpot connected successfully' });
    return;
  } catch (error) {
    console.error('HubSpot callback error:', error);
    res.status(500).json({ error: 'HubSpot authentication failed' });
    return;
  }
};

export const checkAuthStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Handle mock user for testing
    if (userId === 1 && req.user?.email === 'test@example.com') {
      res.json({
        user: {
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
          avatar: undefined,
          role: 'user'
        },
        connectedServices: []
      });
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const connectedServices = await UserModel.getConnectedServices(userId);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role
      },
      connectedServices
    });
    return;
  } catch (error) {
    console.error('Auth status check error:', error);
    res.status(500).json({ error: 'Failed to check auth status' });
    return;
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    // In a real implementation, you might want to blacklist the token
    res.json({ success: true, message: 'Logged out successfully' });
    return;
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
    return;
  }
};

export const importUserData = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Start background data import
    console.log(`🔄 Manual data import requested for user ${userId}...`);
    DataImportService.importAllData(userId, 1000)
      .then(() => {
        console.log(`✅ Manual data import completed for user ${userId}`);
      })
      .catch((error) => {
        console.error(`❌ Manual data import failed for user ${userId}:`, error);
      });

    res.json({ 
      success: true, 
      message: 'Data import started in background. This may take a few minutes.' 
    });
    return;
  } catch (error) {
    console.error('Manual data import error:', error);
    res.status(500).json({ error: 'Failed to start data import' });
    return;
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Generate new JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token });
    return;
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
    return;
  }
};
