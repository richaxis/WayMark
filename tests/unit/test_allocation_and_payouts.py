import json

import pytest

from conftest import UserError

BAD_ALLOCATIONS = {
    "negative share summing to 100": [150, -50],
    "negative and over-100": [-10, 110],
    "zero share": [0, 100],
    "zero share last": [100, 0],
    "single share over 100": [101],
    "sums to 99": [50, 49],
    "sums to 101": [50, 51],
    "fractional shares": [33.5, 66.5],
    "string shares": ["50", "50"],
    "bool counted as 1": [True, 99],
    "null share": [None, 100],
    "empty list": [],
    "too many milestones": [4] * 20 + [20],
}


@pytest.mark.parametrize("percents", BAD_ALLOCATIONS.values(), ids=BAD_ALLOCATIONS.keys())
def test_malformed_allocations_are_rejected(env, percents):
    c = env.contract()
    ms = [{"title": f"m{i}", "criteria": "ok", "percent": p} for i, p in enumerate(percents)]
    env.msg.value = 10**18
    with pytest.raises(UserError):
        c.create_deal("0xbuilder", "deal", json.dumps(ms))
    assert c.deals == {} and c.count == 0


@pytest.mark.parametrize("raw", ["not json", "{}", '"x"', "null", "[1, 2]"])
def test_malformed_payloads_are_rejected(env, raw):
    c = env.contract()
    env.msg.value = 10**18
    with pytest.raises(UserError):
        c.create_deal("0xbuilder", "deal", raw)
    assert c.deals == {}


@pytest.mark.parametrize("field", ["title", "criteria"])
def test_blank_title_or_criteria_rejected(env, field):
    c = env.contract()
    env.msg.value = 10**18
    ms = [{"title": "a", "criteria": "b", "percent": 100}]
    ms[0][field] = "  "
    with pytest.raises(UserError):
        c.create_deal("0xbuilder", "deal", json.dumps(ms))


def test_zero_deposit_rejected(env):
    with pytest.raises(UserError):
        env.create(env.contract(), 0, [100])


def test_valid_allocations_accepted(env):
    c = env.contract()
    env.create(c, 10**18, [100])
    env.create(c, 10**18, [1, 99])
    env.create(c, 10**18, [20] * 5)
    assert c.count == 3


def test_odd_deposit_never_pays_more_than_deposit(env):
    c = env.contract()
    env.create(c, 7, [33, 33, 34])
    for i in range(3):
        env.release(c, 0, i)
    paid = sum(a for _, a in env.transfers)
    assert paid == 6 <= 7
    assert int(json.loads(c.deals[0])["paid"]) == paid


def test_not_met_and_partial_pay_nothing_and_allow_resubmit(env):
    c = env.contract()
    env.create(c, 1000, [60, 40])
    env.release(c, 0, 0, verdict="NOT_MET")
    env.release(c, 0, 1, verdict="PARTIAL")
    assert env.transfers == []
    assert [m["status"] for m in json.loads(c.deals[0])["milestones"]] == ["rejected", "rejected"]
    env.release(c, 0, 0, verdict="MET")
    assert env.transfers == [("0xbuilder", 600)]


def test_released_milestone_cannot_be_paid_twice(env):
    c = env.contract()
    env.create(c, 1000, [100])
    env.release(c, 0, 0)
    with pytest.raises(UserError):
        c.judge(0, 0)
    assert sum(a for _, a in env.transfers) == 1000


def test_multiple_deals_each_capped_by_its_own_deposit(env):
    c = env.contract()
    deals = [  # (deposit, shares, builder)
        (1000, [60, 40], "0xaaa"),
        (3, [100], "0xbbb"),
        (10**18, [25, 25, 50], "0xccc"),
        (999, [1, 1, 98], "0xddd"),
        (500, [50, 50], "0xaaa"),  # same builder as deal 0, different deposit
    ]
    for dep, shares, b in deals:
        env.create(c, dep, shares, builder=b, funder="0xfunder")
    # interleave judging across deals
    for idx in range(3):
        for did, (_, shares, _) in enumerate(deals):
            if idx < len(shares):
                env.release(c, did, idx)
    state = [json.loads(c.deals[i]) for i in range(len(deals))]
    for did, (dep, shares, b) in enumerate(deals):
        paid = int(state[did]["paid"])
        assert paid <= dep, f"deal {did} paid {paid} > deposit {dep}"
        assert paid == sum(dep * p // 100 for p in shares)
    assert sum(a for _, a in env.transfers) == sum(int(d["paid"]) for d in state)
    assert sum(a for _, a in env.transfers) <= sum(d[0] for d in deals)
    # builder 0xaaa is paid from two deals, but never beyond those two deposits
    assert sum(a for r, a in env.transfers if r == "0xaaa") <= 1000 + 500


def test_one_deal_cannot_drain_another_deals_deposit(env):
    c = env.contract()
    env.create(c, 100, [100], builder="0xsmall")
    env.create(c, 10**6, [100], builder="0xbig")
    env.release(c, 0, 0)
    assert [a for r, a in env.transfers if r == "0xsmall"] == [100]
    assert not any(r == "0xbig" for r, _ in env.transfers)


@pytest.mark.parametrize("bad_share", [150, -50, 0, 101])
def test_payout_guard_blocks_tampered_storage(env, bad_share):
    """Even if a bad allocation somehow reached storage, judge must not overpay."""
    c = env.contract()
    env.create(c, 1000, [50, 50])
    deal = json.loads(c.deals[0])
    deal["milestones"][0]["percent"] = bad_share
    c.deals[0] = json.dumps(deal)
    with pytest.raises(UserError):
        env.release(c, 0, 0)
    assert env.transfers == []
    assert int(json.loads(c.deals[0])["paid"]) == 0


def test_paid_total_guard_blocks_exceeding_deposit(env):
    c = env.contract()
    env.create(c, 1000, [50, 50])
    deal = json.loads(c.deals[0])
    deal["paid"] = "600"  # pretend 600 already left; another 500 would exceed 1000
    c.deals[0] = json.dumps(deal)
    with pytest.raises(UserError):
        env.release(c, 0, 0)
    assert env.transfers == []
