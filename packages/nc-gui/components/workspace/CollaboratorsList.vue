<script lang="ts" setup>
import { OrderedWorkspaceRoles, WorkspaceUserRoles, parseStringDateTime, timeAgo } from 'nocodb-sdk'
import { storeToRefs, useUserSorts, useWorkspace } from '#imports'

const { workspaceRoles, loadRoles } = useRoles()

const workspaceStore = useWorkspace()

const { removeCollaborator, updateCollaborator: _updateCollaborator } = workspaceStore

const { collaborators } = storeToRefs(workspaceStore)

const { sorts, sortDirection, loadSorts, saveOrUpdate, handleGetSortedData } = useUserSorts('Workspace')

const userSearchText = ref('')

const filterCollaborators = computed(() => {
  if (!userSearchText.value) return collaborators.value ?? []

  if (!collaborators.value) return []

  return collaborators.value.filter((collab) =>
    (collab.display_name || collab.email).toLowerCase().includes(userSearchText.value.toLowerCase()),
  )
})

const sortedCollaborators = computed(() => {
  return handleGetSortedData(filterCollaborators.value, sorts.value)
})

const updateCollaborator = async (collab: any, roles: WorkspaceUserRoles) => {
  try {
    await _updateCollaborator(collab.id, roles)
    message.success('Successfully updated user role')

    collaborators.value?.forEach((collaborator) => {
      if (collaborator.id === collab.id) {
        collaborator.roles = roles
      }
    })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const accessibleRoles = computed<WorkspaceUserRoles[]>(() => {
  const currentRoleIndex = OrderedWorkspaceRoles.findIndex(
    (role) => workspaceRoles.value && Object.keys(workspaceRoles.value).includes(role),
  )
  if (currentRoleIndex === -1) return []
  return OrderedWorkspaceRoles.slice(currentRoleIndex + 1).filter((r) => r)
})

onMounted(async () => {
  await loadRoles()
  loadSorts()
})
</script>

<template>
  <div class="nc-collaborator-table-container mt-4 mx-6 h-[calc(100vh-12rem)]">
    <div class="w-full flex justify-between items-baseline mt-6.5 mb-2 pr-0.25 ml-2">
      <div class="text-xl">Invite Members By Email</div>
      <a-input v-model:value="userSearchText" class="!max-w-90 !rounded-md mr-4" placeholder="Search members">
        <template #prefix>
          <PhMagnifyingGlassBold class="!h-3.5 text-gray-500" />
        </template>
      </a-input>
    </div>
    <WorkspaceInviteSection v-if="workspaceRole !== WorkspaceUserRoles.VIEWER" />
    <div v-if="!filterCollaborators?.length" class="w-full h-full flex flex-col items-center justify-center mt-36">
      <a-empty description="No members found" />
    </div>
    <div v-else class="nc-collaborators-list mt-6 h-full">
      <div class="flex flex-col rounded-lg overflow-hidden border-1 max-w-350 max-h-[calc(100%-8rem)]">
        <div class="flex flex-row bg-gray-50 min-h-12 items-center">
          <div class="text-gray-700 users-email-grid w-3/8 ml-10 mr-3 flex items-center space-x-2">
            <span>
              {{ $t('objects.users') }}
            </span>
            <LazyAccountUserMenu :direction="sortDirection.email" field="email" :handle-user-sort="saveOrUpdate" />
          </div>
          <div class="text-gray-700 user-access-grid w-2/8 mr-3 flex items-center space-x-2">
            <span>
              {{ $t('general.access') }}
            </span>
            <LazyAccountUserMenu :direction="sortDirection.roles" field="roles" :handle-user-sort="saveOrUpdate" />
          </div>
          <div class="text-gray-700 date-joined-grid w-2/8 mr-3">{{ $t('title.dateJoined') }}</div>
          <div class="text-gray-700 user-access-grid w-1/8">Actions</div>
        </div>

        <div class="flex flex-col nc-scrollbar-md">
          <div
            v-for="(collab, i) of sortedCollaborators"
            :key="i"
            class="flex flex-row border-b-1 py-1 min-h-14 items-center justify-around last"
          >
            <div class="flex gap-3 items-center users-email-grid w-3/8 ml-10">
              <GeneralUserIcon size="base" :name="collab.email" :email="collab.email" />
              <NcTooltip v-if="collab.display_name">
                <template #title>
                  {{ collab.email }}
                </template>
                <span class="truncate">
                  {{ collab.display_name }}
                </span>
              </NcTooltip>
              <span v-else class="truncate">
                {{ collab.email }}
              </span>
            </div>
            <div class="user-access-grid w-2/8">
              <template v-if="accessibleRoles.includes(collab.roles)">
                <div class="w-[30px]">
                  <RolesSelector
                    :role="collab.roles"
                    :roles="accessibleRoles"
                    :description="false"
                    class="cursor-pointer"
                    :on-role-change="(role: WorkspaceUserRoles) => updateCollaborator(collab, role)"
                  />
                </div>
              </template>
              <template v-else>
                <RolesBadge :role="collab.roles" class="cursor-default" />
              </template>
            </div>
            <div class="date-joined-grid w-2/8 flex justify-start">
              <NcTooltip class="max-w-full">
                <template #title>
                  {{ parseStringDateTime(collab.created_at) }}
                </template>
                <span>
                  {{ timeAgo(collab.created_at) }}
                </span>
              </NcTooltip>
            </div>
            <div class="w-1/8 pl-6">
              <NcDropdown v-if="collab.roles !== WorkspaceUserRoles.OWNER" :trigger="['click']">
                <MdiDotsVertical
                  class="border-1 !text-gray-600 h-5.5 w-5.5 rounded outline-0 p-0.5 nc-workspace-menu transform transition-transform !text-gray-400 cursor-pointer hover:(!text-gray-500 bg-gray-100)"
                />
                <template #overlay>
                  <NcMenu>
                    <NcMenuItem class="!text-red-500 !hover:bg-red-50" @click="removeCollaborator(collab.id)">
                      <MaterialSymbolsDeleteOutlineRounded />
                      Remove user
                    </NcMenuItem>
                  </NcMenu>
                </template>
              </NcDropdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.badge-text {
  @apply text-[14px] pt-1 text-center;
}

.nc-collaborators-list-table {
  @apply min-w-[700px] !w-full border-gray-100 mt-1;
}

.last:last-child {
  border-bottom: none;
}
</style>
