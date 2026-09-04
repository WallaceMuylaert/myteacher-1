import { useEffect, useState, useMemo } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Loading } from '../components/Loading';
import { 
    AlertCircle, 
    GraduationCap, 
    ClipboardList, 
    ArrowRight, 
    X, 
    HelpCircle, 
    Users, 
    Clock, 
    Video, 
    Calendar, 
    BookOpen, 
    CheckCircle2, 
    Search,
    Check,
    History
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Toast, type ToastType } from '../components/Toast';

interface DashboardStats {
    overview: {
        classes_count: number;
        sessions_count: number;
    };
    students: {
        active: number;
        inactive: number;
        total: number;
    };
    payments: {
        current_month: number;
        current_year: number;
        paid: number;
        total_expected: number;
        pending: number;
    };
}

interface TodayClass {
    id: number;
    name: string;
    schedule: string;
    today_time: string;
    student_count: number;
    has_attendance_today: boolean;
    start_minutes: number;
    meet_link?: string;
}

const MONTHS = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const DAY_MATCHERS: { [key: number]: string[] } = {
    0: ['domingo', 'domingos', 'dom'],
    1: ['segunda', 'segundas', 'seg'],
    2: ['terça', 'terças', 'ter'],
    3: ['quarta', 'quartas', 'qua'],
    4: ['quinta', 'quintas', 'qui'],
    5: ['sexta', 'sextas', 'sex'],
    6: ['sábado', 'sábados', 'sab', 'sáb'],
};

const isClassToday = (schedule: string, jsDay: number): boolean => {
    if (!schedule) return false;
    const lower = schedule.toLowerCase();
    const matchers = DAY_MATCHERS[jsDay] || [];
    return matchers.some(m => lower.includes(m));
};

const extractTimeRange = (schedule: string): string => {
    const match = schedule.match(/(\d{1,2}:\d{2})\s*(?:às|as|-|to)\s*(\d{1,2}:\d{2})/i);
    if (match) return `${match[1]} às ${match[2]}`;
    const singleMatch = schedule.match(/(\d{1,2}:\d{2})/);
    if (singleMatch) return singleMatch[1];
    return schedule || 'Horário a definir';
};

const extractStartMinutes = (schedule: string, todayTime: string): number => {
    const combined = `${todayTime} ${schedule}`;
    const match = combined.match(/(\d{1,2}):(\d{2})/);
    if (!match) return 9999;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
};

// Uma barra que é uma linha: cheia na cor de sucesso significa mês fechado.
const ClosingBar = ({ paid, pending }: { paid: number; pending: number }) => {
    const total = paid + pending;
    if (total === 0) {
        return <div className="h-2.5 w-full rounded-[2px]" style={{ background: 'var(--desk-sunk)' }} />;
    }
    const paidPct = (paid / total) * 100;
    return (
        <div
            className="flex h-2.5 w-full overflow-hidden rounded-[2px]"
            style={{ background: 'var(--desk-sunk)' }}
            role="img"
            aria-label={`${paid} de ${total} mensalidades quitadas`}
        >
            {paid > 0 && <div style={{ width: `${paidPct}%`, background: 'var(--color-success)' }} />}
            {pending > 0 && <div style={{ width: `${100 - paidPct}%`, background: 'var(--ochre)' }} />}
        </div>
    );
};

const Figure = ({ label, value, note }: { label: string; value: number; note?: string }) => (
    <div className="px-4 py-3.5 sm:px-5" style={{ background: 'var(--sheet)' }}>
        <p className="label-print">{label}</p>
        <p className="mt-1.5 text-2xl font-bold text-text-main tabular">{value}</p>
        {note && <p className="mt-0.5 text-xs text-text-muted">{note}</p>}
    </div>
);

export const Dashboard = () => {
    const { user } = useAuth();

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [todayClasses, setTodayClasses] = useState<TodayClass[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hideTutorial, setHideTutorial] = useState(() => localStorage.getItem('hideTutorial') === 'true');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    // Retorno do checkout do Stripe: confirma a ativação e limpa o param da URL.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('assinatura') === 'ok') {
            setToast({ message: 'Assinatura ativada! Bem-vindo(a) de volta.', type: 'success' });
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    const handleDismissTutorial = () => {
        localStorage.setItem('hideTutorial', 'true');
        setHideTutorial(true);
    };

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const now = new Date();
                const jsDay = now.getDay();
                
                // Formato local YYYY-MM-DD para checagem precisa
                const localYear = now.getFullYear();
                const localMonth = String(now.getMonth() + 1).padStart(2, '0');
                const localDay = String(now.getDate()).padStart(2, '0');
                const todayDateStr = `${localYear}-${localMonth}-${localDay}`;

                const [statsRes, classesRes, eventsRes] = await Promise.all([
                    api.get('/dashboard/stats'),
                    api.get('/classes/').catch(() => ({ data: [] })),
                    api.get(`/calendar/events?start_date=${todayDateStr}&end_date=${todayDateStr}`).catch(() => ({ data: [] }))
                ]);

                setStats(statsRes.data);

                if (classesRes.data && Array.isArray(classesRes.data)) {
                    const matched = await Promise.all(
                        classesRes.data.map(async (cls: any) => {
                            const isToday = isClassToday(cls.schedule, jsDay);
                            const matchingEvent = eventsRes.data?.find((e: any) => e.class_id === cls.id);
                            
                            if (isToday || matchingEvent) {
                                let studentCount = 0;
                                let hasAttendanceToday = false;

                                try {
                                    const [stRes, attRes] = await Promise.all([
                                        api.get(`/classes/${cls.id}/students`).catch(() => ({ data: [] })),
                                        api.get(`/classes/${cls.id}/attendance`).catch(() => ({ data: [] }))
                                    ]);
                                    studentCount = stRes.data?.length ?? 0;
                                    
                                    if (Array.isArray(attRes.data)) {
                                        hasAttendanceToday = attRes.data.some((session: any) => {
                                            if (!session.date) return false;
                                            return session.date === todayDateStr || session.date.startsWith(todayDateStr);
                                        });
                                    }
                                } catch {
                                    studentCount = 0;
                                    hasAttendanceToday = false;
                                }

                                const eventTime = matchingEvent?.start_time && matchingEvent?.end_time
                                    ? `${matchingEvent.start_time.slice(11, 16)} às ${matchingEvent.end_time.slice(11, 16)}`
                                    : extractTimeRange(cls.schedule);

                                const startMinutes = extractStartMinutes(cls.schedule, eventTime);

                                return {
                                    id: cls.id,
                                    name: cls.name,
                                    schedule: cls.schedule,
                                    today_time: eventTime,
                                    student_count: studentCount,
                                    has_attendance_today: hasAttendanceToday,
                                    start_minutes: startMinutes,
                                    meet_link: matchingEvent?.location_or_link || matchingEvent?.meet_link
                                };
                            }
                            return null;
                        })
                    );
                    
                    const validClasses = matched.filter(Boolean) as TodayClass[];
                    // Ordena cronologicamente pelo horário de início
                    validClasses.sort((a, b) => a.start_minutes - b.start_minutes);
                    setTodayClasses(validClasses);
                }
            } catch (err: any) {
                console.error('Error fetching dashboard stats:', err);
                setError(err.message || 'Erro ao carregar dados');
            } finally {
                setIsLoading(false);
            }
        };
        fetchDashboardData();
    }, []);

    const pendingCount = useMemo(() => todayClasses.filter(c => !c.has_attendance_today).length, [todayClasses]);
    const completedCount = useMemo(() => todayClasses.filter(c => c.has_attendance_today).length, [todayClasses]);

    const filteredClasses = useMemo(() => {
        return todayClasses.filter(cls => {
            const matchesSearch = cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cls.today_time.toLowerCase().includes(searchTerm.toLowerCase()) ||
                cls.schedule.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (!matchesSearch) return false;

            if (filterStatus === 'pending') return !cls.has_attendance_today;
            if (filterStatus === 'completed') return cls.has_attendance_today;
            return true;
        });
    }, [todayClasses, searchTerm, filterStatus]);

    if (isLoading) {
        return (
            <div className="h-[50vh] flex items-center justify-center">
                <Loading text="Carregando painel..." />
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-[50vh] flex flex-col items-center justify-center gap-3 text-center">
                <AlertCircle size={40} className="text-danger" />
                <p className="text-xl font-semibold text-text-main">Não foi possível carregar o painel</p>
                <p className="text-text-muted max-w-sm">{error}</p>
                <button onClick={() => window.location.reload()} className="btn btn-primary mt-2">
                    Tentar novamente
                </button>
            </div>
        );
    }

    if (!stats) return null;

    const isFirstTime = !hideTutorial;
    const firstName = user?.full_name?.split(' ')[0] || 'Professor(a)';
    const monthName = MONTHS[stats.payments.current_month - 1] ?? '';
    const { paid, pending, total_expected } = stats.payments;
    const settled = total_expected > 0 && pending === 0;

    const formattedTodayDate = new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
    });

    return (
        <div className="animate-slide-up space-y-6">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <header className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-text-main">Olá, {firstName}</h1>
                    <p className="text-text-muted mt-1.5 capitalize">
                        {formattedTodayDate} • Situação de {monthName} de {stats.payments.current_year}.
                    </p>
                </div>
                {hideTutorial && (
                    <button
                        onClick={() => {
                            localStorage.setItem('hideTutorial', 'false');
                            setHideTutorial(false);
                        }}
                        className="btn btn-outline shrink-0"
                    >
                        <HelpCircle size={17} className="text-primary" />
                        <span>Mostrar o passo a passo</span>
                    </button>
                )}
            </header>

            {/* Aulas de Hoje */}
            <section className="sheet sheet-p">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-[2px] bg-primary/15 border border-primary/20 text-primary">
                            <Clock size={18} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                                Aulas de hoje
                                {todayClasses.length > 0 && (
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/15 text-primary border border-primary/20">
                                        {completedCount}/{todayClasses.length} chamadas feitas
                                    </span>
                                )}
                            </h2>
                            <p className="text-xs text-text-muted capitalize">
                                {todayClasses.length === 0 
                                    ? 'Nenhum horário marcado para hoje' 
                                    : `${pendingCount} pendente${pendingCount !== 1 ? 's' : ''} • ${completedCount} realizada${completedCount !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Link to="/dashboard/agenda" className="text-xs font-semibold text-primary no-underline hover:underline flex items-center gap-1 shrink-0">
                            <Calendar size={13} />
                            <span>Ver agenda completa</span>
                            <ArrowRight size={13} />
                        </Link>
                    </div>
                </div>

                {todayClasses.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-4 pb-3 border-b border-border">
                        {/* Filtros de Status */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-[2px] border transition-all cursor-pointer whitespace-nowrap ${
                                    filterStatus === 'all'
                                        ? 'bg-primary text-[var(--on-institution)] border-primary'
                                        : 'bg-[var(--wash-1)] text-text-muted hover:text-text-main border-border'
                                }`}
                            >
                                Todas ({todayClasses.length})
                            </button>
                            <button
                                onClick={() => setFilterStatus('pending')}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-[2px] border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                                    filterStatus === 'pending'
                                        ? 'bg-amber-600 text-white border-amber-600'
                                        : 'bg-[var(--wash-1)] text-text-muted hover:text-text-main border-border'
                                }`}
                            >
                                Pendentes ({pendingCount})
                            </button>
                            <button
                                onClick={() => setFilterStatus('completed')}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-[2px] border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                                    filterStatus === 'completed'
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-[var(--wash-1)] text-text-muted hover:text-text-main border-border'
                                }`}
                            >
                                <Check size={12} />
                                Realizadas ({completedCount})
                            </button>
                        </div>

                        {/* Campo de Busca Rápida */}
                        {todayClasses.length >= 3 && (
                            <div className="relative flex items-center min-w-[200px]">
                                <Search size={13} className="absolute left-2.5 text-text-muted pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Buscar turma ou horário..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-[var(--wash-1)] text-xs text-text-main rounded-[2px] border border-border pl-8 pr-7 py-1.5 focus:outline-none focus:border-primary transition-all placeholder:text-text-muted/60"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="absolute right-2 text-text-muted hover:text-text-main"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {todayClasses.length === 0 ? (
                    <div className="p-6 rounded-[2px] border border-dashed border-border bg-[var(--wash-1)] text-center flex flex-col items-center justify-center gap-1.5">
                        <div className="p-2.5 rounded-full bg-primary/10 text-primary mb-1">
                            <BookOpen size={20} />
                        </div>
                        <p className="text-sm font-semibold text-text-main">Nenhuma aula programada para hoje</p>
                        <p className="text-xs text-text-muted max-w-md">
                            Aproveite o dia livre para preparar planos de aula, revisar notas ou lançar frequências pendentes.
                        </p>
                    </div>
                ) : filteredClasses.length === 0 ? (
                    <div className="p-6 text-center text-text-muted text-xs border border-dashed border-border rounded-[2px]">
                        Nenhuma turma encontrada com o filtro selecionado.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredClasses.map((item) => {
                            const isDone = item.has_attendance_today;

                            return (
                                <div
                                    key={item.id}
                                    className={`p-4 rounded-[3px] border transition-all flex flex-col justify-between group shadow-sm ${
                                        isDone
                                            ? 'bg-[var(--wash-1)] border-border hover:border-emerald-500/40 opacity-90'
                                            : 'bg-bg-card border-primary/30 hover:border-primary shadow-sm hover:shadow'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[2px] text-xs font-bold font-mono border ${
                                                isDone
                                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                                    : 'bg-primary/15 text-primary border-primary/25'
                                            }`}>
                                                <Clock size={11} /> {item.today_time}
                                            </span>

                                            {isDone ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-[2px] border border-emerald-500/20">
                                                    <CheckCircle2 size={12} /> Feita
                                                </span>
                                            ) : (
                                                <span className="text-[11px] text-amber-500 font-semibold flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                    Pendente
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="font-bold text-text-main group-hover:text-primary transition-colors text-base leading-snug">
                                            {item.name}
                                        </h3>

                                        <div className="flex items-center justify-between gap-2 mt-1.5 text-xs text-text-muted">
                                            <span className="flex items-center gap-1">
                                                <Users size={12} className="text-primary/70" /> {item.student_count ?? 0} {item.student_count === 1 ? 'aluno' : 'alunos'}
                                            </span>
                                            {item.schedule && (
                                                <span className="truncate max-w-[140px] text-[11px] opacity-70" title={item.schedule}>
                                                    {item.schedule}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
                                        {item.meet_link && (
                                            <a
                                                href={item.meet_link}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-2 rounded-[2px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                                                title="Entrar no Google Meet"
                                            >
                                                <Video size={14} />
                                            </a>
                                        )}
                                        
                                        {isDone ? (
                                            <Link
                                                to={`/dashboard/class/${item.id}?tab=history`}
                                                className="px-3 py-1.5 rounded-[2px] text-xs font-semibold border border-border bg-[var(--wash-2)] text-text-muted hover:text-text-main hover:border-border transition-all flex-1 flex items-center justify-center gap-1.5 no-underline hover:bg-[var(--wash-1)]"
                                                title="Ver histórico de chamadas e aulas anteriores desta turma"
                                            >
                                                <History size={13} className="text-emerald-500" />
                                                <span>Ver Histórico</span>
                                            </Link>
                                        ) : (
                                            <Link
                                                to={`/dashboard/class/${item.id}`}
                                                className="btn btn-primary text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5 font-bold no-underline shadow-sm"
                                            >
                                                <ClipboardList size={13} />
                                                <span>Fazer Chamada</span>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {isFirstTime && (
                <section className="sheet sheet-p relative">
                    <button
                        onClick={handleDismissTutorial}
                        className="absolute top-3 right-3 p-2 text-text-muted hover:text-text-main hover:bg-[var(--wash-2)] rounded-[2px] transition-colors duration-150"
                        aria-label="Ocultar o passo a passo"
                    >
                        <X size={18} />
                    </button>
                    <h2 className="text-lg font-semibold text-text-main pr-10">Comece por aqui</h2>
                    <p className="text-text-muted mt-1 text-sm">Três passos para o primeiro mês ficar completo.</p>

                    <ol className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-px" style={{ background: 'var(--rule)' }}>
                        {[
                            { n: 1, to: '/dashboard/classes', icon: GraduationCap, title: 'Criar uma turma', note: 'Defina a disciplina e o valor da mensalidade.' },
                            { n: 2, to: '/dashboard/students', icon: Users, title: 'Cadastrar alunos', note: 'Matricule cada aluno na turma dele.' },
                            { n: 3, to: '/dashboard/classes', icon: ClipboardList, title: 'Fazer a chamada', note: 'Abra a turma e marque as presenças do dia.' },
                        ].map(({ n, to, icon: Icon, title, note }) => (
                            <li key={n} style={{ background: 'var(--sheet)' }}>
                                <Link
                                    to={to}
                                    className="flex h-full items-start gap-3 p-4 no-underline transition-colors duration-150 group"
                                >
                                    <Icon size={19} className="mt-0.5 shrink-0 text-primary" />
                                    <span className="min-w-0 flex-1">
                                        <span className="label-print">Passo {n}</span>
                                        <span className="mt-1 block text-sm font-semibold text-text-main group-hover:text-primary transition-colors">
                                            {title}
                                        </span>
                                        <span className="mt-0.5 block text-xs text-text-muted leading-snug">{note}</span>
                                    </span>
                                    <ArrowRight size={15} className="mt-0.5 shrink-0 text-text-muted group-hover:text-primary transition-colors" />
                                </Link>
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            {/* O fechamento do mês: a pergunta que o professor abre o sistema
                para responder, respondida antes de qualquer clique. */}
            <section className="sheet sheet-p">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 className="text-lg font-semibold text-text-main">Fechamento de {monthName}</h2>
                    <Link to="/dashboard/payments" className="text-sm font-semibold text-primary no-underline hover:underline">
                        Abrir o financeiro
                    </Link>
                </div>

                {total_expected === 0 ? (
                    <p className="mt-4 text-text-muted">
                        Nenhuma mensalidade lançada para {monthName} ainda.
                    </p>
                ) : (
                    <>
                        <p className="mt-3 text-text-main">
                            <span className="text-3xl font-bold tabular">{paid}</span>
                            <span className="text-text-muted"> de </span>
                            <span className="text-3xl font-bold tabular">{total_expected}</span>
                            <span className="text-text-muted"> mensalidades quitadas</span>
                        </p>

                        <div className="mt-4">
                            <ClosingBar paid={paid} pending={pending} />
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="stamp stamp-paid">{paid} pago{paid === 1 ? '' : 's'}</span>
                            {pending > 0 && <span className="stamp stamp-pending">{pending} a receber</span>}
                            {settled && <span className="text-sm text-text-muted">Mês fechado. Nada pendente.</span>}
                        </div>
                    </>
                )}
            </section>

            {/* Os números do registro num quadro dividido por fios, não em
                quatro cartões flutuando. */}
            <section className="mt-6">
                <h2 className="label-print mb-2">Quadro geral</h2>
                <div className="sheet overflow-hidden">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: 'var(--rule)' }}>
                        <Figure
                            label="Alunos ativos"
                            value={stats.students.active}
                            note={stats.students.inactive > 0
                                ? `${stats.students.inactive} inativo${stats.students.inactive === 1 ? '' : 's'}`
                                : 'Nenhum inativo'}
                        />
                        <Figure label="Turmas" value={stats.overview.classes_count} />
                        <Figure label="Chamadas feitas" value={stats.overview.sessions_count} note="Desde o início" />
                        <Figure label="Cadastro total" value={stats.students.total} note="Ativos e inativos" />
                    </div>
                </div>
            </section>
        </div>
    );
};
