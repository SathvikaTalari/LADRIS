"""LADRIS ML package with a lightweight, embeddable import surface.

Database and training modules are deliberately not imported at package import
time.  This lets ``ml.inference`` run inside the main FastAPI application
without coupling it to the standalone module's separate SQLAlchemy schema.
"""


def get_latest_evaluation(*args, **kwargs):
    from .continuous_learning import get_latest_evaluation as implementation
    return implementation(*args, **kwargs)
