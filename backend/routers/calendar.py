from datetime import datetime, date, timedelta, timezone
from typing import List, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.core import database, security
from backend.core.config import settings
from backend.core.logger import logger
from backend.models.users import User
from backend.models.calendar import CalendarEvent
from backend.models.classes import Class
from backend.models.attendance import AttendanceSession
from backend.schemas.calendar import (
    CalendarEventCreate,
    CalendarEventUpdate,
    CalendarEventResponse,
    HolidayItem,
)

router = APIRouter()


def get_easter_date(year: int) -> date:
    """Calcula a data do Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def get_brazilian_holidays(year: int) -> List[HolidayItem]:
    """Retorna a lista de feriados nacionais e pontos facultativos brasileiros para o ano especificado."""
    easter = get_easter_date(year)

    # Feriados móveis calculados a partir da Páscoa
    carnaval_seg = easter - timedelta(days=48)
    carnaval_ter = easter - timedelta(days=47)
    quarta_cinzas = easter - timedelta(days=46)
    sexta_santa = easter - timedelta(days=2)
    corpus_christi = easter + timedelta(days=60)

    holidays = [
        # Feriados Nacionais Fixos
        HolidayItem(date=f"{year}-01-01", name="Confraternização Universal (Ano Novo)", type="national_holiday"),
        HolidayItem(date=f"{year}-04-21", name="Tiradentes", type="national_holiday"),
        HolidayItem(date=f"{year}-05-01", name="Dia do Trabalhador", type="national_holiday"),
        HolidayItem(date=f"{year}-09-07", name="Independência do Brasil", type="national_holiday"),
        HolidayItem(date=f"{year}-10-12", name="Nossa Senhora Aparecida", type="national_holiday"),
        HolidayItem(date=f"{year}-11-02", name="Finados", type="national_holiday"),
        HolidayItem(date=f"{year}-11-15", name="Proclamação da República", type="national_holiday"),
        HolidayItem(date=f"{year}-11-20", name="Dia Nacional de Zumbi e da Consciência Negra", type="national_holiday"),
        HolidayItem(date=f"{year}-12-25", name="Natal", type="national_holiday"),

        # Feriados Móveis
        HolidayItem(date=sexta_santa.isoformat(), name="Sexta-feira Santa (Paixão de Cristo)", type="national_holiday"),
        HolidayItem(date=easter.isoformat(), name="Páscoa", type="national_holiday"),

        # Pontos Facultativos e Datas Relevantes
        HolidayItem(date=carnaval_seg.isoformat(), name="Carnaval (Segunda-feira)", type="optional_holiday"),
        HolidayItem(date=carnaval_ter.isoformat(), name="Carnaval (Terça-feira)", type="optional_holiday"),
        HolidayItem(date=quarta_cinzas.isoformat(), name="Quarta-feira de Cinzas", type="optional_holiday", description="Ponto facultativo até 14h"),
        HolidayItem(date=corpus_christi.isoformat(), name="Corpus Christi", type="optional_holiday"),
        HolidayItem(date=f"{year}-10-15", name="Dia do Professor", type="educational", description="Data comemorativa escolar"),
        HolidayItem(date=f"{year}-10-28", name="Dia do Servidor Público", type="optional_holiday"),
        HolidayItem(date=f"{year}-12-24", name="Véspera de Natal", type="optional_holiday", description="Ponto facultativo após 14h"),
        HolidayItem(date=f"{year}-12-31", name="Véspera de Ano Novo", type="optional_holiday", description="Ponto facultativo após 14h"),
    ]

    holidays.sort(key=lambda h: h.date)
    return holidays


async def _refresh_google_token_if_needed(user: User, db: Session) -> Optional[str]:
    """Valida o token do Google e faz refresh se necessário."""
    if not user.google_refresh_token or not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        return user.google_access_token

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(
                settings.GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "refresh_token": user.google_refresh_token,
                    "grant_type": "refresh_token",
                },
            )
            if res.status_code == 200:
                data = res.json()
                new_token = data.get("access_token")
                if new_token:
                    user.google_access_token = new_token
                    db.commit()
                    db.refresh(user)
                    return new_token
    except Exception as e:
        logger.error(f"Error refreshing Google token: {e}")

    return user.google_access_token


@router.get("/calendar/status")
async def get_calendar_status(
    current_user: User = Depends(security.get_current_user),
):
    """Verifica se o usuário atual possui conta Google com acesso ao Google Calendar."""
    is_connected = bool(current_user.google_access_token or current_user.google_refresh_token)
    return {
        "connected": is_connected,
        "email": current_user.email if is_connected else None,
        "has_refresh_token": bool(current_user.google_refresh_token),
    }


@router.get("/calendar/holidays", response_model=List[HolidayItem])
async def list_holidays(
    year: Optional[int] = Query(None, description="Ano para listar os feriados (padrão: ano atual)"),
    current_user: User = Depends(security.get_current_user),
):
    """Lista todos os feriados nacionais e pontos facultativos brasileiros para o ano informado."""
    target_year = year or datetime.now().year
    return get_brazilian_holidays(target_year)


@router.get("/calendar/events", response_model=List[CalendarEventResponse])
async def list_calendar_events(
    start_date: Optional[str] = Query(None, description="ISO format start date"),
    end_date: Optional[str] = Query(None, description="ISO format end date"),
    include_google: bool = Query(True, description="Incluir eventos da conta Google vinculada caso disponível"),
    db: Session = Depends(database.get_db),
    current_user: User = Depends(security.get_current_user),
):
    """
    Retorna todos os eventos da agenda do professor:
    1. Eventos locais salvos no sistema
    2. Sessões/aulas de turmas cadastradas
    3. Eventos do Google Agenda (se vinculado e solicitado)
    """
    results: List[CalendarEventResponse] = []

    # 1. Buscar eventos locais
    query = db.query(CalendarEvent).filter(CalendarEvent.user_id == current_user.id)
    if start_date:
        try:
            st = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            query = query.filter(CalendarEvent.end_time >= st)
        except Exception:
            pass
    if end_date:
        try:
            et = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            query = query.filter(CalendarEvent.start_time <= et)
        except Exception:
            pass

    local_events = query.all()
    for ev in local_events:
        class_name = ev.course_class.name if ev.course_class else None
        results.append(
            CalendarEventResponse(
                id=f"local_{ev.id}",
                user_id=ev.user_id,
                title=ev.title,
                description=ev.description,
                start_time=ev.start_time,
                end_time=ev.end_time,
                all_day=ev.all_day,
                category=ev.category or "lesson",
                color=ev.color or "#6366f1",
                location_or_link=ev.location_or_link,
                class_id=ev.class_id,
                class_name=class_name,
                google_event_id=ev.google_event_id,
                source="local",
            )
        )

    # 2. Buscar sessões de turmas do professor (AttendanceSession)
    try:
        classes_owned = db.query(Class).filter(Class.owner_id == current_user.id).all()
        class_map = {c.id: c.name for c in classes_owned}
        class_ids = list(class_map.keys())

        if class_ids:
            session_query = db.query(AttendanceSession).filter(AttendanceSession.class_id.in_(class_ids))
            sessions = session_query.all()
            for s in sessions:
                if not s.date:
                    continue
                c_name = class_map.get(s.class_id, "Turma")
                # Converter date para datetime
                start_dt = datetime.combine(s.date, datetime.min.time().replace(hour=8, minute=0))
                end_dt = datetime.combine(s.date, datetime.min.time().replace(hour=9, minute=0))
                
                results.append(
                    CalendarEventResponse(
                        id=f"session_{s.id}",
                        user_id=current_user.id,
                        title=f"{c_name} - {s.description or f'Aula {s.lesson_number}'}",
                        description=f"Registro de aula para a turma {c_name}",
                        start_time=start_dt,
                        end_time=end_dt,
                        all_day=False,
                        category="lesson",
                        color="#10b981",  # Verde esmeralda para aulas de turma
                        class_id=s.class_id,
                        class_name=c_name,
                        source="class_session",
                    )
                )
    except Exception as e:
        logger.error(f"Error loading class sessions into calendar: {e}")

    # 3. Buscar eventos do Google Calendar se conectado e autorizado
    if include_google and (current_user.google_access_token or current_user.google_refresh_token):
        try:
            token = await _refresh_google_token_if_needed(current_user, db)
            if token:
                params = {
                    "calendarId": "primary",
                    "singleEvents": "true",
                    "orderBy": "startTime",
                    "maxResults": 100,
                }
                if start_date:
                    params["timeMin"] = start_date
                if end_date:
                    params["timeMax"] = end_date

                async with httpx.AsyncClient(timeout=6.0) as client:
                    res = await client.get(
                        settings.GOOGLE_CALENDAR_API_URL,
                        headers={"Authorization": f"Bearer {token}"},
                        params=params,
                    )
                    if res.status_code == 200:
                        google_items = res.json().get("items", [])
                        for g_ev in google_items:
                            # Ignorar eventos que já foram salvos localmente
                            g_id = g_ev.get("id")
                            if any(e.google_event_id == g_id for e in local_events):
                                continue

                            start_info = g_ev.get("start", {})
                            end_info = g_ev.get("end", {})
                            all_day = "date" in start_info
                            
                            start_str = start_info.get("dateTime") or start_info.get("date")
                            end_str = end_info.get("dateTime") or end_info.get("date")
                            if not start_str:
                                continue

                            try:
                                if all_day:
                                    st_date = date.fromisoformat(start_str)
                                    st_dt = datetime.combine(st_date, datetime.min.time())
                                    et_date = date.fromisoformat(end_str) if end_str else st_date
                                    et_dt = datetime.combine(et_date, datetime.max.time())
                                else:
                                    st_dt = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                                    et_dt = datetime.fromisoformat(end_str.replace("Z", "+00:00")) if end_str else st_dt + timedelta(hours=1)
                            except Exception:
                                continue

                            meet_link = g_ev.get("hangoutLink") or g_ev.get("location")
                            results.append(
                                CalendarEventResponse(
                                    id=f"google_{g_id}",
                                    user_id=current_user.id,
                                    title=g_ev.get("summary") or "Evento Google",
                                    description=g_ev.get("description"),
                                    start_time=st_dt,
                                    end_time=et_dt,
                                    all_day=all_day,
                                    category="google",
                                    color="#3b82f6",  # Azul Google
                                    location_or_link=meet_link,
                                    google_event_id=g_id,
                                    source="google",
                                )
                            )
        except Exception as e:
            logger.warning(f"Failed to fetch Google Calendar events: {e}")

    # Ordenar por data de início
    results.sort(key=lambda x: x.start_time)
    return results


@router.post("/calendar/events", response_model=CalendarEventResponse, status_code=status.HTTP_201_CREATED)
async def create_calendar_event(
    payload: CalendarEventCreate,
    db: Session = Depends(database.get_db),
    current_user: User = Depends(security.get_current_user),
):
    """Cria um novo evento na agenda local e opcionalmente sincroniza com o Google Calendar."""
    google_event_id = None
    location_or_link = payload.location_or_link

    # Sincronização com Google Calendar se requisitado
    if payload.sync_google and (current_user.google_access_token or current_user.google_refresh_token):
        token = await _refresh_google_token_if_needed(current_user, db)
        if token:
            try:
                time_zone = settings.GOOGLE_CALENDAR_TIMEZONE or "America/Sao_Paulo"
                if payload.all_day:
                    event_body = {
                        "summary": payload.title,
                        "description": payload.description or "",
                        "start": {"date": payload.start_time.strftime("%Y-%m-%d")},
                        "end": {"date": payload.end_time.strftime("%Y-%m-%d")},
                    }
                else:
                    event_body = {
                        "summary": payload.title,
                        "description": payload.description or "",
                        "start": {"dateTime": payload.start_time.isoformat(), "timeZone": time_zone},
                        "end": {"dateTime": payload.end_time.isoformat(), "timeZone": time_zone},
                    }

                query_params = {}
                if payload.generate_meet_link:
                    event_body["conferenceData"] = {
                        "createRequest": {
                            "requestId": f"meet_{int(datetime.now(timezone.utc).timestamp())}",
                            "conferenceSolutionKey": {"type": "hangoutsMeet"},
                        }
                    }
                    query_params["conferenceDataVersion"] = "1"

                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.post(
                        settings.GOOGLE_CALENDAR_API_URL,
                        headers={"Authorization": f"Bearer {token}"},
                        json=event_body,
                        params=query_params,
                    )
                    if res.status_code in (200, 201):
                        g_data = res.json()
                        google_event_id = g_data.get("id")
                        meet_url = g_data.get("hangoutLink")
                        if meet_url and not location_or_link:
                            location_or_link = meet_url
            except Exception as e:
                logger.error(f"Error creating Google Calendar event: {e}")

    # Salvar evento local no banco de dados
    new_event = CalendarEvent(
        user_id=current_user.id,
        title=payload.title,
        description=payload.description,
        start_time=payload.start_time,
        end_time=payload.end_time,
        all_day=payload.all_day or False,
        category=payload.category or "lesson",
        color=payload.color or "#6366f1",
        location_or_link=location_or_link,
        class_id=payload.class_id,
        google_event_id=google_event_id,
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)

    class_name = None
    if new_event.class_id:
        c = db.query(Class).filter(Class.id == new_event.class_id).first()
        if c:
            class_name = c.name

    return CalendarEventResponse(
        id=f"local_{new_event.id}",
        user_id=new_event.user_id,
        title=new_event.title,
        description=new_event.description,
        start_time=new_event.start_time,
        end_time=new_event.end_time,
        all_day=new_event.all_day,
        category=new_event.category,
        color=new_event.color,
        location_or_link=new_event.location_or_link,
        class_id=new_event.class_id,
        class_name=class_name,
        google_event_id=new_event.google_event_id,
        source="local",
    )


@router.put("/calendar/events/{event_id}", response_model=CalendarEventResponse)
async def update_calendar_event(
    event_id: str,
    payload: CalendarEventUpdate,
    db: Session = Depends(database.get_db),
    current_user: User = Depends(security.get_current_user),
):
    """Atualiza um evento da agenda."""
    # Extrair ID numérico se vier formatado como local_X
    clean_id = event_id.replace("local_", "")
    if not clean_id.isdigit():
        raise HTTPException(status_code=400, detail="Identificador de evento inválido para edição local.")

    event = db.query(CalendarEvent).filter(
        CalendarEvent.id == int(clean_id),
        CalendarEvent.user_id == current_user.id,
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")

    if payload.title is not None:
        event.title = payload.title
    if payload.description is not None:
        event.description = payload.description
    if payload.start_time is not None:
        event.start_time = payload.start_time
    if payload.end_time is not None:
        event.end_time = payload.end_time
    if payload.all_day is not None:
        event.all_day = payload.all_day
    if payload.category is not None:
        event.category = payload.category
    if payload.color is not None:
        event.color = payload.color
    if payload.location_or_link is not None:
        event.location_or_link = payload.location_or_link
    if payload.class_id is not None:
        event.class_id = payload.class_id

    # Se estiver sincronizado com o Google, atualizar lá também
    if event.google_event_id and (current_user.google_access_token or current_user.google_refresh_token):
        token = await _refresh_google_token_if_needed(current_user, db)
        if token:
            try:
                time_zone = settings.GOOGLE_CALENDAR_TIMEZONE or "America/Sao_Paulo"
                g_body = {
                    "summary": event.title,
                    "description": event.description or "",
                    "start": {"dateTime": event.start_time.isoformat(), "timeZone": time_zone},
                    "end": {"dateTime": event.end_time.isoformat(), "timeZone": time_zone},
                }
                async with httpx.AsyncClient(timeout=8.0) as client:
                    await client.patch(
                        f"{settings.GOOGLE_CALENDAR_API_URL}/{event.google_event_id}",
                        headers={"Authorization": f"Bearer {token}"},
                        json=g_body,
                    )
            except Exception as e:
                logger.error(f"Error updating Google Calendar event: {e}")

    db.commit()
    db.refresh(event)

    class_name = event.course_class.name if event.course_class else None
    return CalendarEventResponse(
        id=f"local_{event.id}",
        user_id=event.user_id,
        title=event.title,
        description=event.description,
        start_time=event.start_time,
        end_time=event.end_time,
        all_day=event.all_day,
        category=event.category,
        color=event.color,
        location_or_link=event.location_or_link,
        class_id=event.class_id,
        class_name=class_name,
        google_event_id=event.google_event_id,
        source="local",
    )


@router.delete("/calendar/events/{event_id}")
async def delete_calendar_event(
    event_id: str,
    db: Session = Depends(database.get_db),
    current_user: User = Depends(security.get_current_user),
):
    """Remove um evento da agenda local ou do Google Calendar."""
    # Caso 1: Evento do Google direto
    if event_id.startswith("google_"):
        g_id = event_id.replace("google_", "")
        token = await _refresh_google_token_if_needed(current_user, db)
        if not token:
            raise HTTPException(status_code=400, detail="Conta do Google não conectada.")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.delete(
                    f"{settings.GOOGLE_CALENDAR_API_URL}/{g_id}",
                    headers={"Authorization": f"Bearer {token}"},
                )
                if res.status_code not in (200, 204, 404, 410):
                    raise HTTPException(status_code=res.status_code, detail="Falha ao excluir no Google Calendar.")
            return {"detail": "Evento excluído do Google Calendar com sucesso"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error deleting google event: {e}")
            raise HTTPException(status_code=500, detail="Erro ao se comunicar com o Google Calendar.")

    # Caso 2: Evento local
    clean_id = event_id.replace("local_", "")
    if not clean_id.isdigit():
        raise HTTPException(status_code=400, detail="Identificador de evento inválido.")

    event = db.query(CalendarEvent).filter(
        CalendarEvent.id == int(clean_id),
        CalendarEvent.user_id == current_user.id,
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")

    # Se tinha espelho no Google, deletar lá também
    if event.google_event_id and (current_user.google_access_token or current_user.google_refresh_token):
        token = await _refresh_google_token_if_needed(current_user, db)
        if token:
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    await client.delete(
                        f"{settings.GOOGLE_CALENDAR_API_URL}/{event.google_event_id}",
                        headers={"Authorization": f"Bearer {token}"},
                    )
            except Exception as e:
                logger.warning(f"Could not delete mirror event in Google Calendar: {e}")

    db.delete(event)
    db.commit()
    return {"detail": "Evento excluído com sucesso."}
