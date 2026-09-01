async def test_health(client):
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


async def test_protected_endpoint_requires_token(client):
    res = await client.get("/api/v1/me")
    assert res.status_code == 401
    assert res.json()["code"] == "NO_TOKEN"
