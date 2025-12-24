import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const verificationAttempted = useRef(false);

  useEffect(() => {
    // Prevent duplicate verification requests
    if (verificationAttempted.current) {
      return;
    }
    verificationAttempted.current = true;

    const verifyEmail = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. No token provided.');
        return;
      }

      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
          credentials: 'include',
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.error || 'Email verification failed.');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
        setMessage('An error occurred during verification. Please try again.');
      }
    };

    verifyEmail();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-background" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === 'loading' && (
              <Loader2 className="h-16 w-16 text-primary animate-spin" data-testid="icon-loading" />
            )}
            {status === 'success' && (
              <CheckCircle2 className="h-16 w-16 text-green-500" data-testid="icon-success" />
            )}
            {status === 'error' && (
              <XCircle className="h-16 w-16 text-destructive" data-testid="icon-error" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {status === 'loading' && 'Verifying Email...'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </CardTitle>
          <CardDescription data-testid="text-message">
            {status === 'loading' && 'Please wait while we verify your email address.'}
            {message}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {status === 'success' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Your account has been successfully verified. You can now log in with your credentials.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                The verification link may have expired or is invalid. If you continue to have issues, please contact support.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-center">
          <Button
            onClick={() => setLocation('/login')}
            data-testid="button-goto-login"
            className="w-full"
          >
            {status === 'success' ? 'Go to Login' : 'Back to Login'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
