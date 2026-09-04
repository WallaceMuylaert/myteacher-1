import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const OAuthCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { refreshUser } = useAuth();

    useEffect(() => {
        const token = searchParams.get('token');
        const redirect = searchParams.get('redirect') || '/dashboard';

        if (token) {
            localStorage.setItem('token', token);
            window.dispatchEvent(new Event('storage'));

            // Se foi aberto como popup, comunica a janela pai e fecha o popup
            if (window.opener && !window.opener.closed) {
                try {
                    window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', token, redirect }, window.location.origin);
                    window.close();
                    return;
                } catch (e) {
                    console.error('Error posting message to opener:', e);
                }
            }

            // Redirecionamento normal se não for popup
            refreshUser().then(() => {
                navigate(redirect, { replace: true });
            });
        } else {
            if (window.opener && !window.opener.closed) {
                try {
                    window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR' }, window.location.origin);
                    window.close();
                    return;
                } catch (e) {
                    console.error('Error posting message to opener:', e);
                }
            }
            navigate('/login?error=oauth_failed', { replace: true });
        }
    }, [searchParams, navigate, refreshUser]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-bg-dark text-text-main p-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-text-muted font-medium text-base">Autenticando com o Google...</p>
        </div>
    );
};

export default OAuthCallback;
