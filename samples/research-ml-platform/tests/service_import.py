"""
All three FastAPI services use the package name `app` internally (that's
fine in Docker, where each container only ever has one `app/` on its path).
For pytest running against the monorepo, we have to make sure only one
service's `app` package is ever cached in sys.modules at a time -- this
helper purges any previously-imported `app*` modules and the other
services' paths before importing the requested service fresh.
"""
import sys
import os

_SERVICES_ROOT = os.path.join(os.path.dirname(__file__), "..", "services")


def import_service_app(service: str):
    """Return the freshly-imported `app` package for the given service
    ('registry', 'inference', or 'research'), with any other service's
    `app` package purged from sys.modules first.
    """
    service_path = os.path.abspath(os.path.join(_SERVICES_ROOT, service))

    # Drop any previously imported `app` package/submodules so we don't
    # silently reuse a different service's cached module.
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]

    # Keep sys.path clean: remove any other service dirs we may have added
    # in a previous test, then put this one at the front.
    sys.path = [p for p in sys.path if not p.startswith(os.path.abspath(_SERVICES_ROOT))]
    sys.path.insert(0, service_path)

    import app  # noqa: F401 -- imported for the side effect of populating sys.modules
    return app
