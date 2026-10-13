import logging
import sys
from .config import LOG_LEVEL, SERVICE_NAME


def configure_logging() -> logging.Logger:
    logger = logging.getLogger(SERVICE_NAME)
    if logger.handlers:
        return logger

    handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        fmt='{"ts":"%(asctime)s","level":"%(levelname)s","service":"' + SERVICE_NAME
        + '","logger":"%(name)s","msg":"%(message)s"}'
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))
    logger.propagate = False
    return logger


logger = configure_logging()
