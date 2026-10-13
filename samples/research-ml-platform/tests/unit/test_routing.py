"""
Unit tests for the canary routing decision logic. We monkeypatch
`get_routing_state` so this doesn't require a real Redis instance.
"""
import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(__file__) + "/..")
from service_import import import_service_app


@pytest.fixture()
def routing_module():
    import_service_app("inference")
    from app import routing
    return routing


def test_no_candidate_always_routes_stable(routing_module, monkeypatch):
    monkeypatch.setattr(routing_module, "get_routing_state",
                         lambda name=None: {"stable_version": "v1", "candidate_version": None,
                                             "canary_percentage": 0})
    for _ in range(20):
        group, version = routing_module.decide_traffic_group()
        assert group == "stable"
        assert version == "v1"


def test_zero_percent_canary_routes_stable(routing_module, monkeypatch):
    monkeypatch.setattr(routing_module, "get_routing_state",
                         lambda name=None: {"stable_version": "v1", "candidate_version": "v2",
                                             "canary_percentage": 0})
    group, version = routing_module.decide_traffic_group()
    assert group == "stable"


def test_hundred_percent_canary_always_routes_canary(routing_module, monkeypatch):
    monkeypatch.setattr(routing_module, "get_routing_state",
                         lambda name=None: {"stable_version": "v1", "candidate_version": "v2",
                                             "canary_percentage": 100})
    for _ in range(20):
        group, version = routing_module.decide_traffic_group()
        assert group == "canary"
        assert version == "v2"


def test_five_percent_split_is_roughly_correct(routing_module, monkeypatch):
    monkeypatch.setattr(routing_module, "get_routing_state",
                         lambda name=None: {"stable_version": "v1", "candidate_version": "v2",
                                             "canary_percentage": 5})
    n = 20000
    canary_count = sum(1 for _ in range(n) if routing_module.decide_traffic_group()[0] == "canary")
    ratio = canary_count / n
    # Statistical test with generous tolerance to avoid flakiness.
    assert 0.03 < ratio < 0.08
