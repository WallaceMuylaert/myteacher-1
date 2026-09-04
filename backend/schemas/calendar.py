from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CalendarEventBase(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    all_day: Optional[bool] = False
    category: Optional[str] = "lesson"  # lesson, private, meeting, exam, reminder, other
    color: Optional[str] = "#6366f1"
    location_or_link: Optional[str] = None
    class_id: Optional[int] = None
    sync_google: Optional[bool] = False
    generate_meet_link: Optional[bool] = False


class CalendarEventCreate(CalendarEventBase):
    pass


class RecurringCalendarEventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    class_id: Optional[int] = None
    category: Optional[str] = "lesson"
    color: Optional[str] = "#10b981"
    days_of_week: List[int]  # 0=Segunda, 1=Terça, ..., 6=Domingo (Python weekday)
    start_time_str: str  # "10:00"
    end_time_str: str  # "11:30"
    start_date: Optional[str] = None  # YYYY-MM-DD (defaults to today)
    weeks_count: Optional[int] = 12
    sync_google: Optional[bool] = False
    generate_meet_link: Optional[bool] = False
    location_or_link: Optional[str] = None


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    all_day: Optional[bool] = None
    category: Optional[str] = None
    color: Optional[str] = None
    location_or_link: Optional[str] = None
    class_id: Optional[int] = None
    sync_google: Optional[bool] = False
    generate_meet_link: Optional[bool] = False


class CalendarEventResponse(BaseModel):
    id: str
    user_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    all_day: bool = False
    category: str = "lesson"
    color: str = "#6366f1"
    location_or_link: Optional[str] = None
    class_id: Optional[int] = None
    class_name: Optional[str] = None
    google_event_id: Optional[str] = None
    source: str = "local"  # "local", "google", "class_session", "holiday"

    class Config:
        from_attributes = True


class HolidayItem(BaseModel):
    date: str  # YYYY-MM-DD
    name: str
    type: str  # "national_holiday", "optional_holiday", "educational"
    description: Optional[str] = None
