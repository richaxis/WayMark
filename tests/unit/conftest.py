"""Runs contracts/waymark.py on plain Python with a tiny fake GenLayer runtime,
so allocation and payout rules are tested without a node or genlayer-test."""
import importlib.util
import json
import pathlib
import sys
import types

import pytest

CONTRACT = pathlib.Path(__file__).resolve().parents[2] / "contracts" / "waymark.py"


class UserError(Exception):
    pass


class Addr:
    def __init__(self, hex_):
        self.as_hex = str(hex_).lower()


class Env:
    def __init__(self):
        self.transfers = []  # (recipient_hex, amount) for every emit_transfer
        self.verdict = "MET"
        self.msg = types.SimpleNamespace(value=0, sender_address=Addr("0xfunder"))
        self.module = self._load()

    def _load(self):
        gl = types.ModuleType("genlayer")
        write = lambda f: f
        write.payable = lambda f: f
        gl.contract = types.SimpleNamespace(Contract=type("Contract", (), {}))
        gl.public = types.SimpleNamespace(view=lambda f: f, write=write)
        gl.vm = types.SimpleNamespace(UserError=UserError)
        gl.storage = types.SimpleNamespace(TreeMap=dict)
        gl.message = self.msg
        env = self

        def contract_interface(cls):
            class Payee:
                def __init__(self, addr):
                    self.addr = addr

                def emit_transfer(self, value):
                    env.transfers.append((self.addr.as_hex, int(value)))
            return Payee

        gl.evm = types.SimpleNamespace(contract_interface=contract_interface)
        gl.nondet = types.SimpleNamespace(
            web=types.SimpleNamespace(render=lambda url, mode="text": "evidence page"),
            exec_prompt=lambda task: json.dumps({"verdict": env.verdict, "reason": "ok"}),
        )
        gl.eq_principle = types.SimpleNamespace(prompt_comparative=lambda fn, crit: fn())
        types_mod = types.ModuleType("genlayer.types")
        types_mod.u256 = int
        types_mod.Address = Addr
        gl.types = types_mod
        sys.modules["genlayer"], sys.modules["genlayer.types"] = gl, types_mod
        spec = importlib.util.spec_from_file_location("waymark_under_test", CONTRACT)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def contract(self):
        c = self.module.Waymark()
        c.deals = {}
        return c

    def create(self, c, deposit, percents, builder="0xbuilder", funder="0xfunder"):
        self.msg.sender_address, self.msg.value = Addr(funder), deposit
        ms = [{"title": f"m{i}", "criteria": "page is fine", "percent": p} for i, p in enumerate(percents)]
        c.create_deal(builder, "deal", json.dumps(ms))

    def release(self, c, deal_id, index, verdict="MET"):
        deal = json.loads(c.deals[deal_id])
        self.msg.sender_address, self.msg.value = Addr(deal["builder"]), 0
        c.submit(deal_id, index, "https://example.com")
        self.verdict = verdict
        c.judge(deal_id, index)


@pytest.fixture
def env():
    return Env()
