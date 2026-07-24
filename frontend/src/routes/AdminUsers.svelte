<script lang="ts">
  import { onMount } from "svelte";
  import type { AdminUserDTO } from "@flashcards/shared";
  import { api, ApiError } from "../lib/api";
  import { currentUser } from "../lib/auth";

  let users: AdminUserDTO[] = [];
  let loading = true;
  let error = "";
  let busyId = "";

  async function load() {
    loading = true;
    error = "";
    try {
      const res = await api.adminListUsers();
      users = res.users;
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Failed to load users.";
    } finally {
      loading = false;
    }
  }

  async function act(id: string, action: (id: string) => Promise<{ user: AdminUserDTO }>) {
    busyId = id;
    error = "";
    try {
      const { user } = await action(id);
      users = users.map((u) => (u.id === user.id ? user : u));
    } catch (e) {
      error = e instanceof ApiError ? e.message : "Action failed.";
    } finally {
      busyId = "";
    }
  }

  onMount(load);
</script>

<div class="header">
  <h1>Manage users</h1>
</div>

{#if error}<p class="error">{error}</p>{/if}

{#if loading}
  <p class="muted">Loading…</p>
{:else}
  <div class="table-wrap card-surface">
    <table>
      <thead>
        <tr>
          <th>Email</th>
          <th>Name</th>
          <th>Role</th>
          <th>Status</th>
          <th>Joined</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each users as user (user.id)}
          <tr>
            <td>{user.email}</td>
            <td class="muted">{user.displayName ?? "—"}</td>
            <td><span class="pill role-{user.role}">{user.role}</span></td>
            <td><span class="pill status-{user.status}">{user.status}</span></td>
            <td class="muted">{new Date(user.createdAt).toLocaleDateString()}</td>
            <td class="actions">
              {#if user.status === "pending"}
                <button class="btn btn-primary" disabled={busyId === user.id} on:click={() => act(user.id, api.adminApprove)}>Approve</button>
                <button class="btn" disabled={busyId === user.id} on:click={() => act(user.id, api.adminReject)}>Reject</button>
              {:else if user.status === "deactivated"}
                <button class="btn" disabled={busyId === user.id} on:click={() => act(user.id, api.adminReactivate)}>Reactivate</button>
              {:else if user.status === "approved" && user.id !== $currentUser?.id}
                <button class="btn" disabled={busyId === user.id} on:click={() => act(user.id, api.adminDeactivate)}>Deactivate</button>
              {/if}
              {#if user.role === "user" && user.status === "approved"}
                <button class="btn" disabled={busyId === user.id} on:click={() => act(user.id, api.adminPromote)}>Make admin</button>
              {:else if user.role === "admin" && user.id !== $currentUser?.id}
                <button class="btn" disabled={busyId === user.id} on:click={() => act(user.id, api.adminDemote)}>Remove admin</button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .header { margin-bottom: 1rem; }
  .error { color: var(--bad); margin-bottom: 1rem; }
  .table-wrap { overflow-x: auto; padding: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { text-align: left; padding: 0.7rem 1rem; border-bottom: 1px solid var(--border); white-space: nowrap; }
  th { color: var(--text-dim); font-weight: 600; font-size: 0.8rem; text-transform: uppercase; }
  tr:last-child td { border-bottom: none; }
  .actions { display: flex; gap: 0.5rem; }
  .pill {
    border-radius: 999px;
    padding: 0.15rem 0.6rem;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .role-admin { background: rgba(110, 168, 254, 0.18); color: var(--accent); }
  .role-user { background: var(--surface-2); color: var(--text-dim); }
  .status-pending { background: rgba(251, 191, 36, 0.18); color: var(--warn); }
  .status-approved { background: rgba(74, 222, 128, 0.18); color: var(--good); }
  .status-rejected, .status-deactivated { background: rgba(248, 113, 113, 0.18); color: var(--bad); }
</style>
