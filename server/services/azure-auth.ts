import { Request, Response, NextFunction } from "express";
import { ConfidentialClientApplication, Configuration, AuthenticationResult } from "@azure/msal-node";
import * as crypto from "crypto";

export interface EntraIdConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface AuthenticatedUser {
  oid: string;
  name: string;
  email: string;
  roles: string[];
  groups: string[];
  accessToken?: string;
  expiresOn?: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      isAuthenticated?: boolean;
    }
  }
}

class EntraIdAuthService {
  private msalClient: ConfidentialClientApplication | null = null;
  private config: EntraIdConfig | null = null;
  private enabled: boolean = false;
  private stateCache: Map<string, { nonce: string; timestamp: number }> = new Map();

  private generateGuid(): string {
    return crypto.randomUUID();
  }

  initialize(config?: Partial<EntraIdConfig>) {
    const tenantId = config?.tenantId || process.env.AZURE_AD_TENANT_ID;
    const clientId = config?.clientId || process.env.AZURE_AD_CLIENT_ID;
    const clientSecret = config?.clientSecret || process.env.AZURE_AD_CLIENT_SECRET;
    const redirectUri = config?.redirectUri || process.env.AZURE_AD_REDIRECT_URI || "http://localhost:5000/auth/callback";
    const scopes = process.env.AZURE_AD_SCOPES?.split(",") || config?.scopes || ["openid", "profile", "email", "User.Read"];

    if (!tenantId || !clientId || !clientSecret) {
      console.log("[EntraID] Not configured - authentication disabled. Set AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET to enable.");
      this.enabled = false;
      return;
    }

    this.config = {
      tenantId,
      clientId,
      clientSecret,
      redirectUri,
      scopes,
    };

    const msalConfig: Configuration = {
      auth: {
        clientId: this.config.clientId,
        authority: `https://login.microsoftonline.com/${this.config.tenantId}`,
        clientSecret: this.config.clientSecret,
      },
      system: {
        loggerOptions: {
          loggerCallback(level, message) {
            if (process.env.NODE_ENV !== "production") {
              console.log(`[MSAL] ${message}`);
            }
          },
          piiLoggingEnabled: false,
          logLevel: 3,
        },
      },
    };

    this.msalClient = new ConfidentialClientApplication(msalConfig);
    this.enabled = true;
    
    setInterval(() => this.cleanupStateCache(), 5 * 60 * 1000);
    
    console.log("[EntraID] Authentication initialized successfully");
  }

  private cleanupStateCache() {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000;
    const entries = Array.from(this.stateCache.entries());
    for (const [state, data] of entries) {
      if (now - data.timestamp > maxAge) {
        this.stateCache.delete(state);
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async getAuthorizationUrl(): Promise<{ url: string; state: string }> {
    if (!this.msalClient || !this.config) {
      throw new Error("EntraID not configured");
    }

    const state = this.generateGuid();
    const nonce = this.generateGuid();
    
    this.stateCache.set(state, { nonce, timestamp: Date.now() });

    const authCodeUrlParameters = {
      scopes: this.config.scopes,
      redirectUri: this.config.redirectUri,
      responseMode: "query" as const,
      state,
      nonce,
    };

    const url = await this.msalClient.getAuthCodeUrl(authCodeUrlParameters);
    return { url, state };
  }

  async handleCallback(code: string, state: string): Promise<AuthenticationResult> {
    if (!this.msalClient || !this.config) {
      throw new Error("EntraID not configured");
    }

    const stateData = this.stateCache.get(state);
    if (!stateData) {
      throw new Error("Invalid or expired state parameter");
    }
    this.stateCache.delete(state);

    const tokenRequest = {
      code,
      scopes: this.config.scopes,
      redirectUri: this.config.redirectUri,
    };

    return await this.msalClient.acquireTokenByCode(tokenRequest);
  }

  async refreshToken(refreshToken: string): Promise<AuthenticationResult | null> {
    if (!this.msalClient || !this.config) {
      return null;
    }

    try {
      return await this.msalClient.acquireTokenByRefreshToken({
        refreshToken,
        scopes: this.config.scopes,
      });
    } catch (error) {
      console.error("[EntraID] Token refresh failed:", error);
      return null;
    }
  }

  async validateToken(accessToken: string): Promise<AuthenticatedUser | null> {
    try {
      const response = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const profile = await response.json();

      const memberOfResponse = await fetch("https://graph.microsoft.com/v1.0/me/memberOf", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      let groups: string[] = [];
      let roles: string[] = [];

      if (memberOfResponse.ok) {
        const memberOf = await memberOfResponse.json();
        groups = memberOf.value
          ?.filter((m: any) => m["@odata.type"] === "#microsoft.graph.group")
          ?.map((g: any) => g.displayName) || [];
        roles = memberOf.value
          ?.filter((m: any) => m["@odata.type"] === "#microsoft.graph.directoryRole")
          ?.map((r: any) => r.displayName) || [];
      }

      return {
        oid: profile.id,
        name: profile.displayName || "",
        email: profile.mail || profile.userPrincipalName || "",
        roles,
        groups,
      };
    } catch (error) {
      console.error("[EntraID] Token validation failed:", error);
      return null;
    }
  }

  authMiddleware(requiredGroups?: string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.enabled) {
        req.isAuthenticated = false;
        return next();
      }

      const authHeader = req.headers.authorization;
      const sessionToken = (req as any).session?.accessToken;

      const token = authHeader?.startsWith("Bearer ") 
        ? authHeader.substring(7) 
        : sessionToken;

      if (!token) {
        return res.status(401).json({ 
          message: "Authentication required",
          loginUrl: "/auth/login" 
        });
      }

      const user = await this.validateToken(token);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid or expired token" });
      }

      if (requiredGroups && requiredGroups.length > 0) {
        const hasRequiredGroup = requiredGroups.some(
          (group) => user.groups.includes(group)
        );
        if (!hasRequiredGroup) {
          return res.status(403).json({ 
            message: "Insufficient permissions",
            requiredGroups 
          });
        }
      }

      req.user = user;
      req.isAuthenticated = true;
      next();
    };
  }

  optionalAuthMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.enabled) {
        req.isAuthenticated = false;
        return next();
      }

      const authHeader = req.headers.authorization;
      const sessionToken = (req as any).session?.accessToken;

      const token = authHeader?.startsWith("Bearer ") 
        ? authHeader.substring(7) 
        : sessionToken;

      if (token) {
        const user = await this.validateToken(token);
        if (user) {
          req.user = user;
          req.isAuthenticated = true;
        }
      }

      next();
    };
  }

  shutdown() {
    this.stateCache.clear();
    console.log("[EntraID] Auth service shut down");
  }
}

export const entraIdAuth = new EntraIdAuthService();
