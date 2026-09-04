import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowLeft, User, Mail, Lock, Loader2, CheckCircle } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const TRIAL_DAYS = 14;

export const Register = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    // A landing e a página de preços mandam o plano escolhido; é só contexto, o
    // pagamento acontece quando o teste acaba.
    const planName = (location.state as { planName?: string } | null)?.planName;

    const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [field]: e.target.value }));

    const handleGoogleLogin = () => {
        const apiUrl = import.meta.env.VITE_API_URL || '/api';
        window.location.href = `${apiUrl}/auth/google`;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (form.password.length < 8) {
            setError('A senha precisa ter pelo menos 8 caracteres.');
            return;
        }

        setLoading(true);
        try {
            await api.post('/register', form);
            // Entra direto com email e senha
            await login(form.email, form.password);
            navigate('/dashboard');
        } catch (err: any) {
            if (err.code === 'ERR_NETWORK' || !err.response) {
                setError('Sistema offline. Verifique sua conexão e tente de novo.');
            } else if (err.response.status === 409) {
                setError(err.response.data.detail);
            } else if (err.response.status === 422) {
                setError('Confira os dados preenchidos e tente novamente.');
            } else {
                setError(err.response.data?.detail || 'Não foi possível criar sua conta. Tente de novo.');
            }
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-bg-dark text-text-main p-4 py-6 relative overflow-y-auto">
            {/* Botão Voltar no Canto Superior Esquerdo */}
            <div className="fixed top-4 left-4 sm:top-6 sm:left-6 z-20">
                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-muted hover:text-primary bg-bg-card/80 hover:bg-bg-card border border-rule-subtle rounded-[3px] backdrop-blur-sm transition-all shadow-sm cursor-pointer"
                >
                    <ArrowLeft size={15} />
                    <span>Voltar para o início</span>
                </button>
            </div>

            <div className="w-full max-w-[400px] animate-fade-in relative z-10">
                {/* Header Logo */}
                <div className="flex items-center justify-center gap-2 mb-3 text-primary font-bold text-lg">
                    <GraduationCap size={24} className="text-primary" />
                    <span className="text-text-main">MyTeacherApp</span>
                </div>

                {/* Card */}
                <div className="bg-bg-card border border-rule-strong rounded-[3px] p-5 sm:p-6 shadow-xl">
                    <div className="text-center mb-3">
                        <h1 className="text-xl font-bold text-text-main">Criar conta</h1>
                        <p className="text-xs text-text-muted mt-0.5">
                            {planName ? (
                                <>Plano <strong className="text-text-main">{planName}</strong>. </>
                            ) : null}
                            {TRIAL_DAYS} dias grátis, sem cartão de crédito.
                        </p>
                    </div>

                    {error && (
                        <div
                            role="alert"
                            className="mb-3 rounded-[2px] border border-danger/20 bg-danger/10 p-2.5 text-xs text-danger"
                        >
                            {error}
                        </div>
                    )}

                    {/* Botão Google */}
                    <div>
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            className="w-full flex items-center justify-center gap-2.5 bg-bg-dark hover:bg-[var(--wash-2)] border border-border text-text-main font-semibold py-2 px-3 rounded-[2px] text-xs transition-colors shadow-sm cursor-pointer"
                        >
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l2.85-2.22.83-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            <span>Continuar com o Google</span>
                        </button>
                    </div>

                    <div className="relative flex items-center my-3.5">
                        <div className="flex-grow border-t border-border"></div>
                        <span className="flex-shrink-0 mx-3 text-text-muted text-[10px] font-bold uppercase tracking-wider">ou</span>
                        <div className="flex-grow border-t border-border"></div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label htmlFor="first_name" className="block text-[11px] font-medium text-text-muted mb-1">
                                    Nome
                                </label>
                                <div className="relative">
                                    <User size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <input
                                        id="first_name"
                                        className="w-full pl-8 pr-2.5 py-1.5 bg-bg-dark border border-border rounded-[2px] text-xs text-text-main focus:border-primary focus:outline-none placeholder:text-text-muted/40"
                                        value={form.first_name}
                                        onChange={set('first_name')}
                                        required
                                        minLength={2}
                                        maxLength={60}
                                        autoComplete="given-name"
                                        placeholder="Maria"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="last_name" className="block text-[11px] font-medium text-text-muted mb-1">
                                    Sobrenome
                                </label>
                                <div className="relative">
                                    <User size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                                    <input
                                        id="last_name"
                                        className="w-full pl-8 pr-2.5 py-1.5 bg-bg-dark border border-border rounded-[2px] text-xs text-text-main focus:border-primary focus:outline-none placeholder:text-text-muted/40"
                                        value={form.last_name}
                                        onChange={set('last_name')}
                                        required
                                        minLength={2}
                                        maxLength={60}
                                        autoComplete="family-name"
                                        placeholder="Silva"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-[11px] font-medium text-text-muted mb-1">
                                E-mail
                            </label>
                            <div className="relative">
                                <Mail size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                                <input
                                    id="email"
                                    type="email"
                                    className="w-full pl-8 pr-2.5 py-1.5 bg-bg-dark border border-border rounded-[2px] text-xs text-text-main focus:border-primary focus:outline-none placeholder:text-text-muted/40"
                                    value={form.email}
                                    onChange={set('email')}
                                    required
                                    autoComplete="email"
                                    placeholder="maria@escola.com.br"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-[11px] font-medium text-text-muted mb-1">
                                Senha
                            </label>
                            <div className="relative">
                                <Lock size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                                <input
                                    id="password"
                                    type="password"
                                    className="w-full pl-8 pr-2.5 py-1.5 bg-bg-dark border border-border rounded-[2px] text-xs text-text-main focus:border-primary focus:outline-none placeholder:text-text-muted/40"
                                    value={form.password}
                                    onChange={set('password')}
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                    aria-describedby="password-hint"
                                    placeholder="••••••••"
                                />
                            </div>
                            <p id="password-hint" className="text-[10px] text-text-muted mt-0.5">
                                Mínimo de 8 caracteres.
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary w-full flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold rounded-[2px] disabled:pointer-events-none disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 mt-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Criando sua conta...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={16} />
                                    Começar {TRIAL_DAYS} dias grátis
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-4 text-center text-xs text-text-muted">
                        Já tem conta?{' '}
                        <button
                            onClick={() => navigate('/login')}
                            className="font-semibold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                            Entrar
                        </button>
                    </p>
                </div>

                <div className="text-center mt-3">
                    <button
                        onClick={() => navigate('/')}
                        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-main transition-colors"
                    >
                        <ArrowLeft size={14} /> Voltar para o início
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Register;
