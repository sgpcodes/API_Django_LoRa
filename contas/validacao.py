"""
RN: o CPF informado no cadastro público precisa ser um CPF real (dígito
verificador conferido pelo algoritmo oficial), não só uma sequência de 11
números quaisquer.
"""

import re


def limpar_cpf(cpf):
    """Remove tudo que não é dígito (pontos, traço, espaços)."""
    return re.sub(r'\D', '', cpf or '')


def validar_cpf(cpf):
    """Confere os dois dígitos verificadores do CPF pelo algoritmo oficial
    (módulo 11). Também rejeita sequências com todos os dígitos iguais
    (ex.: 111.111.111-11) — essas passam matematicamente no cálculo do
    dígito verificador, mas nunca são CPFs reais emitidos."""
    numeros = limpar_cpf(cpf)

    if len(numeros) != 11:
        return False
    if numeros == numeros[0] * 11:
        return False

    def digito_verificador(parcial):
        pesos = range(len(parcial) + 1, 1, -1)
        soma = sum(int(digito) * peso for digito, peso in zip(parcial, pesos))
        resto = soma % 11
        return '0' if resto < 2 else str(11 - resto)

    primeiro_digito = digito_verificador(numeros[:9])
    segundo_digito = digito_verificador(numeros[:9] + primeiro_digito)

    return numeros[-2:] == primeiro_digito + segundo_digito
