import React, { useEffect, useState, useMemo } from 'react';
import api from '../api';
import { Plus, Calendar, Pencil, Trash, X, AlertTriangle, GripVertical, ArrowUpDown, BookOpen, Users, Clock, Video, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Loading } from '../components/Loading';
import { Toast, type ToastType } from '../components/Toast';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ClassModel {
    id: number;
    name: string;
    schedule: string;
    display_order?: number;
    student_count?: number;
    session_count?: number;
}

interface SortableClassCardProps {
    cls: ClassModel;
    index: number;
    isReorderMode: boolean;
    allClasses: ClassModel[];
    openEditModal: (e: React.MouseEvent, cls: ClassModel) => void;
    openDeleteModal: (e: React.MouseEvent, cls: ClassModel) => void;
}

const cardAccents = [
    { bg: 'bg-primary/10', border: 'border-primary/20', text: 'text-primary', glow: 'shadow-[0_0_12px_rgba(10,65,116,0.12)]' },
    { bg: 'bg-[#49769F]/10', border: 'border-[#49769F]/20', text: 'text-[#49769F]', glow: 'shadow-[0_0_12px_rgba(73,118,159,0.12)]' },
    { bg: 'bg-[#8a6216]/10', border: 'border-[#8a6216]/20', text: 'text-[#8a6216]', glow: 'shadow-[0_0_12px_rgba(138,98,22,0.12)]' },
    { bg: 'bg-primary/15', border: 'border-primary/25', text: 'text-primary', glow: 'shadow-[0_0_12px_rgba(10,65,116,0.15)]' },
];

const DAYS_CONFIG = [
    { id: 0, label: 'Seg', name: 'Segunda-feira', short: 'Segundas' },
    { id: 1, label: 'Ter', name: 'Terça-feira', short: 'Terças' },
    { id: 2, label: 'Qua', name: 'Quarta-feira', short: 'Quartas' },
    { id: 3, label: 'Qui', name: 'Quinta-feira', short: 'Quintas' },
    { id: 4, label: 'Sex', name: 'Sexta-feira', short: 'Sextas' },
    { id: 5, label: 'Sáb', name: 'Sábado', short: 'Sábados' },
    { id: 6, label: 'Dom', name: 'Domingo', short: 'Domingos' },
];

const normalizeTime = (raw: string): string => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const formatValidTime = (raw: string, fallback: string): string => {
    const clean = raw.trim();
    const match = clean.match(/^(\d{1,2}):?(\d{2})?$/);
    if (!match) return fallback;
    let h = parseInt(match[1], 10);
    let m = match[2] ? parseInt(match[2], 10) : 0;
    if (isNaN(h) || h < 0 || h > 23) h = 10;
    if (isNaN(m) || m < 0 || m > 59) m = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

interface TimeInputFieldProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
    onStep?: (deltaMins: number) => void;
}

const TimeInputField = ({ label, value, onChange, onStep }: TimeInputFieldProps) => {
    const [localVal, setLocalVal] = useState(value);

    useEffect(() => {
        setLocalVal(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = normalizeTime(e.target.value);
        setLocalVal(next);
        if (next.length === 5) {
            const formatted = formatValidTime(next, value);
            onChange(formatted);
        }
    };

    const handleBlur = () => {
        const formatted = formatValidTime(localVal, value);
        setLocalVal(formatted);
        onChange(formatted);
    };

    return (
        <div className="space-y-1">
            <label className="label font-semibold text-xs text-text-main flex items-center justify-between">
                <span className="flex items-center gap-1">
                    <Clock size={12} className="text-primary" /> {label}
                </span>
            </label>
            <div className="relative flex items-center bg-bg-card rounded-[3px] border border-border focus-within:border-primary transition-all">
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="10:00"
                    maxLength={5}
                    value={localVal}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full bg-transparent text-sm font-mono font-bold text-text-main py-2 pl-3 pr-16 focus:outline-none tracking-wider"
                />
                <div className="absolute right-1 flex items-center gap-0.5">
                    <button
                        type="button"
                        onClick={() => onStep && onStep(-15)}
                        className="px-1.5 py-1 text-[10px] font-bold text-text-muted hover:text-text-main hover:bg-[var(--wash-1)] rounded transition-colors cursor-pointer"
                        title="Diminuir 15 minutos"
                    >
                        -15m
                    </button>
                    <button
                        type="button"
                        onClick={() => onStep && onStep(15)}
                        className="px-1.5 py-1 text-[10px] font-bold text-text-muted hover:text-text-main hover:bg-[var(--wash-1)] rounded transition-colors cursor-pointer"
                        title="Aumentar 15 minutos"
                    >
                        +15m
                    </button>
                </div>
            </div>
        </div>
    );
};

const timeToMinutes = (t: string): number => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

const addMinutes = (timeStr: string, mins: number): string => {
    try {
        const parts = timeStr.split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        const total = (h * 60 + m + mins + 24 * 60) % (24 * 60);
        const newH = Math.floor(total / 60);
        const newM = total % 60;
        return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
    } catch {
        return timeStr;
    }
};

const formatScheduleFromDays = (days: number[], start: string, end: string) => {
    if (days.length === 0) return '';
    const sorted = [...days].sort((a, b) => a - b);
    const dayNames = sorted.map(d => DAYS_CONFIG.find(item => item.id === d)?.short || '');
    let daysStr = '';
    if (dayNames.length === 1) {
        daysStr = dayNames[0];
    } else if (dayNames.length === 2) {
        daysStr = `${dayNames[0]} e ${dayNames[1]}`;
    } else {
        daysStr = `${dayNames.slice(0, -1).join(', ')} e ${dayNames[dayNames.length - 1]}`;
    }
    return `${daysStr}, ${start} às ${end}`;
};

interface ScheduleConflict {
    conflictingClass: ClassModel;
    overlappingDays: string[];
    timeRange: string;
}

const parseClassSchedule = (schedule: string) => {
    let parsedStart = '10:00';
    let parsedEnd = '11:30';
    const timeMatch = (schedule || '').match(/(\d{1,2}:\d{2})\s*(?:às|as|-|to)\s*(\d{1,2}:\d{2})/i);
    if (timeMatch) {
        parsedStart = timeMatch[1].padStart(5, '0');
        parsedEnd = timeMatch[2].padStart(5, '0');
    }
    const days: number[] = [];
    DAYS_CONFIG.forEach(d => {
        const schedLower = (schedule || '').toLowerCase();
        if (schedLower.includes(d.short.toLowerCase()) || schedLower.includes(d.label.toLowerCase()) || schedLower.includes(d.name.toLowerCase())) {
            days.push(d.id);
        }
    });
    return {
        days: days.length > 0 ? days : [0, 2],
        start: parsedStart,
        end: parsedEnd,
        startM: timeToMinutes(parsedStart),
        endM: timeToMinutes(parsedEnd)
    };
};

const findScheduleConflicts = (
    currentClassId: number | null,
    targetDays: number[],
    targetStart: string,
    targetEnd: string,
    allClasses: ClassModel[]
): ScheduleConflict[] => {
    if (!targetDays || targetDays.length === 0) return [];
    const tStartM = timeToMinutes(targetStart);
    const tEndM = timeToMinutes(targetEnd);
    if (tStartM >= tEndM) return [];

    const conflicts: ScheduleConflict[] = [];

    for (const cls of allClasses) {
        if (currentClassId && cls.id === currentClassId) continue;
        const parsed = parseClassSchedule(cls.schedule || '');
        const sharedDayIds = targetDays.filter(d => parsed.days.includes(d));
        if (sharedDayIds.length === 0) continue;

        const overlapStart = Math.max(tStartM, parsed.startM);
        const overlapEnd = Math.min(tEndM, parsed.endM);

        if (overlapStart < overlapEnd) {
            const dayNames = sharedDayIds.map(d => DAYS_CONFIG.find(item => item.id === d)?.short || '').filter(Boolean);
            conflicts.push({
                conflictingClass: cls,
                overlappingDays: dayNames,
                timeRange: `${parsed.start} às ${parsed.end}`
            });
        }
    }

    return conflicts;
};

const SortableClassCard = ({ cls, index, isReorderMode, allClasses, openEditModal, openDeleteModal }: SortableClassCardProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: cls.id });

    const accent = cardAccents[index % cardAccents.length];

    const parsedThis = parseClassSchedule(cls.schedule || '');
    const cardConflicts = useMemo(() => {
        return findScheduleConflicts(cls.id, parsedThis.days, parsedThis.start, parsedThis.end, allClasses);
    }, [cls.id, cls.schedule, allClasses]);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        animationDelay: `${index * 80}ms`,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.85 : 1,
    };

    const cardContent = (
        <>
            <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-3">
                        {isReorderMode && (
                            <div
                                {...attributes}
                                {...listeners}
                                style={{ touchAction: 'none' }}
                                className="cursor-grab active:cursor-grabbing p-1 -ml-1 mt-1 text-text-muted hover:text-primary transition-colors"
                            >
                                <GripVertical size={20} />
                            </div>
                        )}
                        <div className={`p-2.5 rounded-[2px] ${accent.bg} ${accent.border} border  ${accent.glow}`}>
                            <BookOpen size={22} className={accent.text} />
                        </div>
                    </div>
                    {!isReorderMode && (
                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <button onClick={(e) => openEditModal(e, cls)} className="bg-[var(--wash-1)] p-2 rounded-[2px] hover:bg-primary/20 text-text-muted hover:text-primary transition-all duration-200 border border-border hover:border-primary/30">
                                <Pencil size={15} />
                            </button>
                            <button onClick={(e) => openDeleteModal(e, cls)} className="bg-[var(--wash-1)] p-2 rounded-[2px] hover:bg-danger/20 text-text-muted hover:text-danger transition-all duration-200 border border-border hover:border-danger/30">
                                <Trash size={15} />
                            </button>
                        </div>
                    )}
                </div>

                <h3 className="text-lg font-bold text-text-main group-hover:text-primary transition-colors duration-300 mb-1 leading-tight">
                    {cls.name}
                </h3>

                <p className="text-text-muted text-sm flex items-center gap-1.5 mb-2">
                    <Clock size={13} className="text-text-muted/60" /> {cls.schedule}
                </p>

                {cardConflicts.length > 0 && (
                    <div className="mb-3 px-2 py-1 rounded-[2px] bg-amber-500/10 border border-amber-500/25 text-amber-500 text-[11px] flex items-center gap-1.5 font-medium">
                        <AlertTriangle size={12} className="shrink-0" />
                        <span className="truncate">Choque com <strong>{cardConflicts.map(c => c.conflictingClass.name).join(', ')}</strong></span>
                    </div>
                )}

                <div className="flex items-center gap-4 pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        <Users size={13} className={accent.text} />
                        <span>{cls.student_count ?? '—'} alunos</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                        <Calendar size={13} className={accent.text} />
                        <span>{cls.session_count ?? '—'} aulas</span>
                    </div>
                </div>
            </div>
        </>
    );

    if (isReorderMode) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="sheet sheet-p group block relative overflow-hidden animate-slide-up animate-jiggle cursor-grab active:cursor-grabbing"
            >
                {cardContent}
            </div>
        );
    }

    return (
        <Link
            ref={setNodeRef}
            style={style}
            to={`/dashboard/class/${cls.id}`}
            className={`sheet sheet-p sheet-link group transition-colors duration-150 block no-underline text-inherit relative overflow-hidden animate-slide-up ${isReorderMode ? 'animate-jiggle cursor-grab active:cursor-grabbing pointer-events-none' : ''}`}
        >
            {cardContent}
        </Link>
    );
};

export const Classes = () => {
    const [classes, setClasses] = useState<ClassModel[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [newClass, setNewClass] = useState({ name: '', schedule: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [isReorderMode, setIsReorderMode] = useState(false);
    const [originalClasses, setOriginalClasses] = useState<ClassModel[]>([]);

    const [selectedDays, setSelectedDays] = useState<number[]>([0, 2]);
    const [startTime, setStartTime] = useState('10:00');
    const [endTime, setEndTime] = useState('11:30');
    const [autoScheduleCalendar, setAutoScheduleCalendar] = useState(true);
    const [scheduleWeeks, setScheduleWeeks] = useState(16);
    const [syncGoogleCalendar, setSyncGoogleCalendar] = useState(false);
    const [generateMeetLink, setGenerateMeetLink] = useState(false);
    const [isGoogleConnected, setIsGoogleConnected] = useState(false);

    const [editingClass, setEditingClass] = useState<ClassModel | null>(null);
    const [editClassName, setEditClassName] = useState('');
    const [editClassSchedule, setEditClassSchedule] = useState('');
    const [editSelectedDays, setEditSelectedDays] = useState<number[]>([0, 2]);
    const [editStartTime, setEditStartTime] = useState('10:00');
    const [editEndTime, setEditEndTime] = useState('11:30');
    const [editAddToCalendar, setEditAddToCalendar] = useState(false);
    const [editScheduleWeeks, setEditScheduleWeeks] = useState(16);
    const [editSyncGoogle, setEditSyncGoogle] = useState(false);
    const [editGenerateMeet, setEditGenerateMeet] = useState(false);

    const [deletingClass, setDeletingClass] = useState<ClassModel | null>(null);
    const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [allowCreateConflict, setAllowCreateConflict] = useState(false);
    const [allowEditConflict, setAllowEditConflict] = useState(false);

    const createConflicts = useMemo(() => {
        return findScheduleConflicts(null, selectedDays, startTime, endTime, classes);
    }, [selectedDays, startTime, endTime, classes]);

    const editConflicts = useMemo(() => {
        if (!editingClass) return [];
        return findScheduleConflicts(editingClass.id, editSelectedDays, editStartTime, editEndTime, classes);
    }, [editingClass, editSelectedDays, editStartTime, editEndTime, classes]);

    const showToast = (message: string, type: ToastType) => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const fetchClasses = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/classes/');
            const classesWithCounts = await Promise.all(
                res.data.map(async (cls: ClassModel) => {
                    try {
                        const [studentsRes, sessionsRes] = await Promise.all([
                            api.get(`/classes/${cls.id}/students`),
                            api.get(`/classes/${cls.id}/attendance`)
                        ]);
                        return {
                            ...cls,
                            student_count: studentsRes.data?.length ?? 0,
                            session_count: sessionsRes.data?.length ?? 0
                        };
                    } catch {
                        return { ...cls, student_count: 0, session_count: 0 };
                    }
                })
            );
            setClasses(classesWithCounts);
        } catch (error: unknown) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClasses();
        api.get('/calendar/status')
            .then(res => setIsGoogleConnected(Boolean(res.data?.connected)))
            .catch(() => setIsGoogleConnected(false));
    }, []);

    const toggleDay = (dayId: number, isEdit = false) => {
        if (isEdit) {
            const next = editSelectedDays.includes(dayId)
                ? editSelectedDays.filter(d => d !== dayId)
                : [...editSelectedDays, dayId];
            setEditSelectedDays(next);
            setEditClassSchedule(formatScheduleFromDays(next, editStartTime, editEndTime));
        } else {
            const next = selectedDays.includes(dayId)
                ? selectedDays.filter(d => d !== dayId)
                : [...selectedDays, dayId];
            setSelectedDays(next);
            setNewClass(prev => ({ ...prev, schedule: formatScheduleFromDays(next, startTime, endTime) }));
        }
    };

    const handleStartTimeChange = (newStart: string, isEdit = false) => {
        if (isEdit) {
            const curStartM = timeToMinutes(editStartTime);
            const curEndM = timeToMinutes(editEndTime);
            const duration = curEndM > curStartM ? (curEndM - curStartM) : 60;
            const newEnd = addMinutes(newStart, duration);
            setEditStartTime(newStart);
            setEditEndTime(newEnd);
            setEditClassSchedule(formatScheduleFromDays(editSelectedDays, newStart, newEnd));
        } else {
            const curStartM = timeToMinutes(startTime);
            const curEndM = timeToMinutes(endTime);
            const duration = curEndM > curStartM ? (curEndM - curStartM) : 60;
            const newEnd = addMinutes(newStart, duration);
            setStartTime(newStart);
            setEndTime(newEnd);
            setNewClass(prev => ({ ...prev, schedule: formatScheduleFromDays(selectedDays, newStart, newEnd) }));
        }
    };

    const handleEndTimeChange = (newEnd: string, isEdit = false) => {
        if (isEdit) {
            let finalEnd = newEnd;
            if (timeToMinutes(newEnd) <= timeToMinutes(editStartTime)) {
                finalEnd = addMinutes(editStartTime, 60);
            }
            setEditEndTime(finalEnd);
            setEditClassSchedule(formatScheduleFromDays(editSelectedDays, editStartTime, finalEnd));
        } else {
            let finalEnd = newEnd;
            if (timeToMinutes(newEnd) <= timeToMinutes(startTime)) {
                finalEnd = addMinutes(startTime, 60);
            }
            setEndTime(finalEnd);
            setNewClass(prev => ({ ...prev, schedule: formatScheduleFromDays(selectedDays, startTime, finalEnd) }));
        }
    };

    const applyQuickDuration = (minutes: number, isEdit = false) => {
        if (isEdit) {
            const newEnd = addMinutes(editStartTime, minutes);
            setEditEndTime(newEnd);
            setEditClassSchedule(formatScheduleFromDays(editSelectedDays, editStartTime, newEnd));
        } else {
            const newEnd = addMinutes(startTime, minutes);
            setEndTime(newEnd);
            setNewClass(prev => ({ ...prev, schedule: formatScheduleFromDays(selectedDays, startTime, newEnd) }));
        }
    };

    const handleStepTime = (type: 'start' | 'end', deltaMins: number, isEdit = false) => {
        if (type === 'start') {
            const cur = isEdit ? editStartTime : startTime;
            const next = addMinutes(cur, deltaMins);
            handleStartTimeChange(next, isEdit);
        } else {
            const cur = isEdit ? editEndTime : endTime;
            const next = addMinutes(cur, deltaMins);
            handleEndTimeChange(next, isEdit);
        }
    };

    const openCreateModal = () => {
        const initialDays = [0, 2];
        const initialStart = '10:00';
        const initialEnd = '11:30';
        setSelectedDays(initialDays);
        setStartTime(initialStart);
        setEndTime(initialEnd);
        setAllowCreateConflict(false);
        setNewClass({
            name: '',
            schedule: formatScheduleFromDays(initialDays, initialStart, initialEnd)
        });
        setAutoScheduleCalendar(true);
        setShowModal(true);
    };

    const handleCreateClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (createConflicts.length > 0 && !allowCreateConflict) {
            showToast('Existe um choque de horário com outra turma. Marque a confirmação para prosseguir.', 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            const safeEndTime = timeToMinutes(endTime) <= timeToMinutes(startTime)
                ? addMinutes(startTime, 60)
                : endTime;

            const scheduleText = newClass.schedule.trim() || formatScheduleFromDays(selectedDays, startTime, safeEndTime);
            const res = await api.post('/classes/', {
                name: newClass.name,
                schedule: scheduleText,
            });

            const createdClass = res.data;

            if (autoScheduleCalendar && selectedDays.length > 0) {
                try {
                    await api.post('/calendar/events/recurring', {
                        title: `Aula: ${newClass.name}`,
                        description: `Horário semanal da turma ${newClass.name}`,
                        class_id: createdClass.id,
                        days_of_week: selectedDays,
                        start_time_str: startTime,
                        end_time_str: safeEndTime,
                        weeks_count: scheduleWeeks,
                        sync_google: syncGoogleCalendar && isGoogleConnected,
                        generate_meet_link: generateMeetLink && isGoogleConnected,
                        color: '#10b981',
                    });
                    showToast(`Turma "${newClass.name}" criada e adicionada à Agenda!`, 'success');
                } catch (calErr) {
                    console.error('Erro ao agendar no calendário:', calErr);
                    showToast(`Turma "${newClass.name}" criada com sucesso!`, 'success');
                }
            } else {
                showToast(`Turma "${newClass.name}" criada com sucesso!`, 'success');
            }

            setShowModal(false);
            setNewClass({ name: '', schedule: '' });
            fetchClasses();
        } catch (error: any) {
            const errorMsg = error.response?.data?.detail || 'Erro ao criar turma';
            showToast(errorMsg, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingClass) return;
        if (editConflicts.length > 0 && !allowEditConflict) {
            showToast('Existe um choque de horário com outra turma. Marque a confirmação para prosseguir.', 'error');
            return;
        }
        try {
            const safeEndTime = timeToMinutes(editEndTime) <= timeToMinutes(editStartTime)
                ? addMinutes(editStartTime, 60)
                : editEndTime;

            await api.put(`/classes/${editingClass.id}`, { name: editClassName, schedule: editClassSchedule });

            if (editAddToCalendar && editSelectedDays.length > 0) {
                try {
                    await api.post('/calendar/events/recurring', {
                        title: `Aula: ${editClassName}`,
                        description: `Horário semanal da turma ${editClassName}`,
                        class_id: editingClass.id,
                        days_of_week: editSelectedDays,
                        start_time_str: editStartTime,
                        end_time_str: safeEndTime,
                        weeks_count: editScheduleWeeks,
                        sync_google: editSyncGoogle && isGoogleConnected,
                        generate_meet_link: editGenerateMeet && isGoogleConnected,
                        color: '#10b981',
                    });
                    showToast('Turma atualizada e novos horários adicionados à Agenda!', 'success');
                } catch (calErr) {
                    console.error('Erro ao agendar no calendário:', calErr);
                    showToast('Turma atualizada com sucesso!', 'success');
                }
            } else {
                showToast('Turma atualizada com sucesso!', 'success');
            }

            setEditingClass(null);
            fetchClasses();
        } catch (error: unknown) {
            showToast('Erro ao atualizar turma', 'error');
        }
    };

    const handleDeleteClass = async () => {
        if (!deletingClass) return;
        try {
            await api.delete(`/classes/${deletingClass.id}`);
            setDeletingClass(null);
            fetchClasses();
        } catch (error: unknown) {
            showToast('Erro ao excluir turma', 'error');
        }
    };

    const openEditModal = (e: React.MouseEvent, cls: ClassModel) => {
        e.preventDefault(); // Prevent Link navigation
        setEditingClass(cls);
        setEditClassName(cls.name);
        setEditClassSchedule(cls.schedule);
        setAllowEditConflict(false);

        // Intelligently parse schedule if available
        let parsedStart = '10:00';
        let parsedEnd = '11:30';
        const timeMatch = cls.schedule.match(/(\d{1,2}:\d{2})\s*(?:às|as|-|to)\s*(\d{1,2}:\d{2})/i);
        if (timeMatch) {
            parsedStart = timeMatch[1].padStart(5, '0');
            parsedEnd = timeMatch[2].padStart(5, '0');
            if (timeToMinutes(parsedEnd) <= timeToMinutes(parsedStart)) {
                parsedEnd = addMinutes(parsedStart, 60);
            }
        }

        const parsedDays: number[] = [];
        DAYS_CONFIG.forEach(d => {
            const schedLower = cls.schedule.toLowerCase();
            if (schedLower.includes(d.short.toLowerCase()) || schedLower.includes(d.label.toLowerCase()) || schedLower.includes(d.name.toLowerCase())) {
                parsedDays.push(d.id);
            }
        });

        setEditSelectedDays(parsedDays.length > 0 ? parsedDays : [0, 2]);
        setEditStartTime(parsedStart);
        setEditEndTime(parsedEnd);
        setEditAddToCalendar(false);
        setEditSyncGoogle(false);
        setEditGenerateMeet(false);
    };

    const openDeleteModal = (e: React.MouseEvent, cls: ClassModel) => {
        e.preventDefault(); // Prevent Link navigation
        setDeletingClass(cls);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = classes.findIndex((cls: ClassModel) => cls.id === active.id);
            const newIndex = classes.findIndex((cls: ClassModel) => cls.id === over.id);

            const newOrder = arrayMove(classes, oldIndex, newIndex);
            setClasses(newOrder);
        }
    };

    const handleSaveOrder = async () => {
        try {
            const orderData = classes.map((cls: ClassModel, index: number) => ({
                id: cls.id,
                display_order: index
            }));
            await api.put('/classes/reorder', orderData);
            setOriginalClasses(classes);
            setIsReorderMode(false);
        } catch (error: unknown) {
            console.error('Error saving order:', error);
            showToast('Erro ao salvar a nova ordem', 'error');
        }
    };

    const handleCancelReorder = () => {
        setClasses(originalClasses);
        setIsReorderMode(false);
    };

    const handleSortAlphabetically = () => {
        const sorted = [...classes].sort((a, b) => a.name.localeCompare(b.name));
        setClasses(sorted);
    };

    const startReorderMode = () => {
        setOriginalClasses([...classes]);
        setIsReorderMode(true);
    };

    return (
        <div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-text-main">
                        Minhas Turmas
                    </h2>
                    {!isLoading && classes.length > 0 && (
                        <p className="text-text-muted text-sm mt-1">
                            {classes.length} {classes.length === 1 ? 'turma cadastrada' : 'turmas cadastradas'}
                        </p>
                    )}
                </div>
                {classes.length > 1 && (
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        {!isReorderMode ? (
                            <button
                                onClick={startReorderMode}
                                className="flex items-center gap-2 px-4 py-2 rounded-[2px] font-medium transition-colors duration-150 bg-[var(--wash-1)] text-text-muted hover:bg-[var(--wash-1)] hover:text-text-main border border-border w-full sm:w-auto justify-center"
                            >
                                <ArrowUpDown size={18} />
                                Reorganizar
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleSortAlphabetically}
                                    className="flex items-center gap-2 px-4 py-2 rounded-[2px] font-medium transition-colors duration-150 bg-[var(--wash-1)] text-text-muted hover:bg-[var(--wash-1)] hover:text-text-main border border-border flex-1 sm:flex-none justify-center"
                                >
                                    <ArrowUpDown size={18} />
                                    Ordenar (A-Z)
                                </button>
                                <button
                                    onClick={handleCancelReorder}
                                    className="px-4 py-2 rounded-[2px] font-medium transition-colors duration-150 bg-[var(--wash-1)] text-text-muted hover:bg-[var(--wash-1)] hover:text-danger border border-border flex-1 sm:flex-none justify-center"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveOrder}
                                    className="px-4 py-2 rounded-[2px] font-medium transition-colors duration-150 bg-primary text-[var(--on-institution)] w-full sm:w-auto justify-center"
                                >
                                    Salvar Ordem
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="h-[50vh] flex items-center justify-center">
                    <Loading text="Carregando turmas..." />
                </div>
            ) : (
                <div className="animate-fade-in space-y-8">
                    {isReorderMode && (
                        <div className="bg-primary/10 border border-primary/30 rounded-[2px] p-4 text-center">
                            <p className="text-primary text-sm">
                                <GripVertical size={16} className="inline-block mr-2 -mt-0.5" />
                                Arraste os cards para reorganizar suas turmas
                            </p>
                        </div>
                    )}
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={classes.map(c => c.id)} strategy={rectSortingStrategy}>
                            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                {classes.map((cls, index) => (
                                    <SortableClassCard
                                        key={cls.id}
                                        cls={cls}
                                        index={index}
                                        isReorderMode={isReorderMode}
                                        allClasses={classes}
                                        openEditModal={openEditModal}
                                        openDeleteModal={openDeleteModal}
                                    />
                                ))}

                                {/* Add Class Card Button - only show when not in reorder mode */}
                                {!isReorderMode && (
                                    <button
                                        onClick={openCreateModal}
                                        className="sheet sheet-p flex flex-col items-center justify-center gap-4 group hover:bg-[var(--wash-1)] transition-colors duration-150 border-dashed border-2 border-border hover:border-primary/40 cursor-pointer min-h-[200px] animate-slide-up"
                                        style={{ animationDelay: `${classes.length * 80}ms` }}
                                    >
                                        <div className="bg-primary/10 p-4 rounded-[3px] group-hover:bg-primary/20 transition-colors duration-150 border border-primary/20">
                                            <Plus size={28} className="text-primary" />
                                        </div>
                                        <span className="font-medium text-text-muted group-hover:text-text-main transition-colors text-sm">Criar Nova Turma</span>
                                    </button>
                                )}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>
            )}

            {classes.length === 0 && !isLoading && (
                <div className="mx-auto mt-12 max-w-md text-center animate-fade-in">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[3px] border border-primary/20 bg-primary/10 text-primary">
                        <BookOpen size={30} />
                    </div>
                    <h2 className="mb-2 text-xl font-bold text-text-main">Crie sua primeira turma</h2>
                    <p className="mb-6 text-sm leading-relaxed text-text-muted">
                        A turma é o ponto de partida: é nela que você lança presenças, notas e mensalidades.
                        Configure os dias e horários para agendar tudo automaticamente no seu calendário.
                    </p>
                    <button
                        onClick={openCreateModal}
                        className="btn btn-primary inline-flex items-center gap-2 rounded-[2px] px-6 py-3 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 cursor-pointer"
                    >
                        <Plus size={18} />
                        Criar turma
                    </button>
                </div>
            )}

            {/* Create Class Modal */}
            {showModal && (
                <div className="modal-overlay animate-fade-in">
                    <div className="modal-sheet w-full max-w-lg p-6 sm:p-7 animate-slide-up relative overflow-hidden max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-4 right-4 text-text-muted hover:text-text-main p-1.5 rounded-[2px] hover:bg-[var(--wash-1)] transition-all cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                        
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2 rounded-[2px] bg-primary/15 border border-primary/20">
                                <Plus size={20} className="text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-text-main">Nova Turma</h3>
                                <p className="text-xs text-text-muted mt-0.5">Cadastre o nome e defina a programação das aulas</p>
                            </div>
                        </div>

                        <form onSubmit={handleCreateClass} className="flex flex-col gap-4">
                            {/* Nome da Turma */}
                            <div className="space-y-1">
                                <label className="label font-semibold text-xs text-text-main">Nome da Turma</label>
                                <input
                                    className="input text-sm"
                                    value={newClass.name}
                                    onChange={e => setNewClass({ ...newClass, name: e.target.value })}
                                    required
                                    placeholder="Ex: Inglês Avançado B2, Turma 3º Ano B"
                                    autoFocus
                                />
                            </div>

                            {/* Seletor de Dias da Semana */}
                            <div className="space-y-1.5">
                                <label className="label font-semibold text-xs text-text-main flex items-center justify-between">
                                    <span>Dias da Semana</span>
                                    <span className="text-[11px] font-normal text-text-muted">
                                        {selectedDays.length === 0 ? 'Nenhum dia marcado' : `${selectedDays.length} dia(s) selecionado(s)`}
                                    </span>
                                </label>
                                <div className="grid grid-cols-7 gap-1.5">
                                    {DAYS_CONFIG.map(day => {
                                        const isSelected = selectedDays.includes(day.id);
                                        return (
                                            <button
                                                key={day.id}
                                                type="button"
                                                onClick={() => toggleDay(day.id, false)}
                                                className={`py-2 text-xs font-semibold rounded-[2px] border transition-all cursor-pointer text-center ${
                                                    isSelected
                                                        ? 'bg-primary text-[var(--on-institution)] border-primary shadow-sm scale-[1.02]'
                                                        : 'bg-bg-dark text-text-muted hover:text-text-main hover:bg-[var(--wash-2)] border-border'
                                                }`}
                                                title={day.name}
                                            >
                                                {day.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Horário Início e Fim */}
                            <div className="space-y-2.5 p-3 rounded-[3px] border border-border bg-[var(--wash-1)]">
                                <div className="grid grid-cols-2 gap-3">
                                    <TimeInputField
                                        label="Horário de Início"
                                        value={startTime}
                                        onChange={val => handleStartTimeChange(val, false)}
                                        onStep={delta => handleStepTime('start', delta, false)}
                                    />
                                    <TimeInputField
                                        label="Horário de Término"
                                        value={endTime}
                                        onChange={val => handleEndTimeChange(val, false)}
                                        onStep={delta => handleStepTime('end', delta, false)}
                                    />
                                </div>

                                {/* Quick duration presets */}
                                <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                                    <span className="text-[11px] text-text-muted font-medium mr-1">Duração:</span>
                                    {[
                                        { label: '+30m', mins: 30 },
                                        { label: '+45m', mins: 45 },
                                        { label: '+50m', mins: 50 },
                                        { label: '+1h', mins: 60 },
                                        { label: '+1h30', mins: 90 },
                                        { label: '+2h', mins: 120 },
                                    ].map(preset => (
                                        <button
                                            key={preset.mins}
                                            type="button"
                                            onClick={() => applyQuickDuration(preset.mins, false)}
                                            className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] border border-border hover:border-primary/50 bg-bg-card hover:bg-primary/10 text-text-muted hover:text-primary transition-all cursor-pointer"
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>

                                {timeToMinutes(startTime) >= timeToMinutes(endTime) && (
                                    <div className="flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-[2px]">
                                        <AlertTriangle size={13} />
                                        <span>O horário de início deve ser anterior ao término.</span>
                                    </div>
                                )}
                            </div>

                            {/* Resumo Formatado do Horário */}
                            <div className="space-y-1">
                                <label className="label font-semibold text-xs text-text-muted flex items-center justify-between">
                                    <span>Resumo do Horário</span>
                                    <span className="text-[10px] text-text-muted">Editável livremente</span>
                                </label>
                                <input
                                    className="input text-xs text-text-muted bg-bg-dark"
                                    value={newClass.schedule}
                                    onChange={e => setNewClass({ ...newClass, schedule: e.target.value })}
                                    required
                                    placeholder="Ex: Segundas e Quartas, 10:00 às 11:30"
                                />
                            </div>

                            {/* Integração com Calendário / Agenda */}
                            <div className="p-3.5 rounded-[3px] border border-primary/20 bg-primary/5 space-y-3">
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoScheduleCalendar}
                                        onChange={e => setAutoScheduleCalendar(e.target.checked)}
                                        className="w-4 h-4 rounded text-primary focus:ring-primary/40 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                                        <Calendar size={14} className="text-primary" />
                                        Agendar automaticamente no Calendário / Agenda
                                    </span>
                                </label>

                                {autoScheduleCalendar && (
                                    <div className="space-y-2.5 pt-2 border-t border-primary/10 text-xs animate-fade-in">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-text-muted text-[11px]">Duração da recorrência:</span>
                                            <select
                                                value={scheduleWeeks}
                                                onChange={e => setScheduleWeeks(Number(e.target.value))}
                                                className="bg-bg-card border border-border rounded-[2px] px-2 py-1 text-xs text-text-main font-medium focus:outline-none focus:border-primary"
                                            >
                                                <option value={8}>8 semanas (~2 meses)</option>
                                                <option value={12}>12 semanas (~3 meses)</option>
                                                <option value={16}>16 semanas (Semestre Letivo)</option>
                                                <option value={24}>24 semanas (~6 meses)</option>
                                                <option value={36}>36 semanas (Ano Letivo)</option>
                                            </select>
                                        </div>

                                        {isGoogleConnected ? (
                                            <div className="space-y-1.5 pt-1">
                                                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-text-main">
                                                    <input
                                                        type="checkbox"
                                                        checked={syncGoogleCalendar}
                                                        onChange={e => setSyncGoogleCalendar(e.target.checked)}
                                                        className="w-3.5 h-3.5 rounded text-primary"
                                                    />
                                                    <span className="flex items-center gap-1">
                                                        <CheckCircle2 size={12} className="text-emerald-400" />
                                                        Sincronizar eventos com o <strong>Google Agenda</strong>
                                                    </span>
                                                </label>

                                                {syncGoogleCalendar && (
                                                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-text-main pl-5 animate-fade-in">
                                                        <input
                                                            type="checkbox"
                                                            checked={generateMeetLink}
                                                            onChange={e => setGenerateMeetLink(e.target.checked)}
                                                            className="w-3.5 h-3.5 rounded text-primary"
                                                        />
                                                        <span className="flex items-center gap-1 text-primary">
                                                            <Video size={12} />
                                                            Gerar link de videochamada no <strong>Google Meet</strong>
                                                        </span>
                                                    </label>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-text-muted flex items-center gap-1">
                                                <Sparkles size={11} className="text-primary" />
                                                Conecte sua Conta Google na tela de Agenda para sincronizar e gerar links do Meet.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Alerta de Conflito de Horário */}
                            {createConflicts.length > 0 && (
                                <div className="p-3.5 rounded-[3px] border border-amber-500/30 bg-amber-500/10 space-y-2.5 animate-fade-in">
                                    <div className="flex items-start gap-2.5 text-amber-500">
                                        <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold leading-tight">Choque de horário detectado!</p>
                                            <p className="text-[11px] text-text-muted">
                                                Esta turma coincide com horário(s) de outra(s) turma(s):
                                            </p>
                                            <ul className="space-y-1 pt-1">
                                                {createConflicts.map((c, i) => (
                                                    <li key={i} className="text-xs flex items-center gap-1.5 text-text-main font-medium">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                                        <span><strong>{c.conflictingClass.name}</strong> ({c.overlappingDays.join(', ')}, {c.timeRange})</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-amber-500/20 text-xs text-text-main font-medium">
                                        <input
                                            type="checkbox"
                                            checked={allowCreateConflict}
                                            onChange={e => setAllowCreateConflict(e.target.checked)}
                                            className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 cursor-pointer"
                                        />
                                        <span>Estou ciente e desejo cadastrar mesmo com o choque de horário</span>
                                    </label>
                                </div>
                            )}

                            <div className="flex justify-end gap-2.5 mt-2 pt-2 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 text-text-muted hover:text-text-main hover:bg-[var(--wash-1)] rounded-[2px] transition-all font-medium text-xs cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !newClass.name.trim() || (createConflicts.length > 0 && !allowCreateConflict)}
                                    className="btn btn-primary px-5 py-2 text-text-main rounded-[2px] font-semibold text-xs cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Criando Turma...' : 'Criar Turma'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Class Modal */}
            {editingClass && (
                <div className="modal-overlay animate-fade-in">
                    <div className="modal-sheet w-full max-w-lg p-6 sm:p-7 animate-slide-up relative overflow-hidden max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setEditingClass(null)}
                            className="absolute top-4 right-4 text-text-muted hover:text-text-main p-1.5 rounded-[2px] hover:bg-[var(--wash-1)] transition-all cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2 rounded-[2px] bg-primary/15 border border-primary/20">
                                <Pencil size={20} className="text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-text-main">Editar Turma</h3>
                                <p className="text-xs text-text-muted mt-0.5">Atualize os dados e a programação da turma</p>
                            </div>
                        </div>

                        <form onSubmit={handleUpdateClass} className="flex flex-col gap-4">
                            <div className="space-y-1">
                                <label className="label font-semibold text-xs text-text-main">Nome da Turma</label>
                                <input
                                    className="input text-sm"
                                    value={editClassName}
                                    onChange={e => setEditClassName(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Seletor de Dias da Semana (Edição) */}
                            <div className="space-y-1.5">
                                <label className="label font-semibold text-xs text-text-main flex items-center justify-between">
                                    <span>Dias da Semana</span>
                                    <span className="text-[11px] font-normal text-text-muted">
                                        {editSelectedDays.length === 0 ? 'Nenhum dia marcado' : `${editSelectedDays.length} dia(s) selecionado(s)`}
                                    </span>
                                </label>
                                <div className="grid grid-cols-7 gap-1.5">
                                    {DAYS_CONFIG.map(day => {
                                        const isSelected = editSelectedDays.includes(day.id);
                                        return (
                                            <button
                                                key={day.id}
                                                type="button"
                                                onClick={() => toggleDay(day.id, true)}
                                                className={`py-2 text-xs font-semibold rounded-[2px] border transition-all cursor-pointer text-center ${
                                                    isSelected
                                                        ? 'bg-primary text-[var(--on-institution)] border-primary shadow-sm scale-[1.02]'
                                                        : 'bg-bg-dark text-text-muted hover:text-text-main hover:bg-[var(--wash-2)] border-border'
                                                }`}
                                                title={day.name}
                                            >
                                                {day.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Horário Início e Fim (Edição) */}
                            <div className="space-y-2.5 p-3 rounded-[3px] border border-border bg-[var(--wash-1)]">
                                <div className="grid grid-cols-2 gap-3">
                                    <TimeInputField
                                        label="Horário de Início"
                                        value={editStartTime}
                                        onChange={val => handleStartTimeChange(val, true)}
                                        onStep={delta => handleStepTime('start', delta, true)}
                                    />
                                    <TimeInputField
                                        label="Horário de Término"
                                        value={editEndTime}
                                        onChange={val => handleEndTimeChange(val, true)}
                                        onStep={delta => handleStepTime('end', delta, true)}
                                    />
                                </div>

                                {/* Quick duration presets */}
                                <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                                    <span className="text-[11px] text-text-muted font-medium mr-1">Duração:</span>
                                    {[
                                        { label: '+30m', mins: 30 },
                                        { label: '+45m', mins: 45 },
                                        { label: '+50m', mins: 50 },
                                        { label: '+1h', mins: 60 },
                                        { label: '+1h30', mins: 90 },
                                        { label: '+2h', mins: 120 },
                                    ].map(preset => (
                                        <button
                                            key={preset.mins}
                                            type="button"
                                            onClick={() => applyQuickDuration(preset.mins, true)}
                                            className="px-2 py-0.5 text-[11px] font-semibold rounded-[2px] border border-border hover:border-primary/50 bg-bg-card hover:bg-primary/10 text-text-muted hover:text-primary transition-all cursor-pointer"
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>

                                {timeToMinutes(editStartTime) >= timeToMinutes(editEndTime) && (
                                    <div className="flex items-center gap-1.5 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-[2px]">
                                        <AlertTriangle size={13} />
                                        <span>O horário de início deve ser anterior ao término.</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="label font-semibold text-xs text-text-main">Horário / Descrição</label>
                                <input
                                    className="input text-sm"
                                    value={editClassSchedule}
                                    onChange={e => setEditClassSchedule(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Opção para adicionar/atualizar no Calendário */}
                            <div className="p-3 rounded-[3px] border border-rule-subtle bg-bg-dark space-y-2.5">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editAddToCalendar}
                                        onChange={e => setEditAddToCalendar(e.target.checked)}
                                        className="w-4 h-4 rounded text-primary"
                                    />
                                    <span className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                                        <Calendar size={13} className="text-primary" />
                                        Gerar novas aulas recorrentes no Calendário a partir de hoje
                                    </span>
                                </label>

                                {editAddToCalendar && (
                                    <div className="space-y-2 pt-2 border-t border-border text-xs animate-fade-in">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-text-muted text-[11px]">Duração:</span>
                                            <select
                                                value={editScheduleWeeks}
                                                onChange={e => setEditScheduleWeeks(Number(e.target.value))}
                                                className="bg-bg-card border border-border rounded-[2px] px-2 py-1 text-xs text-text-main font-medium focus:outline-none focus:border-primary"
                                            >
                                                <option value={8}>8 semanas (~2 meses)</option>
                                                <option value={12}>12 semanas (~3 meses)</option>
                                                <option value={16}>16 semanas (Semestre Letivo)</option>
                                                <option value={24}>24 semanas (~6 meses)</option>
                                            </select>
                                        </div>

                                        {isGoogleConnected && (
                                            <div className="space-y-1 pt-1">
                                                <label className="flex items-center gap-2 cursor-pointer text-[11px] text-text-main">
                                                    <input
                                                        type="checkbox"
                                                        checked={editSyncGoogle}
                                                        onChange={e => setEditSyncGoogle(e.target.checked)}
                                                        className="w-3.5 h-3.5 rounded text-primary"
                                                    />
                                                    <span>Sincronizar com o <strong>Google Agenda</strong></span>
                                                </label>
                                                {editSyncGoogle && (
                                                    <label className="flex items-center gap-2 cursor-pointer text-[11px] text-primary pl-5">
                                                        <input
                                                            type="checkbox"
                                                            checked={editGenerateMeet}
                                                            onChange={e => setEditGenerateMeet(e.target.checked)}
                                                            className="w-3.5 h-3.5 rounded text-primary"
                                                        />
                                                        <span>Gerar links do <strong>Google Meet</strong></span>
                                                    </label>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Alerta de Conflito de Horário na Edição */}
                            {editConflicts.length > 0 && (
                                <div className="p-3.5 rounded-[3px] border border-amber-500/30 bg-amber-500/10 space-y-2.5 animate-fade-in">
                                    <div className="flex items-start gap-2.5 text-amber-500">
                                        <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold leading-tight">Choque de horário detectado!</p>
                                            <p className="text-[11px] text-text-muted">
                                                O novo horário coincide com o de outra(s) turma(s):
                                            </p>
                                            <ul className="space-y-1 pt-1">
                                                {editConflicts.map((c, i) => (
                                                    <li key={i} className="text-xs flex items-center gap-1.5 text-text-main font-medium">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                                        <span><strong>{c.conflictingClass.name}</strong> ({c.overlappingDays.join(', ')}, {c.timeRange})</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-amber-500/20 text-xs text-text-main font-medium">
                                        <input
                                            type="checkbox"
                                            checked={allowEditConflict}
                                            onChange={e => setAllowEditConflict(e.target.checked)}
                                            className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-500 cursor-pointer"
                                        />
                                        <span>Estou ciente e desejo salvar mesmo com o choque de horário</span>
                                    </label>
                                </div>
                            )}

                            <div className="flex justify-end gap-2.5 mt-2 pt-2 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setEditingClass(null)}
                                    className="px-4 py-2 text-text-muted hover:text-text-main hover:bg-[var(--wash-1)] rounded-[2px] transition-all font-medium text-xs cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!editClassName.trim() || (editConflicts.length > 0 && !allowEditConflict)}
                                    className="btn btn-primary px-5 py-2 text-text-main rounded-[2px] font-semibold text-xs cursor-pointer disabled:opacity-50"
                                >
                                    Salvar Alterações
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Class Modal */}
            {deletingClass && (
                <div className="modal-overlay animate-fade-in">
                    <div className="modal-sheet w-full max-w-sm p-6 relative animate-slide-up overflow-hidden">
                        <div className="flex flex-col items-center text-center pt-2">
                            <div className="text-danger mb-3">
                                <AlertTriangle size={28} />
                            </div>
                            <h3 className="text-xl font-bold text-text-main mb-2">Excluir Turma?</h3>
                            <p className="text-text-muted mb-6 text-sm">
                                Tem certeza que deseja excluir <strong className="text-text-main">{deletingClass.name}</strong>? Esta ação removerá todos os alunos e chamadas associados.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button onClick={() => setDeletingClass(null)} className="flex-1 py-2 text-text-muted hover:bg-[var(--wash-1)] hover:text-text-main transition-all rounded-[2px] font-medium border border-transparent hover:border-border text-xs cursor-pointer">Cancelar</button>
                                <button onClick={handleDeleteClass} className="flex-1 py-2 bg-danger/90 hover:bg-danger text-[#fff] rounded-[2px] transition-all font-medium text-xs cursor-pointer">Excluir</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
