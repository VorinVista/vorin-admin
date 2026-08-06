from django.http import HttpRequest


def staff_only(request: HttpRequest) -> bool:
    return bool(request.user.is_authenticated and request.user.is_staff)


def superusers_only(request: HttpRequest) -> bool:
    return bool(request.user.is_authenticated and request.user.is_superuser)
