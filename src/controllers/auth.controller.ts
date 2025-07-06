import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel, CreateUserData } from '../modules/user.model';
import { getGoogleAuthUrl, getGoogleTokens, getUserData, saveGoogleCredentials } from '../services/google.service';
import { getHubspotAuthUrl, getHubspotTokens, saveHubspotCredentials } from '../services/hubspot.service';

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
    res.json({ authUrl });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
};

export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.query;
    
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Authorization code required' });
      return;
    }

    // Get tokens from Google
    const tokens = await getGoogleTokens(code);
    
    // Get user data from Google
    const userData = await getUserData(tokens);
    
    if (!userData?.email) {
      res.status(400).json({ error: 'Failed to get user email from Google' });
      return;
    }

    // Check if user exists
    let user = await UserModel.findByEmail(userData.email);
    
    if (!user) {
      // Create new user
      const createUserData: CreateUserData = {
        email: userData.email,
        name: userData.name || userData.email,
        avatar: userData.picture,
        provider: 'google',
        provider_id: userData.sub || userData.email
      };
      
      user = await UserModel.create(createUserData);
    }

    // Save Google credentials
    await saveGoogleCredentials(user.id.toString(), tokens);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirect to frontend with token
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`;
    res.redirect(redirectUrl);
    return;
  } catch (error) {
    console.error('Google callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
    return;
  }
};

export const hubspotAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUrl = getHubspotAuthUrl();
    res.json({ authUrl });
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
