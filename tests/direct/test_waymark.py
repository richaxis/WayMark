"""Direct Mode tests (genlayer-test). The fixture and mock names follow the
genlayer-test direct-mode API; adjust them if your installed version differs."""
import json
import pytest

CONTRACT = "contracts/waymark.py"
MS = json.dumps([
    {"title": "A", "criteria": "page says hello", "percent": 40},
    {"title": "B", "criteria": "page says bye", "percent": 60},
])


@pytest.fixture
def deal(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    direct_vm.value = 10**18
    c.create_deal(direct_bob.as_hex, "Test deal", MS)
    direct_vm.value = 0
    return c


def test_create_requires_value_and_100_percent(direct_vm, direct_deploy, direct_bob):
    c = direct_deploy(CONTRACT)
    direct_vm.value = 0
    with pytest.raises(Exception):
        c.create_deal(direct_bob.as_hex, "x", MS)
    direct_vm.value = 10**18
    with pytest.raises(Exception):
        c.create_deal(direct_bob.as_hex, "x", json.dumps([{"title": "A", "criteria": "c", "percent": 90}]))


def test_only_builder_can_submit(direct_vm, deal, direct_alice):
    direct_vm.sender = direct_alice  # the funder, not the builder
    with pytest.raises(Exception):
        deal.submit(0, 0, "https://example.com")


def test_judge_needs_submission(direct_vm, deal):
    with pytest.raises(Exception):
        deal.judge(0, 0)


def test_met_releases_and_not_met_rejects(direct_vm, deal, direct_bob):
    direct_vm.sender = direct_bob
    deal.submit(0, 0, "https://example.com")
    direct_vm.mock_web(r".*example\.com.*", {"response": {"status": 200, "body": "hello"}, "method": "GET"})
    direct_vm.mock_llm(r".*", json.dumps({"verdict": "MET", "reason": "page says hello"}))
    deal.judge(0, 0)
    d = json.loads(deal.get_all())[0]
    assert d["milestones"][0]["status"] == "released"

    deal.submit(0, 1, "https://example.com")
    direct_vm.clear_mocks() if hasattr(direct_vm, "clear_mocks") else None
    direct_vm.mock_llm(r".*", json.dumps({"verdict": "NOT_MET", "reason": "no bye"}))
    deal.judge(0, 1)
    assert json.loads(deal.get_all())[0]["milestones"][1]["status"] == "rejected"


@pytest.mark.parametrize("percents", [[150, -50], [0, 100], [50, 49], [101]])
def test_bad_allocations_rejected_on_chain(direct_vm, direct_deploy, direct_bob, percents):
    c = direct_deploy(CONTRACT)
    direct_vm.value = 10**18
    ms = json.dumps([{"title": "t", "criteria": "c", "percent": p} for p in percents])
    with pytest.raises(Exception):
        c.create_deal(direct_bob.as_hex, "x", ms)
