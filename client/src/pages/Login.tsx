import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import starTrailsBg from "@assets/AdobeStock_362805421_1763398687511.jpeg";

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
        description: "Welcome to Vega",
      });
      setLocation("/dashboard");
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

        <Tabs defaultValue="demo" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="demo" data-testid="tab-demo-login">Demo</TabsTrigger>
            <TabsTrigger value="login" data-testid="tab-email-login">Login</TabsTrigger>
            <TabsTrigger value="signup" data-testid="tab-signup">Sign Up</TabsTrigger>
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Password</Label>
                      <button
                        type="button"
                        onClick={() => {/* Password reset placeholder */}}
                        className="text-xs text-primary hover:underline"
                        data-testid="link-forgot-password"
                      >
                        Forgot password?
                      </button>
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
                        aria-label={showLoginPassword ? "Hide password" : "Show password"}
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
