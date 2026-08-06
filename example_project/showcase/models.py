from django.db import models
from django.utils.text import slugify


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Category(TimeStampedModel):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True, blank=True)
    is_featured = models.BooleanField(default=False)

    class Meta:
        ordering = ("name",)
        verbose_name_plural = "categories"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class Article(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        REVIEW = "review", "In review"
        PUBLISHED = "published", "Published"

    title = models.CharField(max_length=180)
    slug = models.SlugField(max_length=200, unique=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="articles",
    )
    featured = models.BooleanField(default=False)
    excerpt = models.TextField(blank=True)
    body = models.TextField(blank=True)
    published_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ("-updated_at",)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.title


class Inquiry(TimeStampedModel):
    class Status(models.TextChoices):
        NEW = "new", "New"
        QUALIFIED = "qualified", "Qualified"
        CLOSED = "closed", "Closed"

    class Source(models.TextChoices):
        WEBSITE = "website", "Website"
        REFERRAL = "referral", "Referral"
        EMAIL = "email", "Email"

    name = models.CharField(max_length=120)
    email = models.EmailField()
    company = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.WEBSITE)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.name} ({self.email})"
