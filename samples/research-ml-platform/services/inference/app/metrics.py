"""
Prometheus metrics. `model_version` and `traffic_group` labels are what let
the rollback worker (and the dashboard) actually compare stable vs canary --
without them the two are indistinguishable in Prometheus, per the blueprint's
"Important inference metrics" section.
"""
from prometheus_client import Counter, Histogram

translation_requests_total = Counter(
    "translation_requests_total",
    "Total translation requests",
    ["model_version", "traffic_group", "language_pair", "status"],
)

translation_errors_total = Counter(
    "translation_errors_total",
    "Total translation errors",
    ["model_version", "traffic_group", "language_pair"],
)

translation_latency_seconds = Histogram(
    "translation_latency_seconds",
    "Translation request latency in seconds",
    ["model_version", "traffic_group", "language_pair"],
    buckets=(0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 30, 60),
)
