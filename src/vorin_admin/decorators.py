from __future__ import annotations

from collections.abc import Callable

from django.contrib.admin import action as django_action


def action(*, permissions=None, description=None, **metadata):
    def decorator(func: Callable):
        wrapped = django_action(permissions=permissions, description=description)(func)

        for key, value in metadata.items():
            setattr(wrapped, key, value)

        return wrapped

    return decorator

__all__ = ["action"]
