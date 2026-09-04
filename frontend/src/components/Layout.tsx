import { useState } from 'react';
import { Link, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { LogOut, LayoutDashboard, GraduationCap, Menu, X, ChevronLeft, ChevronRight, Settings, UserCircle, DollarSign, MessageCircle, Users, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { openSupportWhatsApp } from '../utils/support';

type NavEntry = {
    to: string;
    label: string;
    short: string;
    icon: typeof LayoutDashboard;
    match: (path: string) => boolean;
    adminOnly?: boolean;
};

// Uma lista só: a sidebar e a barra inferior liam o mesmo destino de dois
// lugares diferentes, e foi assim que o "Painel" do mobile acabou apontando
// para o portal do aluno.
const NAV: NavEntry[] = [
    { to: '/dashboard', label: 'Painel', short: 'Painel', icon: LayoutDashboard, match: p => p === '/dashboard' },
    { to: '/dashboard/agenda', label: 'Agenda', short: 'Agenda', icon: Calendar, match: p => p.includes('/agenda') },
    { to: '/dashboard/classes', label: 'Turmas', short: 'Turmas', icon: GraduationCap, match: p => p.includes('/classes') || p.includes('/class/') },
    { to: '/dashboard/students', label: 'Alunos', short: 'Alunos', icon: Users, match: p => p.includes('/students') },
    { to: '/dashboard/payments', label: 'Financeiro', short: 'Financeiro', icon: DollarSign, match: p => p.includes('/payments') },
    { to: '/dashboard/admin', label: 'Administração', short: 'Admin', icon: Settings, match: p => p.includes('/admin'), adminOnly: true },
];

export const Layout = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const entries = NAV.filter(e => !e.adminOnly || user?.is_admin);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleSupportClick = () => {
        openSupportWhatsApp('Olá! Preciso de ajuda com o MyTeacherApp.');
    };

    return (
        <div className="flex h-screen bg-bg-dark overflow-hidden relative">
            {/* Cabeçalho no celular */}
            <header className="md:hidden flex items-center justify-between px-4 py-3 sheet-header w-full fixed top-0 left-0 z-50">
                <h1 className="flex items-center gap-2 font-bold text-lg">
                    <GraduationCap size={22} className="text-primary" /> MyTeacherApp
                </h1>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-text-muted hover:text-text-main rounded-[2px] hover:bg-[var(--wash-2)] transition-colors duration-150"
                    aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
                    aria-expanded={isMobileMenuOpen}
                >
                    {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </header>

            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-40 md:hidden"
                    style={{ background: 'var(--scrim)' }}
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`
                    fixed md:static inset-y-0 left-0 z-50 sheet-sidebar flex flex-col transition-[width,transform] duration-300 ease-in-out
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    ${isSidebarCollapsed ? 'w-[70px]' : 'w-[260px]'}
                `}
            >
                <div className="h-[73px] flex items-center relative rule-b">
                    <div className={`flex items-center gap-2 font-bold text-xl transition-colors duration-150 ${isSidebarCollapsed ? 'justify-center w-full px-0' : 'px-6'}`}>
                        <GraduationCap size={24} className="shrink-0 text-primary" />
                        <span className={`whitespace-nowrap overflow-hidden transition-[width,opacity] duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                            MyTeacherApp
                        </span>
                    </div>

                    <button
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 bg-bg-card border border-rule-strong rounded-[2px] p-1.5 hidden md:flex text-text-muted hover:text-text-main hover:border-primary transition-colors duration-150 z-10"
                        aria-label={isSidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
                    >
                        {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                    </button>
                </div>

                <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
                    {entries.map(({ to, label, icon: Icon, match }) => {
                        const active = match(location.pathname);
                        return (
                            <Link
                                key={to}
                                to={to}
                                onClick={() => setIsMobileMenuOpen(false)}
                                aria-current={active ? 'page' : undefined}
                                className={`nav-item ${active ? 'active' : ''} ${isSidebarCollapsed ? 'justify-center gap-0' : 'gap-3'}`}
                                title={label}
                            >
                                <Icon size={19} className="shrink-0" />
                                <span className={`whitespace-nowrap transition-[width,opacity] duration-300 ${isSidebarCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'}`}>
                                    {label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-3 rule-t space-y-1.5">
                    <Link
                        to="/dashboard/profile"
                        className={`flex items-center gap-3 px-2 py-2 rounded-[2px] transition-colors duration-150 group ${location.pathname === '/dashboard/profile' ? 'bg-[var(--wash-2)]' : 'hover:bg-[var(--wash-1)]'}`}
                        title="Meu perfil"
                    >
                        <div className="shrink-0">
                            {user?.avatar ? (
                                <img src={user.avatar} alt="" className="w-9 h-9 rounded-full border border-border object-cover" />
                            ) : (
                                <UserCircle size={34} className="text-text-muted group-hover:text-primary transition-colors" />
                            )}
                        </div>
                        {!isSidebarCollapsed && (
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold text-text-main truncate group-hover:text-primary transition-colors">
                                    {user?.full_name || 'Usuário'}
                                </span>
                                <span className="text-xs text-text-muted truncate">{user?.email}</span>
                            </div>
                        )}
                    </Link>

                    <button
                        onClick={handleSupportClick}
                        className={`btn btn-outline w-full text-primary ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-start'}`}
                        title="Suporte via WhatsApp"
                    >
                        <MessageCircle size={17} />
                        {!isSidebarCollapsed && <span>Suporte</span>}
                    </button>
                    <button
                        onClick={handleLogout}
                        className={`btn btn-ghost w-full ${isSidebarCollapsed ? 'justify-center px-2' : 'justify-start'}`}
                        title="Sair da conta"
                    >
                        <LogOut size={17} />
                        {!isSidebarCollapsed && <span>Sair</span>}
                    </button>
                </div>
            </aside>

            {/* Barra inferior no celular. O item ativo ganha o fio de 2px no topo. */}
            <nav
                className="md:hidden fixed bottom-0 left-0 right-0 z-50 sheet-footer-nav flex items-stretch justify-around px-1"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 6px)' }}
            >
                {entries.slice(0, 5).map(({ to, short, icon: Icon, match }) => {
                    const active = match(location.pathname);
                    return (
                        <Link
                            key={to}
                            to={to}
                            aria-current={active ? 'page' : undefined}
                            className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 px-3 min-w-[64px] border-t-2 transition-colors duration-150 ${
                                active ? 'border-t-primary text-primary' : 'border-t-transparent text-text-muted'
                            }`}
                        >
                            <Icon size={19} />
                            <span className="text-[0.6875rem] font-medium tracking-[0.03em]">{short}</span>
                        </Link>
                    );
                })}
            </nav>

            <main className="flex-1 overflow-auto px-3 py-4 sm:p-4 md:p-6 lg:p-8 pt-16 md:pt-6 lg:pt-8 pb-24 md:pb-6 lg:pb-8 w-full h-screen">
                <div className="container mx-auto max-w-6xl">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
