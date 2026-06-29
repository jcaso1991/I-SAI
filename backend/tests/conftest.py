import asyncio

import pytest


@pytest.fixture(scope="session", autouse=True)
def _patch_motor_event_loop():
    """Parchea Motor para que siempre use el event loop en ejecucion.

    TestClient (starlette) crea y CIERRA un event loop nuevo por cada
    peticion HTTP.  Motor cachea el primer loop que ve en `_io_loop` y lo
    reutiliza, lo que provoca "Event loop is closed".

    Este parche:
    1. Fuerza `get_io_loop` de AgnosticClient a devolver el loop actual.
    2. Sobreescribe `run_on_executor` para usar `get_running_loop()`.
    """
    import motor.frameworks.asyncio as mfa
    from motor.core import AgnosticClient

    _original_run = mfa.run_on_executor
    _original_get_io_loop = AgnosticClient.get_io_loop

    def _run_on_executor_current_loop(loop, fn, *args, **kwargs):
        del loop
        return _original_run(asyncio.get_running_loop(), fn, *args, **kwargs)

    def _get_io_loop_current(self):
        return asyncio.get_running_loop()

    mfa.run_on_executor = _run_on_executor_current_loop
    AgnosticClient.get_io_loop = _get_io_loop_current

    yield

    mfa.run_on_executor = _original_run
    AgnosticClient.get_io_loop = _original_get_io_loop


@pytest.fixture(scope="function", autouse=True)
def _reset_motor_io_loop():
    """Limpia el cache `_io_loop` del cliente Motor antes de cada test."""
    import server

    server.client._io_loop = None
