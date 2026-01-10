import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, EyeOff, Shield, Loader2, AlertCircle, ExternalLink, X } from "lucide-react";
import microsoftLogo from "@assets/Microsoft_Icon_6_1765741102026.jpeg";
import { Alert, AlertDescription } from "@/components/ui/alert";
import starTrailsBg from "@assets/AdobeStock_362805421_1763398687511.jpeg";
import vegaLogo from "@assets/VegaTight_1766605018223.png";
import vegaLogoWhite from "@assets/Vega_-_White_1767549184769.png";
import ReCAPTCHA from "react-google-recaptcha";

const ORGANIZATION_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1,000 employees" },
  { value: "1000+", label: "1,000+ employees" },
];

const INDUSTRIES = [
  { value: "technology", label: "Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance & Banking" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "retail", label: "Retail & E-commerce" },
  { value: "education", label: "Education" },
  { value: "consulting", label: "Consulting & Professional Services" },
  { value: "media", label: "Media & Entertainment" },
  { value: "real_estate", label: "Real Estate" },
  { value: "nonprofit", label: "Non-profit" },
  { value: "government", label: "Government" },
  { value: "other", label: "Other" },
];

const LOCATIONS = [
  { value: "us", label: "United States" },
  { value: "ca", label: "Canada" },
  { value: "uk", label: "United Kingdom" },
  { value: "eu", label: "Europe (EU)" },
  { value: "au", label: "Australia" },
  { value: "asia", label: "Asia" },
  { value: "latam", label: "Latin America" },
  { value: "mena", label: "Middle East & Africa" },
  { value: "other", label: "Other" },
];

interface SsoPolicy {
  tenantFound: boolean;
  tenantId?: string;
  tenantName?: string;
  ssoEnabled: boolean;
  enforceSso: boolean;
  allowLocalAuth: boolean;
  ssoRequired: boolean;
  existingUser?: boolean;
  authProvider?: string | null;
  message?: string;
}

export default function Login() {
  const { login, signup } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupOrgSize, setSignupOrgSize] = useState("");
  const [signupIndustry, setSignupIndustry] = useState("");
  const [signupLocation, setSignupLocation] = useState("");
  const [isSubmittingSignup, setIsSubmittingSignup] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  
  // Debug logging for reCAPTCHA
  console.log('[reCAPTCHA Debug] Site key configured:', recaptchaSiteKey ? `${recaptchaSiteKey.substring(0, 10)}...` : 'NOT SET');
  console.log('[reCAPTCHA Debug] Full site key:', recaptchaSiteKey);
  
  const [demoPassword, setDemoPassword] = useState("");
  const [showDemoForm, setShowDemoForm] = useState(false);
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);
  
  const [ssoPolicy, setSsoPolicy] = useState<SsoPolicy | null>(null);
  const [checkingPolicy, setCheckingPolicy] = useState(false);
  const [adminConsentError, setAdminConsentError] = useState<string | null>(null);
  
  const [inviteOnlyError, setInviteOnlyError] = useState<{tenantName: string} | null>(null);
  
  const ssoErrorMessages: Record<string, string> = {
    'sso_not_configured': 'Microsoft SSO is not configured for this application. Please contact your administrator.',
    'token_acquisition_failed': 'Failed to complete authentication. Please try again.',
    'no_email_claim': 'Unable to retrieve your email from Microsoft. Please ensure your account has a valid email.',
    'no_tenant_access': 'Your organization is not registered in Vega. Please contact your administrator.',
    'session_error': 'Failed to create your session. Please try again.',
    'callback_failed': 'Authentication callback failed. Please try again.',
    'missing_auth_code': 'Authentication code was not received. Please try again.',
    'missing_state': 'Authentication state was lost. Please try again.',
    'invalid_state': 'Authentication state is invalid. This may be a security issue. Please try again.',
    'access_denied': 'Access was denied. You may have cancelled the login or lack permissions.',
    'consent_required': 'Your organization administrator needs to grant consent for this application.',
    'interaction_required': 'Additional interaction is required. Please try signing in again.',
    'domain_blocked': 'Signups from your email domain are not allowed. Please contact vega@synozur.com for assistance.',
  };
  
  useEffect(() => {
    const visitorId = localStorage.getItem('vega_visitor_id') || crypto.randomUUID();
    if (!localStorage.getItem('vega_visitor_id')) {
      localStorage.setItem('vega_visitor_id', visitorId);
    }
    fetch('/api/track/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: '/login', visitorId }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    const message = params.get('message');
    
    if (error) {
      // Special handling for admin consent errors - show detailed guidance
      if (error === 'access_denied' || error === 'consent_required') {
        setAdminConsentError(errorDescription || message || error);
        window.history.replaceState({}, '', '/login');
        return;
      }
      
      // Special handling for invite-only tenant errors - show persistent message
      if (error === 'invite_only') {
        const tenantName = params.get('tenant_name') || 'this organization';
        setInviteOnlyError({ tenantName: decodeURIComponent(tenantName) });
        window.history.replaceState({}, '', '/login');
        return;
      }
      
      const friendlyMessage = ssoErrorMessages[error] || errorDescription || message || `Authentication error: ${error}`;
      toast({
        variant: "destructive",
        title: "Sign-in Failed",
        description: friendlyMessage,
        duration: 8000,
      });
      window.history.replaceState({}, '', '/login');
    }
  }, [toast]);
  
  const checkSsoPolicy = useCallback(async (email: string) => {
    if (!email || !email.includes('@')) {
      setSsoPolicy(null);
      return;
    }
    
    setCheckingPolicy(true);
    try {
      const response = await fetch('/auth/entra/check-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      if (response.ok) {
        const policy = await response.json();
        setSsoPolicy(policy);
      }
    } catch (error) {
      console.error('Failed to check SSO policy:', error);
    } finally {
      setCheckingPolicy(false);
    }
  }, []);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loginEmail.includes('@')) {
        checkSsoPolicy(loginEmail);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [loginEmail, checkSsoPolicy]);

  const handleMicrosoftLogin = () => {
    sessionStorage.setItem('vega_sso_pending', Date.now().toString());
    window.location.href = `/auth/entra/login${ssoPolicy?.tenantId ? `?tenant=${ssoPolicy.tenantId}` : ''}`;
  };

  const handleDemoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingDemo(true);

    try {
      await login({ email: "", password: demoPassword, isDemo: true });
      toast({
        title: "Welcome!",
        description: "Successfully logged in as demo user",
      });
      setTimeout(() => {
        setLocation("/dashboard");
      }, 100);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "Invalid demo password",
      });
    } finally {
      setIsSubmittingDemo(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (ssoPolicy?.ssoRequired) {
      toast({
        title: "SSO Required",
        description: `${ssoPolicy.tenantName || 'Your organization'} requires Microsoft SSO login. Redirecting...`,
      });
      setTimeout(() => {
        handleMicrosoftLogin();
      }, 1500);
      return;
    }
    
    setIsSubmittingLogin(true);

    try {
      await login({ email: loginEmail, password: loginPassword });
      toast({
        title: "Welcome Back!",
        description: "Successfully logged in",
      });
      setTimeout(() => {
        setLocation("/dashboard");
      }, 100);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message || "Invalid credentials",
      });
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (recaptchaSiteKey && !recaptchaToken) {
      toast({
        variant: "destructive",
        title: "Verification Required",
        description: "Please complete the reCAPTCHA verification",
      });
      return;
    }
    
    setIsSubmittingSignup(true);

    try {
      await signup({
        name: signupName,
        email: signupEmail,
        password: signupPassword,
        recaptchaToken: recaptchaToken || undefined,
        organizationSize: signupOrgSize || undefined,
        industry: signupIndustry || undefined,
        location: signupLocation || undefined,
      });
      
      // Track signup conversion in Google Ads
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'conversion', {
          'send_to': 'AW-16740929164/vEQ2CJ3c2dwbEIyd2a4-',
        });
      }
      
      toast({
        title: "Account Created!",
        description: "Please check your email to verify your account.",
        duration: 8000,
      });
      setSignupName("");
      setSignupEmail("");
      setSignupPassword("");
      setRecaptchaToken(null);
      recaptchaRef.current?.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: error.message || "Failed to create account",
      });
      recaptchaRef.current?.reset();
      setRecaptchaToken(null);
    } finally {
      setIsSubmittingSignup(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: `url(${starTrailsBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      />
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-primary/40 via-purple-900/30 to-background/80" />
      
      <div className="relative z-10 w-full max-w-md space-y-6">
        <Link href="/">
          <Button variant="ghost" className="text-white hover:bg-white/10">
            <ArrowLeft className="mr-2 h-4 w-4" />
            About Vega
          </Button>
        </Link>
        
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center">
            {/* White logo on mobile for better contrast, larger logo on desktop */}
            <img src={vegaLogoWhite} alt="Vega Company OS" className="h-56 object-contain drop-shadow-xl md:hidden" />
            <img src={vegaLogo} alt="Vega Company OS" className="hidden md:block h-80 object-contain drop-shadow-xl" />
          </div>
          <p className="text-gray-200">Your AI-Augmented Company OS</p>
        </div>

        {adminConsentError && (
          <Card className="backdrop-blur-md bg-background/95 border-amber-500/50 mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-lg">Admin Consent Required</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 -mt-1 -mr-2"
                  onClick={() => setAdminConsentError(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Your organization's IT administrator needs to grant permission for Vega to access your Microsoft account.
              </p>
              
              <div className="bg-muted/50 rounded-md p-3 space-y-2">
                <p className="font-medium">What to tell your IT admin:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Go to <span className="font-mono text-xs">entra.microsoft.com</span> or <span className="font-mono text-xs">portal.azure.com</span></li>
                  <li>Navigate to Enterprise Applications</li>
                  <li>Search for "Vega" or add application ID:<br/>
                    <code className="text-xs bg-background px-1 py-0.5 rounded">6aeac29a-cb76-405b-b0c6-df4a1a368f62</code>
                  </li>
                  <li>Grant admin consent for requested permissions</li>
                </ol>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                <p className="text-blue-800 dark:text-blue-200 text-xs">
                  <strong>Note:</strong> This consent is granted in <em>your organization's</em> Microsoft Entra ID (Azure AD), not in Vega. 
                  Only your organization's Global Administrator or Application Administrator can grant this consent.
                </p>
              </div>

              <p className="text-muted-foreground">
                Need help? Contact <a href="mailto:ContactUs@synozur.com" className="text-primary hover:underline">ContactUs@synozur.com</a>
              </p>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setAdminConsentError(null)}
              >
                Try signing in again
              </Button>
            </CardContent>
          </Card>
        )}

        {inviteOnlyError && (
          <Card className="backdrop-blur-md bg-background/95 border-amber-500/50 mb-4" data-testid="card-invite-only-error">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-lg">Invitation Required</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 -mt-1 -mr-2"
                  onClick={() => setInviteOnlyError(null)}
                  data-testid="button-dismiss-invite-error"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                <strong>{inviteOnlyError.tenantName}</strong> requires an invitation to join.
              </p>
              
              <div className="bg-muted/50 rounded-md p-3 space-y-2">
                <p className="font-medium">To get access:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Contact your organization's Vega administrator</li>
                  <li>Ask them to add you as a team member in Tenant Admin</li>
                  <li>Once added, try signing in again</li>
                </ul>
              </div>

              <p className="text-muted-foreground">
                If you believe this is an error, contact <a href="mailto:ContactUs@synozur.com" className="text-primary hover:underline">ContactUs@synozur.com</a>
              </p>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setInviteOnlyError(null)}
                data-testid="button-try-again-invite"
              >
                Try signing in again
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="backdrop-blur-md bg-background/95 border-white/20">
          <CardContent className="pt-6">
            <Button
              type="button"
              size="lg"
              className="w-full mb-4"
              onClick={handleMicrosoftLogin}
              data-testid="button-sso-login"
            >
              <img src={microsoftLogo} alt="Microsoft" className="mr-2 h-5 w-5" />
              Continue with Microsoft
            </Button>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or use email
                </span>
              </div>
            </div>

            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="login" data-testid="tab-email-login">Login</TabsTrigger>
                <TabsTrigger value="signup" data-testid="tab-signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-0">
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="you@company.com"
                      data-testid="input-login-email"
                      required
                    />
                  </div>
                  
                  {checkingPolicy && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Checking organization...
                    </div>
                  )}
                  
                  {ssoPolicy?.ssoRequired && (
                    <Alert className="border-primary/50 bg-primary/10">
                      <Shield className="h-4 w-4" />
                      <AlertDescription>
                        <span className="font-medium">{ssoPolicy.tenantName || 'Your organization'}</span> requires Microsoft SSO.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {!ssoPolicy?.ssoRequired && (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="login-password">Password</Label>
                          <Link href="/forgot-password">
                            <button
                              type="button"
                              className="text-xs text-primary hover:underline"
                              data-testid="link-forgot-password"
                            >
                              Forgot password?
                            </button>
                          </Link>
                        </div>
                        <div className="relative">
                          <Input
                            id="login-password"
                            type={showLoginPassword ? "text" : "password"}
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="Enter your password"
                            data-testid="input-login-password"
                            className="pr-10"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            data-testid="button-toggle-login-password"
                          >
                            {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmittingLogin}
                        data-testid="button-email-login"
                      >
                        {isSubmittingLogin ? "Logging in..." : "Login"}
                      </Button>
                    </>
                  )}
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-0">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="Your name"
                      data-testid="input-signup-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Work Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="you@company.com"
                      data-testid="input-signup-email"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showSignupPassword ? "text" : "password"}
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="Create a password"
                        data-testid="input-signup-password"
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        data-testid="button-toggle-signup-password"
                      >
                        {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-org-size">Organization Size</Label>
                    <Select value={signupOrgSize} onValueChange={setSignupOrgSize}>
                      <SelectTrigger id="signup-org-size" data-testid="select-signup-org-size">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent>
                        {ORGANIZATION_SIZES.map((size) => (
                          <SelectItem key={size.value} value={size.value}>
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-industry">Industry</Label>
                    <Select value={signupIndustry} onValueChange={setSignupIndustry}>
                      <SelectTrigger id="signup-industry" data-testid="select-signup-industry">
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map((industry) => (
                          <SelectItem key={industry.value} value={industry.value}>
                            {industry.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-location">Location</Label>
                    <Select value={signupLocation} onValueChange={setSignupLocation}>
                      <SelectTrigger id="signup-location" data-testid="select-signup-location">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCATIONS.map((loc) => (
                          <SelectItem key={loc.value} value={loc.value}>
                            {loc.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {recaptchaSiteKey && (
                    <div className="flex justify-center">
                      <ReCAPTCHA
                        ref={recaptchaRef}
                        sitekey={recaptchaSiteKey}
                        onChange={(token) => setRecaptchaToken(token)}
                        onExpired={() => setRecaptchaToken(null)}
                        data-testid="recaptcha-signup"
                      />
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmittingSignup}
                    data-testid="button-signup"
                  >
                    {isSubmittingSignup ? "Creating account..." : "Create Account"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Your email domain must match an allowed organization
                  </p>
                </form>
              </TabsContent>
            </Tabs>
            
            <p className="text-xs text-muted-foreground text-center mt-4 pt-4 border-t">
              By logging in or creating an account, you agree to the Synozur{" "}
              <a 
                href="https://synozur.com/privacy-policy" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Privacy Policy
              </a>{" "}
              and{" "}
              <a 
                href="https://synozur.com/terms-of-service" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Terms of Service
              </a>.
            </p>
          </CardContent>
        </Card>
        
        <div className="text-center">
          {!showDemoForm ? (
            <button
              onClick={() => setShowDemoForm(true)}
              className="text-sm text-white/70 hover:text-white underline"
              data-testid="link-demo-access"
            >
              Have a demo password?
            </button>
          ) : (
            <Card className="backdrop-blur-md bg-background/95 border-white/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Demo Access</CardTitle>
                <CardDescription className="text-xs">
                  Enter the demo password provided by Synozur
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleDemoLogin} className="space-y-3">
                  <Input
                    type="password"
                    value={demoPassword}
                    onChange={(e) => setDemoPassword(e.target.value)}
                    placeholder="Demo password"
                    data-testid="input-demo-password"
                    required
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDemoForm(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmittingDemo}
                      className="flex-1"
                      data-testid="button-demo-login"
                    >
                      {isSubmittingDemo ? "..." : "Enter Demo"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
