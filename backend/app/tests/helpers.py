from tests.factories import  CREATE_PAYLOAD

def assert_error_detail(response, expected_detail: str):
    assert response.json()["detail"] == expected_detail

async def _client_post(client):
    return await client.post("/users/",json=CREATE_PAYLOAD,headers={"Authorization": "Bearer faketoken"})

async def _client_patch(client, id, payload):
    return await client.patch(
        f"/users/{id}", 
        json=payload,
        headers={"Authorization": "Bearer faketoken"}
    )

async def _client_put(client, id, payload):
    return await client.put(
        f"/users/{id}/password", 
        json=payload,
        headers={"Authorization": "Bearer faketoken"}
    )

# helpers._client_patch(client,target_user.user_id,factories.CREATE_PAYLOAD)