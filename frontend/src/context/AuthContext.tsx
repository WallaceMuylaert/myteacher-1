import { createContext, useState, useContext, useEffect, type ReactNode } from 'react';
import api from '../api';

interface User {
    id: number;
    email: string;
    is_active: boolean;
    is_admin: boolean;
    is_trial: boolean;
    trial_started_at?: string;
    trial_days_remaining?: number | null;
    trial_expired?: boolean;
    plan_id?: string | null;
    max_classes?: number | null;
    full_name?: string;
    nickname?: string;
    avatar?: string;
}

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    updateUser: (userData: Partial<User>) => void;
    refreshUser: () => Promise<void>;
    isLoading: boolean;
    isTrialExpired: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTrialExpired, setIsTrialExpired] = useState(false);

    const refreshUser = async () => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const res = await api.get('/users/me');
                setUser(res.data);
                if (res.data.trial_expired) {
                    setIsTrialExpired(true);
                } else {
                    setIsTrialExpired(false);
                }
            } catch (err: any) {
                if (err.response?.status === 403 && err.response?.data?.detail === 'TRIAL_EXPIRED') {
                    setIsTrialExpired(true);
                } else {
                    localStorage.removeItem('token');
                }
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        } else {
            setUser(null);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshUser();

        const handleStorageChange = () => {
            refreshUser();
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const login = async (email: string, password: string) => {
        try {
            const params = new URLSearchParams();
            params.append('username', email);
            params.append('password', password);

            const res = await api.post('/token', params);
            const token = res.data.access_token;

            localStorage.setItem('token', token);

            // Fetch user immediately
            try {
                const userRes = await api.get('/users/me');
                setUser(userRes.data);
                setIsTrialExpired(false);
            } catch (err: any) {
                // Conta válida mas sem acesso (teste vencido ou assinatura cancelada):
                // MANTÉM o token — o paywall precisa dele para abrir o checkout e reassinar.
                if (err.response?.status === 403 && err.response?.data?.detail === 'TRIAL_EXPIRED') {
                    setIsTrialExpired(true);
                    setUser(null);
                    return;
                }
                console.error("Failed to fetch user profile after login", err);
                logout();
                throw err;
            }
        } catch (err: any) {
            console.error("Login failed", err);
            throw err;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        setIsTrialExpired(false);
    };

    const updateUser = (userData: Partial<User>) => {
        setUser(prev => prev ? { ...prev, ...userData } : null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, updateUser, refreshUser, isLoading, isTrialExpired }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
