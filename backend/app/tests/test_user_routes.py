import uuid
import pytest
from unittest.mock import AsyncMock, patch

from app.tests import factories as factories
from tests import helpers as helpers
from app.models import UserRole

# ---------------------------------------------------------------------------- #
#                                Test Variables                                #
# ---------------------------------------------------------------------------- #
jwt_decode = "app.routes.dependencies.jwt.decode"
get_user = "app.crud.user.get_user_by_user_id"
ver_unique = "app.routes.v1.user.verify_uniqueness"
get_user_route = "app.crud.user.update_user"  # In my route I import as module


# ---------------------------------------------------------------------------- #
#                        Test 1 - Successful User Create                       #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_create_user_success(client, mock_admin):

    mock_created = factories.make_mock_user(role=UserRole.SALES)

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, new_callable=AsyncMock, return_value=mock_admin),
        patch(ver_unique, new_callable=AsyncMock),
        patch(
            "app.routes.v1.user.user_crud.create_user",
            new_callable=AsyncMock,
            return_value=mock_created,
        ),
        patch(
            "app.routes.v1.user.auditlog_crud.log_user_created", new_callable=AsyncMock
        ),
    ):
        response = await client.post(
            "/users/",
            json=factories.CREATE_PAYLOAD,
            headers={"Authorization": "Bearer faketoken"},
        )

    assert response.status_code == 201, response.json()

    data = response.json()
    assert "user_id" in data
    assert "created_at" in data
    assert "updated_at" in data
    assert data["user_name"] == mock_created.user_name
    assert data["email"] == mock_created.email
    assert data["role"] == UserRole.SALES.value
    assert data["is_active"] is True
    assert "password" not in data


# ---------------------------------------------------------------------------- #
#                            Test 2 - Authorization                            #
# ---------------------------------------------------------------------------- #


# -------------------------------- create user ------------------------------- #
@pytest.mark.asyncio
async def test_create_user_no_token(client):
    response = await client.post("/users/", json=factories.CREATE_PAYLOAD)
    assert response.status_code == 401
    helpers.assert_error_detail(response, "Not authenticated")


# --------------------------------- get user --------------------------------- #
@pytest.mark.asyncio
async def test_get_users_no_token(client):
    response = await client.get("/users/")
    assert response.status_code == 401
    helpers.assert_error_detail(response, "Not authenticated")


# -------------------------------- delete user ------------------------------- #
@pytest.mark.asyncio
async def test_delete_user_no_token(client):
    response = await client.delete("/users/{user_id}")
    assert response.status_code == 401
    helpers.assert_error_detail(response, "Not authenticated")


# -------------------------------- update user ------------------------------- #
@pytest.mark.asyncio
async def test_update_user_no_token(client):
    response = await client.patch("/users/{user_id}", json=factories.CREATE_PAYLOAD)
    assert response.status_code == 401
    helpers.assert_error_detail(response, "Not authenticated")


# ----------------------------- deactivated admin ---------------------------- #
@pytest.mark.asyncio
async def test_create_user_with_deactive_admin(client):
    inactive_admin = factories.make_mock_user(is_active=False)
    with (
        patch(jwt_decode, return_value={"sub": str(inactive_admin.user_id)}),
        patch(get_user, new_callable=AsyncMock, return_value=inactive_admin),
    ):
        response = await helpers._client_post(client)
    assert response.status_code == 403
    helpers.assert_error_detail(response, "User account is deactivated")


# ------------------------------- nonexist user ------------------------------ #
@pytest.mark.asyncio
async def test_creat_user_with_nonexist_user(client):
    non_exist_user = None
    with (
        patch(jwt_decode, return_value={"sub": str(uuid.uuid4())}),
        patch(get_user, new_callable=AsyncMock, return_value=non_exist_user),
    ):
        response = await helpers._client_post(client)
    assert response.status_code == 401
    helpers.assert_error_detail(response, "User not found")


# --------------------------------- non admin -------------------------------- #
@pytest.mark.asyncio
async def test_creat_user_with_non_admin(client):
    non_admin_user = factories.make_mock_user(role=UserRole.INVENTORY_MANAGER)
    with (
        patch(jwt_decode, return_value={"sub": str(non_admin_user.user_id)}),
        patch(get_user, new_callable=AsyncMock, return_value=non_admin_user),
    ):
        response = await helpers._client_post(client)
    assert response.status_code == 403
    helpers.assert_error_detail(response, "Not enough permissions")


# ---------------------------------------------------------------------------- #
#                        Test 3 - Successful User Update                       #
# ---------------------------------------------------------------------------- #
update_user = "app.routes.v1.user.user_crud.update_user"
log_user_deactivated = "app.routes.v1.user.auditlog_crud.log_user_deactivated"


@pytest.mark.asyncio
async def test_update_user_success(client, mock_admin):

    target_user = factories.make_mock_user()
    mock_get = AsyncMock()
    mock_get.side_effect = [mock_admin, target_user]

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, mock_get),
        patch(ver_unique, new_callable=AsyncMock),
        patch(update_user, new_callable=AsyncMock, return_value=target_user),
        patch(log_user_deactivated, new_callable=AsyncMock),
    ):
        response = await helpers._client_patch(
            client, target_user.user_id, factories.CREATE_PAYLOAD
        )
    assert response.status_code == 200, response.json()


# ---------------------------------------------------------------------------- #
#                          Test 4 - Update Super Admin                         #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_update_super_admin(client, mock_admin):

    target_user = factories.make_mock_user(user_name="adminhomerex")
    mock_get = AsyncMock()
    mock_get.side_effect = [mock_admin, target_user]

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, mock_get),
    ):
        response = await helpers._client_patch(
            client, target_user.user_id, factories.UPDATE_PAYLOAD
        )
    assert response.status_code == 403
    helpers.assert_error_detail(response, "Super admin account cannot be modified")


# ---------------------------------------------------------------------------- #
#                      Test 5 - Admin update another admin                     #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_admin_cannot_update_admin(client, mock_admin):

    target_admin = factories.make_mock_user(role=UserRole.ADMIN)
    mock_get = AsyncMock()
    mock_get.side_effect = [mock_admin, target_admin]

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, mock_get),
    ):
        response = await helpers._client_patch(
            client, target_admin.user_id, factories.UPDATE_PAYLOAD
        )

    assert response.status_code == 403
    helpers.assert_error_detail(
        response, "Regular administrators cannot update other administrators"
    )


# ---------------------------------------------------------------------------- #
#                   Test 6 - Admin can't deactivate them self                  #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_admin_cannot_deactivate_self(client, mock_admin):

    target_admin = factories.make_mock_user(user_id=mock_admin.user_id)
    mock_get = AsyncMock()
    mock_get.side_effect = [mock_admin, target_admin]

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, mock_get),
    ):
        response = await helpers._client_patch(
            client, target_admin.user_id, factories.DEATIVATED_PAYLOAD
        )

    assert response.status_code == 403
    helpers.assert_error_detail(response, "Admin cannot deactivate their own account")


# ---------------------------------------------------------------------------- #
#                Test 7 - Other roles cannot update another user               #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_other_roles_cannot_update_user(client, mock_admin):

    current_user = factories.make_mock_user(role=UserRole.SALES)
    target_user = mock_admin

    mock_get = AsyncMock()
    mock_get.side_effect = [current_user, target_user]

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, mock_get),
    ):
        response = await helpers._client_patch(
            client, target_user.user_id, factories.UPDATE_PAYLOAD
        )

    assert response.status_code == 403
    helpers.assert_error_detail(response, "You can only update your own profile")


# ---------------------------------------------------------------------------- #
#                Test 8 - Other roles cannot deactivate themself               #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def tets_other_roles_cannot_deactivate_self(client):

    current_user = factories.make_mock_user(role=UserRole.AUDITOR)

    mock_get = AsyncMock()
    mock_get.side_effect = [current_user, current_user]

    with (
        patch(jwt_decode, return_value={"sub": str(current_user.user_id)}),
        patch(get_user, mock_get),
    ):
        response = await helpers._client_patch(
            client, current_user.user_id, factories.DEATIVATED_PAYLOAD
        )

    assert response.status_code == 403
    helpers.assert_error_detail(response, "You cannot deactivate your self")


# ---------------------------------------------------------------------------- #
#                Test 9 - Super admin cannot change own password               #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_super_admin_cannot_change_own_password(client):

    current_user = factories.make_mock_user(user_name="adminhomerex")

    mock_get = AsyncMock()
    mock_get.side_effect = [current_user, current_user]

    with (
        patch(jwt_decode, return_value={"sub": str(current_user.user_id)}),
        patch(get_user, mock_get),
    ):
        response = await helpers._client_put(
            client, current_user.user_id, factories.DELETE_PASSWORD_PAYLOAD
        )

    assert response.status_code == 403
    helpers.assert_error_detail(response, "Super admin account cannot be modified")


# ---------------------------------------------------------------------------- #
#         Test 10 - Super admin password cannot be changed by non admin        #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_super_admin_cannot_change_password_by_non_admin(client):

    current_user = factories.make_mock_user(role=UserRole.AUDITOR)
    target_user = factories.make_mock_user(user_name="adminhomerex")

    mock_get = AsyncMock()
    mock_get.side_effect = [current_user, target_user]

    with (
        patch(jwt_decode, return_value={"sub": str(current_user.user_id)}),
        patch(get_user, mock_get),
    ):
        response = await helpers._client_put(
            client, target_user.user_id, factories.DELETE_PASSWORD_PAYLOAD_WITH_NONE
        )

    assert response.status_code == 403
    helpers.assert_error_detail(
        response, "You are not authorized to change this user's password."
    )


# ---------------------------------------------------------------------------- #
#           Test 11 - Super admin password cannot be changed by admin          #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_super_admin_cannot_change_password_by_admin(client, mock_admin):

    current_user = mock_admin
    target_user = factories.make_mock_user(
        user_name="adminhomerex", role=UserRole.ADMIN
    )

    mock_get = AsyncMock()
    mock_get.side_effect = [current_user, target_user]

    with (
        patch(jwt_decode, return_value={"sub": str(current_user.user_id)}),
        patch(get_user, mock_get),
    ):
        response = await helpers._client_put(
            client, target_user.user_id, factories.DELETE_PASSWORD_PAYLOAD_WITH_NONE
        )

    assert response.status_code == 403
    helpers.assert_error_detail(
        response, "Admins cannot change another admin's password."
    )


# ---------------------------------------------------------------------------- #
#             Test 12 - Admin cannot change another admin password             #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_non_admin_cannot_change_other_user_password(client, mock_admin):

    current_user = mock_admin
    target_user = factories.make_mock_user(role=UserRole.ADMIN)

    mock_get = AsyncMock()
    mock_get.side_effect = [current_user, target_user]

    with (
        patch(jwt_decode, return_value={"sub": str(current_user.user_id)}),
        patch(get_user, mock_get),
    ):
        response = await helpers._client_put(
            client, target_user.user_id, factories.DELETE_PASSWORD_PAYLOAD_WITH_NONE
        )

    assert response.status_code == 403
    helpers.assert_error_detail(
        response, "Admins cannot change another admin's password."
    )


# ---------------------------------------------------------------------------- #
#             Test 13 - Non admin cant change another user password            #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_admin_cannot_change_admin_password(client):

    target_user_id = uuid.uuid4()
    current_user = factories.make_mock_user(role=UserRole.SALES)
    target_user = factories.make_mock_user(
        user_id=target_user_id, role=UserRole.AUDITOR
    )
    mock_get = AsyncMock()
    mock_get.side_effect = [current_user, target_user]

    with (
        patch(jwt_decode, return_value={"sub": str(current_user.user_id)}),
        patch(get_user, mock_get),
    ):
        response = await helpers._client_put(
            client, target_user_id, factories.DELETE_PASSWORD_PAYLOAD_WITH_NONE
        )

    assert response.status_code == 403
    helpers.assert_error_detail(
        response, "You are not authorized to change this user's password."
    )


# ---------------------------------------------------------------------------- #
#            Test 14 - Self password change reqire current password            #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_self_password_change_require_current_password(client, mock_admin):

    mock_get = AsyncMock()
    mock_get.side_effect = [mock_admin, mock_admin]

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, mock_get),
    ):
        response = await helpers._client_put(
            client, mock_admin.user_id, factories.DELETE_PASSWORD_PAYLOAD_WITH_NONE
        )
    assert response.status_code == 400
    helpers.assert_error_detail(response, "Current password is required.")


# ---------------------------------------------------------------------------- #
#          Test 15 - Current password and new password cannot be same          #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_both_password_cannot_be_same_for(client):

    current_user = factories.make_mock_user(role=UserRole.AUDITOR)
    mock_get = AsyncMock()
    mock_get.side_effect = [current_user, current_user]

    with (
        patch(jwt_decode, return_value={"sub": str(current_user.user_id)}),
        patch(get_user, mock_get),
    ):
        response = await helpers._client_put(
            client, current_user.user_id, factories.DELETE_PASSWORD_IDENTICAL
        )

    assert response.status_code == 400
    helpers.assert_error_detail(
        response, "New password cannot be the same as the current password."
    )


# ---------------------------------------------------------------------------- #
#                  Test 16 - Curent passsword cannot be empty                  #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_current_password_cannot_be_empty(client):

    current_user = factories.make_mock_user(role=UserRole.AUDITOR)
    mock_get = AsyncMock()
    mock_get.side_effect = [current_user, current_user]

    with (
        patch(jwt_decode, return_value={"sub": str(current_user.user_id)}),
        patch(get_user, mock_get),
    ):
        response = await helpers._client_put(
            client, current_user.user_id, factories.DELETE_PASSWORD_PAYLOAD_WITH_NONE
        )

    assert response.status_code == 400
    helpers.assert_error_detail(response, "Current password is required.")


# ---------------------------------------------------------------------------- #
#              Test 17 - Super Admin can change any user password              #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_super_admin_can_change_any_user_password(client, mock_admin):

    current_user = factories.make_mock_user(user_name="adminhomerex")
    mock_get = AsyncMock()
    mock_get.side_effect = [current_user, mock_admin]

    with (
        patch(jwt_decode, return_value={"sub": str(current_user.user_id)}),
        patch(get_user, mock_get),
        patch("app.routes.v1.user.hash_password", return_value=True),
        patch(
            "app.routes.v1.user.auditlog_crud.changed_password", new_callable=AsyncMock
        ),
    ):
        response = await helpers._client_put(
            client, mock_admin.user_id, factories.DELETE_PASSWORD_PAYLOAD
        )

    assert response.status_code == 200

    data = response.json()
    assert data == {"detail": "Password updated successfully. Please log in again."}


# ---------------------------------------------------------------------------- #
#               Test 18 - Admin can change any non admin password              #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_admin_can_change_any_user_password(client, mock_admin):

    target_user = factories.make_mock_user()
    mock_get = AsyncMock()
    mock_get.side_effect = [mock_admin, target_user]

    with (
        patch(jwt_decode, return_value={"sub": str(mock_admin.user_id)}),
        patch(get_user, mock_get),
        patch("app.routes.v1.user.hash_password", return_value="fake_hashed_password"),
        patch(
            "app.routes.v1.user.auditlog_crud.changed_password", new_callable=AsyncMock
        ),
    ):
        response = await helpers._client_put(
            client, target_user.user_id, factories.DELETE_PASSWORD_PAYLOAD_WITH_NONE
        )

    assert response.status_code == 200

    data = response.json()
    assert data == {"detail": "Password updated successfully. Please log in again."}


# ---------------------------------------------------------------------------- #
#       Test 19 - Except suepr admin, anyone can chage their own password      #
# ---------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_can_change_own_password(client):

    target_user = factories.make_mock_user()
    mock_get = AsyncMock()
    mock_get.side_effect = [target_user, target_user]

    with (
        patch(jwt_decode, return_value={"sub": str(target_user.user_id)}),
        patch(get_user, mock_get),
        patch("app.routes.v1.user.hash_password", return_value="fake_hashed_password"),
        patch("app.routes.v1.user.verify_password", return_value=True),
        patch(
            "app.routes.v1.user.auditlog_crud.changed_password", new_callable=AsyncMock
        ),
    ):
        response = await helpers._client_put(
            client, target_user.user_id, factories.DELETE_PASSWORD_PAYLOAD
        )

    assert response.status_code == 200

    data = response.json()
    assert data == {"detail": "Password updated successfully. Please log in again."}
