"""Cadastro público: invariantes de segurança que não podem regredir."""
import sys, os
sys.path.append(os.getcwd())

import pytest
from pydantic import ValidationError
from backend.schemas.users import UserRegister


def test_senha_curta_recusada():
    with pytest.raises(ValidationError):
        UserRegister(first_name="Ana", last_name="Souza", email="ana@x.com", password="1234")


def test_email_invalido_recusado():
    with pytest.raises(ValidationError):
        UserRegister(first_name="Ana", last_name="Souza", email="nao-e-email", password="senha12345")


def test_normaliza_email_e_nome():
    user = UserRegister(
        first_name="  Maria  ",
        last_name="  Silva ",
        email="Maria@Escola.com.BR",
        password="senha12345",
    )
    assert user.email == "maria@escola.com.br"  # senão o duplicado passa variando maiúscula
    assert user.first_name == "Maria"
    assert user.last_name == "Silva"


def test_payload_nao_carrega_privilegio():
    """is_admin/is_trial não existem no schema público: mesmo que o cliente mande,
    pydantic descarta e o router força is_trial=True."""
    user = UserRegister(
        first_name="Hacker",
        last_name="Silva",
        email="h@x.com",
        password="senha12345",
        is_admin=True,
    )
    assert not hasattr(user, "is_admin")


if __name__ == "__main__":
    test_normaliza_email_e_nome()
    test_payload_nao_carrega_privilegio()
    print("ok")
