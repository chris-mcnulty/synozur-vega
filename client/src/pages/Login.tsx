import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, EyeOff, Building2, SquareStack, Shield, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import starTrailsBg from "@assets/AdobeStock_362805421_1763398687511.jpeg";

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

  // Demo login state
  const [demoPassword, setDemoPassword] = useState("");
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);
  const [showDemoPassword, setShowDemoPassword] = useState(false);

  // Email/password login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [isSubmittingSignup, setIsSubmittingSignup] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  
  // SSO policy state
  const [ssoPolicy, setSsoPolicy] = useState<SsoPolicy | null>(null);
  const [checkingPolicy, setCheckingPolicy] = useState(false);
  
  // SSO error messages mapping
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
  };
  
  // Check for SSO errors in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    const message = params.get('message');
    
    if (error) {
      const friendlyMessage = ssoErrorMessages[error] || errorDescription || message || `Authentication error: ${error}`;
      toast({
        variant: "destructive",
        title: "Sign-in Failed",
        description: friendlyMessage,
        duration: 8000,
      });
      // Clean up URL
      window.history.replaceState({}, '', '/auth');
    }
  }, [toast]);
  
  // Debounced SSO policy check
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
  
  // Check SSO policy when email changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loginEmail.includes('@')) {
        checkSsoPolicy(loginEmail);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [loginEmail, checkSsoPolicy]);

  const handleDemoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingDemo(true);

    try {
      await login({ email: "", password: demoPassword, isDemo: true });
      toast({
        title: "Welcome!",
        description: "Successfully logged in as demo user",
      });
      // Add a small delay to ensure auth state is updated
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
    
    // Check if SSO is required for this user's organization
    if (ssoPolicy?.ssoRequired) {
      toast({
        title: "SSO Required",
        description: `${ssoPolicy.tenantName || 'Your organization'} requires Microsoft SSO login. Redirecting...`,
      });
      // Redirect to SSO login with tenant hint
      setTimeout(() => {
        window.location.href = `/auth/entra/login${ssoPolicy.tenantId ? `?tenant=${ssoPolicy.tenantId}` : ''}`;
      }, 1500);
      return;
    }
    
    // If SSO is enabled but local auth is allowed, warn but proceed
    if (ssoPolicy?.ssoEnabled && ssoPolicy?.enforceSso && ssoPolicy?.allowLocalAuth) {
      // User can use either, but SSO is preferred
      console.log('SSO is enabled but local auth is allowed');
    }
    
    setIsSubmittingLogin(true);

    try {
      await login({ email: loginEmail, password: loginPassword });
      toast({
        title: "Welcome Back!",
        description: "Successfully logged in",
      });
      // Add a small delay to ensure auth state is updated
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
    setIsSubmittingSignup(true);

    try {
      await signup({
        name: signupName,
        email: signupEmail,
        password: signupPassword,
      });
      toast({
        title: "Account Created!",
        description: "Please check your email to verify your account. You'll receive a verification link shortly.",
        duration: 8000,
      });
      // Clear form
      setSignupName("");
      setSignupEmail("");
      setSignupPassword("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Signup Failed",
        description: error.message || "Failed to create account",
      });
    } finally {
      setIsSubmittingSignup(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      {/* Star trails background with purple overlay */}
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
        {/* Back to Home Link */}
        <Link href="/">
          <Button variant="ghost" className="text-white hover:bg-white/10">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-xl">Vega</h1>
          <p className="text-gray-200">Your AI-Augmented Company OS</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="login" data-testid="tab-email-login">Login</TabsTrigger>
            <TabsTrigger value="signup" data-testid="tab-signup">Sign Up</TabsTrigger>
            <TabsTrigger value="demo" data-testid="tab-demo-login">Demo</TabsTrigger>
          </TabsList>

          <TabsContent value="demo">
            <Card className="backdrop-blur-md bg-background/95 border-white/20">
              <CardHeader>
                <CardTitle>Demo Access</CardTitle>
                <CardDescription>
                  Quick access with demo password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleDemoLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="demo-password">Demo Password</Label>
                    <div className="relative">
                      <Input
                        id="demo-password"
                        type={showDemoPassword ? "text" : "password"}
                        value={demoPassword}
                        onChange={(e) => setDemoPassword(e.target.value)}
                        placeholder="Enter demo password"
                        data-testid="input-demo-password"
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowDemoPassword(!showDemoPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        data-testid="button-toggle-demo-password"
                        aria-label={showDemoPassword ? "Hide password" : "Show password"}
                      >
                        {showDemoPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmittingDemo}
                    data-testid="button-demo-login"
                  >
                    {isSubmittingDemo ? "Logging in..." : "Login as Demo User"}
                  </Button>
                  <p className="text-sm text-muted-foreground text-center">
                    Logs you in as a standard user for Acme Corporation
                  </p>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="login">
            <Card className="backdrop-blur-md bg-background/95 border-white/20">
              <CardHeader>
                <CardTitle>Email Login</CardTitle>
                <CardDescription>
                  Sign in with your organization email
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                  
                  {/* SSO Policy Alert */}
                  {ssoPolicy?.ssoRequired && (
                    <Alert className="border-primary/50 bg-primary/10">
                      <Shield className="h-4 w-4" />
                      <AlertDescription>
                        <span className="font-medium">{ssoPolicy.tenantName || 'Your organization'}</span> requires Microsoft SSO login.
                        Click "Sign in with Microsoft" below.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {ssoPolicy?.ssoEnabled && !ssoPolicy?.ssoRequired && (
                    <Alert className="border-blue-500/50 bg-blue-500/10">
                      <Shield className="h-4 w-4 text-blue-500" />
                      <AlertDescription className="text-blue-700 dark:text-blue-300">
                        <span className="font-medium">{ssoPolicy.tenantName}</span> supports Microsoft SSO.
                        You can use either SSO or your password.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {/* Password field - only show if not SSO required */}
                  {!ssoPolicy?.ssoRequired && (
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
                          required={!ssoPolicy?.ssoRequired}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          data-testid="button-toggle-login-password"
                          aria-label={showLoginPassword ? "Hide password" : "Show password"}
                        >
                          {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {!ssoPolicy?.ssoRequired && (
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmittingLogin}
                      data-testid="button-email-login"
                    >
                      {isSubmittingLogin ? "Logging in..." : "Login"}
                    </Button>
                  )}
                  
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        {ssoPolicy?.ssoRequired ? "Continue with" : "Or continue with"}
                      </span>
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    variant={ssoPolicy?.ssoRequired ? "default" : "outline"}
                    className="w-full"
                    onClick={() => window.location.href = `/auth/entra/login${ssoPolicy?.tenantId ? `?tenant=${ssoPolicy.tenantId}` : ''}`}
                    data-testid="button-sso-login"
                  >
                    <SquareStack className="mr-2 h-4 w-4" />
                    Sign in with Microsoft
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card className="backdrop-blur-md bg-background/95 border-white/20">
              <CardHeader>
                <CardTitle>Create Account</CardTitle>
                <CardDescription>
                  Sign up with your organization email
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                    <Label htmlFor="signup-email">Email</Label>
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
                        aria-label={showSignupPassword ? "Hide password" : "Show password"}
                      >
                        {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmittingSignup}
                    data-testid="button-signup"
                  >
                    {isSubmittingSignup ? "Creating account..." : "Sign Up"}
                  </Button>
                  <p className="text-sm text-muted-foreground text-center">
                    Your email domain must match an allowed organization
                  </p>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
