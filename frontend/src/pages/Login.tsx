import React, { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, ArrowLeft } from 'lucide-react';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Divider,
    IconButton,
    InputAdornment,
    Link,
    Paper,
    Stack,
    TextField,
    ThemeProvider,
    Typography,
    createTheme,
} from '@mui/material';
import { openSupportWhatsApp } from '../utils/support';

// Paleta do sistema (DESIGN.md). O MUI vive só nesta tela, então o tema é
// montado aqui em vez de virar provider global.
const PALETTE = {
    ink: '#001D39',
    institution: '#0A4174',
    institutionPressed: '#001D39',
    institutionLight: '#49769F',
    inkDark: '#e7f3fa',
    institutionDark: '#7BBDE8',
};

export const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, user } = useAuth();
    const { theme: appTheme } = useTheme();
    const navigate = useNavigate();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const errorParam = params.get('error');
        if (errorParam === 'oauth_failed') {
            setError('Falha ao autenticar com o Google. Tente novamente ou use seu e-mail e senha.');
            window.history.replaceState({}, '', '/login');
        } else if (errorParam === 'google_not_configured') {
            setError('O login com o Google ainda não foi configurado no servidor.');
            window.history.replaceState({}, '', '/login');
        }
    }, []);

    const muiTheme = useMemo(() => {
        const dark = appTheme === 'ardosia';
        return createTheme({
            palette: {
                mode: dark ? 'dark' : 'light',
                primary: {
                    main: dark ? PALETTE.institutionDark : PALETTE.institution,
                    dark: PALETTE.institutionPressed,
                    light: PALETTE.institutionLight,
                    contrastText: dark ? PALETTE.ink : '#ffffff',
                },
                background: {
                    default: dark ? '#001D39' : '#eef4f9',
                    paper: dark ? '#0b2c4f' : '#ffffff',
                },
                text: {
                    primary: dark ? PALETTE.inkDark : PALETTE.ink,
                    secondary: dark ? '#a3c3d8' : '#46617c',
                },
            },
            shape: { borderRadius: 3 },
            typography: {
                fontFamily: 'Archivo, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
                button: { textTransform: 'none', fontWeight: 700 },
            },
            components: {
                MuiButton: { defaultProps: { disableElevation: true } },
                MuiPaper: { defaultProps: { elevation: 0 } },
            },
        });
    }, [appTheme]);

    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    useEffect(() => {
        const handleAuthMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
                navigate('/dashboard');
            } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
                setError('Falha ao autenticar com o Google. Tente novamente.');
            }
        };

        window.addEventListener('message', handleAuthMessage);
        return () => window.removeEventListener('message', handleAuthMessage);
    }, [navigate]);

    const handleGoogleLogin = () => {
        const apiUrl = import.meta.env.VITE_API_URL || '/api';
        const width = 500;
        const height = 650;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        window.open(
            `${apiUrl}/auth/google`,
            'google_login_popup',
            `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err: any) {
            console.error(err);
            // Se trial expirou, redirecionar para tela de trial expirado
            if (err.response?.status === 403 && err.response?.data?.detail === 'TRIAL_EXPIRED') {
                navigate('/trial-expired');
                return;
            }
            if (err.code === 'ERR_NETWORK' || !err.response) {
                setError('Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.');
            } else if (err.response?.status === 401) {
                setError('E-mail ou senha incorretos. Confira e tente de novo.');
            } else if (err.response?.data?.detail) {
                setError(err.response.data.detail);
            } else {
                setError('Algo deu errado ao entrar. Tente de novo em instantes.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemeProvider theme={muiTheme}>
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2,
                    bgcolor: 'background.default',
                    position: 'relative',
                }}
            >
                {/* Botão Voltar no Canto Superior Esquerdo */}
                <Box sx={{ position: 'fixed', top: { xs: 16, sm: 24 }, left: { xs: 16, sm: 24 }, zIndex: 50 }}>
                    <Button
                        startIcon={<ArrowLeft size={16} />}
                        onClick={() => navigate('/')}
                        sx={{
                            color: 'text.secondary',
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            px: 1.5,
                            py: 0.75,
                            borderRadius: 1.5,
                            border: '1px solid',
                            borderColor: muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                            bgcolor: muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.85)',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                            '&:hover': {
                                color: 'primary.main',
                                borderColor: 'primary.main',
                                bgcolor: muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#ffffff',
                            }
                        }}
                    >
                        Voltar para o início
                    </Button>
                </Box>

                <Box sx={{ width: '100%', maxWidth: 400 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center', mb: 3 }}>
                        <GraduationCap size={26} color={muiTheme.palette.primary.main} />
                        <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            MyTeacherApp
                        </Typography>
                    </Stack>

                    <Paper
                        variant="outlined"
                        component="div"
                        sx={{ p: { xs: 3, sm: 4 } }}
                    >
                        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            Entrar
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                            Acesse o seu registro.
                        </Typography>

                        {error && (
                            <Alert severity="error" sx={{ mt: 3 }} onClose={() => setError('')}>
                                {error}
                            </Alert>
                        )}

                        <Box sx={{ mt: 3 }}>
                            <Button
                                type="button"
                                variant="outlined"
                                size="large"
                                fullWidth
                                onClick={handleGoogleLogin}
                                sx={{
                                    borderColor: muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : '#dadce0',
                                    color: muiTheme.palette.mode === 'dark' ? '#fff' : '#3c4043',
                                    bgcolor: muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#ffffff',
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 1.5,
                                    py: 1.2,
                                    '&:hover': {
                                        bgcolor: muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#f8f9fa',
                                        borderColor: muiTheme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : '#dadce0',
                                    }
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l2.85-2.22.83-.62z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                Continuar com o Google
                            </Button>
                        </Box>

                        <Divider sx={{ my: 2.5, fontSize: '0.75rem', textTransform: 'uppercase', color: 'text.secondary' }}>
                            ou
                        </Divider>

                        <Stack component="form" onSubmit={handleSubmit} spacing={2.5}>
                            <TextField
                                label="E-mail"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                fullWidth
                                autoFocus
                                autoComplete="email"
                                placeholder="maria@escola.com.br"
                            />

                            <TextField
                                label="Senha"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                fullWidth
                                autoComplete="current-password"
                                slotProps={{
                                    input: {
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    edge="end"
                                                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                                >
                                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    },
                                }}
                            />

                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                fullWidth
                                disabled={loading}
                                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
                            >
                                {loading ? 'Entrando...' : 'Entrar'}
                            </Button>

                            <Link
                                component="button"
                                type="button"
                                variant="body2"
                                underline="hover"
                                sx={{ alignSelf: 'center' }}
                                onClick={() => openSupportWhatsApp('Olá! Esqueci a senha do MyTeacherApp e preciso de ajuda para recuperar.')}
                            >
                                Esqueceu a senha?
                            </Link>
                        </Stack>

                        <Divider sx={{ my: 3 }} />

                        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                            Ainda não tem conta?{' '}
                            <Link component="button" type="button" variant="body2" sx={{ fontWeight: 600 }} onClick={() => navigate('/register')}>
                                Comece o teste de 14 dias
                            </Link>
                        </Typography>
                    </Paper>

                    <Typography variant="body2" sx={{ textAlign: 'center', mt: 3 }}>
                        <Link component="button" type="button" underline="hover" sx={{ color: 'text.secondary' }} onClick={() => navigate('/')}>
                            Voltar para o início
                        </Link>
                    </Typography>
                </Box>
            </Box>
        </ThemeProvider>
    );
};

export default Login;
