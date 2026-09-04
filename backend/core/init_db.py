from sqlalchemy.orm import Session
from backend.models.users import User
from backend.core import database
from passlib.context import CryptContext
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def init_db(db: Session):
    admin_email = os.getenv("PGADMIN_DEFAULT_EMAIL") or os.getenv("PGADMIN_EMAIL")
    admin_password = os.getenv("PGADMIN_DEFAULT_PASSWORD") or os.getenv("PGADMIN_PASSWORD")

    if not admin_email or not admin_password:
        print("PGADMIN_DEFAULT_EMAIL or PGADMIN_DEFAULT_PASSWORD not set in .env")
        return

    user = db.query(User).filter(User.email == admin_email).first()
    if not user:
        print(f"Creating admin user: {admin_email}")
        hashed_password = pwd_context.hash(admin_password)
        db_user = User(
            email=admin_email,
            hashed_password=hashed_password,
            is_admin=True,
            is_active=True,
            full_name="Administrator",
            nickname="Admin"
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        print("Admin user created successfully")
    else:
        print("Admin user already exists")

    # Seed plans
    from backend.models.plans import Plan as PlanModel

    # Planos de assinatura ligados ao Stripe. Upsert por nome: roda sempre, para
    # que bancos já populados também recebam os preços novos.
    for plan_dict in [
        {
            "name": "Essencial",
            "description": "Para quem está começando e gerencia poucas turmas.",
            "price": "R$ 47,90",
            "period": "/mês",
            # Em produção defina STRIPE_PRICE_* no .env com os prices do modo live;
            # este upsert roda a cada boot e sobrescreveria valores editados no admin.
            "stripe_price_id": os.getenv("STRIPE_PRICE_ESSENCIAL") or "price_1U18QjJtQF0i2t0DQ2RBNFHZ",
            "role": "autonomous_teacher",
            "max_classes": 5,
            "max_teachers": 1,
            "popular": False,
            "button_text": "Começar 14 dias grátis",
            "features": [
                {"text": "Até 5 turmas", "included": True},
                {"text": "Alunos ilimitados", "included": True},
                {"text": "Gestão financeira completa", "included": True},
                {"text": "Controle de presenças e notas", "included": True},
                {"text": "Dashboard do aluno", "included": True},
                {"text": "Turmas ilimitadas", "included": False},
            ],
        },
        {
            "name": "Profissional",
            "description": "Para professores com agenda cheia, sem limite de turmas.",
            "price": "R$ 97,90",
            "period": "/mês",
            "stripe_price_id": os.getenv("STRIPE_PRICE_PROFISSIONAL") or "price_1U18BBJtQF0i2t0DhY0GBiLT",
            "role": "autonomous_teacher",
            "max_classes": 9999,
            "max_teachers": 1,
            "popular": True,
            "button_text": "Começar 14 dias grátis",
            "features": [
                {"text": "Turmas ilimitadas", "included": True},
                {"text": "Alunos ilimitados", "included": True},
                {"text": "Gestão financeira completa", "included": True},
                {"text": "Controle de presenças e notas", "included": True},
                {"text": "Dashboard do aluno", "included": True},
                {"text": "Suporte prioritário", "included": True},
            ],
        },
    ]:
        db_plan = db.query(PlanModel).filter(PlanModel.name == plan_dict["name"]).first() or PlanModel()
        for key, value in plan_dict.items():
            setattr(db_plan, key, value)
        db.add(db_plan)
    db.commit()
    print("Stripe plans (Essencial/Profissional) synced")

    # Seed config
    from backend.models.config import AppConfig as AppConfigModel
    
    if db.query(AppConfigModel).count() == 0:
        print("Seeding initial configs...")
        configs_data = [
            {"key": "stripe_public_key", "value": ""},
            {"key": "stripe_secret_key", "value": ""},
            {"key": "stripe_webhook_secret", "value": ""},
            # Fallback quando o checkout vem sem plano; env vence (ver _cfg em routers/billing.py)
            {"key": "stripe_price_id", "value": os.getenv("STRIPE_PRICE_ID") or "price_1U18BBJtQF0i2t0DhY0GBiLT"},
        ]
        for cfg in configs_data:
            db.add(AppConfigModel(**cfg))
        db.commit()
        print("Initial configs seeded successfully")
