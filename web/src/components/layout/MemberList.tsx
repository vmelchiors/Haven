import React from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import { useCommunityStore } from '../../stores/communityStore';
import { Avatar } from '../ui/Avatar';
import { Crown, Shield } from 'lucide-react';

export const MemberList: React.FC = () => {
  const presence = useChatStore((s) => s.presence);
  const currentUser = useAuthStore((s) => s.user);
  const members = useCommunityStore((s) => s.members);
  const selectedCommunity = useCommunityStore((s) => s.selectedCommunity);

  const ownerId = selectedCommunity?.owner_id;
  const isPrivate = Boolean(selectedCommunity?.is_private);

  // Build unified member list merging DB members and live presence users
  const memberMap = new Map<string, { id: string; username: string; avatar_url?: string; is_admin?: boolean }>();

  // 1. Add DB members
  for (const m of members) {
    memberMap.set(m.id, {
      id: m.id,
      username: m.username,
      avatar_url: m.avatar_url,
      is_admin: m.is_admin,
    });
  }

  // 2. Add current user
  if (currentUser) {
    if (!isPrivate || currentUser.id === ownerId || memberMap.has(currentUser.id)) {
      memberMap.set(currentUser.id, {
        id: currentUser.id,
        username: currentUser.username,
        avatar_url: currentUser.avatar_url,
        is_admin: currentUser.is_admin,
      });
    }
  }

  // 3. Fallback for public communities
  if (!isPrivate && members.length === 0 && presence) {
    for (const [uId, uPres] of Object.entries(presence)) {
      if (!memberMap.has(uId)) {
        memberMap.set(uId, {
          id: uId,
          username: uPres.username || `User ${uId.slice(0, 6)}`,
          avatar_url: uPres.avatar_url,
        });
      }
    }
  }

  const allMembers = Array.from(memberMap.values());

  // Partition into Online and Offline
  const onlineMembers: Array<{ id: string; username: string; avatar_url?: string; is_admin?: boolean; status: 'online' | 'idle' | 'busy' }> = [];
  const offlineMembers: Array<{ id: string; username: string; avatar_url?: string; is_admin?: boolean }> = [];

  for (const m of allMembers) {
    const isSelf = currentUser && m.id === currentUser.id;
    const userPres = presence ? presence[m.id] : undefined;

    if (isSelf || (userPres && userPres.status !== 'offline')) {
      const presStatus = isSelf ? 'online' : (userPres?.status || 'online');
      onlineMembers.push({
        ...m,
        status: presStatus === 'busy' ? 'busy' : presStatus === 'idle' ? 'idle' : 'online',
      });
    } else {
      offlineMembers.push(m);
    }
  }

  return (
    <aside aria-label="Membros" className="w-56 bg-haven-dark border-l border-haven-border flex flex-col h-full flex-shrink-0 select-none p-3 overflow-y-auto hidden lg:flex space-y-4 scrollbar-none">
      {/* ONLINE SECTION */}
      <div>
        <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">
          Online — {onlineMembers.length}
        </div>

        <div className="space-y-0.5">
          {onlineMembers.map((m) => {
            const isSelf = currentUser && m.id === currentUser.id;
            const isOwner = ownerId === m.id;
            return (
              <div
                key={m.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-haven-surface/50 transition-colors group cursor-default"
              >
                <Avatar
                  src={m.avatar_url}
                  name={m.username}
                  size="sm"
                  status={m.status}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-medium text-zinc-200 truncate group-hover:text-white">
                      {m.username}
                    </span>
                    {isOwner && (
                      <span title="Dono da Comunidade" className="flex items-center">
                        <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      </span>
                    )}
                    {!isOwner && m.is_admin && (
                      <span title="Administrador" className="flex items-center">
                        <Shield className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                      </span>
                    )}
                  </div>
                  {isSelf && (
                    <div className="text-[10px] text-zinc-400 font-normal truncate">
                      Você
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* OFFLINE SECTION */}
      {offlineMembers.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">
            Offline — {offlineMembers.length}
          </div>

          <div className="space-y-0.5">
            {offlineMembers.map((m) => {
              const isOwner = ownerId === m.id;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md opacity-60 hover:opacity-100 hover:bg-haven-surface/40 transition-all group cursor-default"
                >
                  <Avatar
                    src={m.avatar_url}
                    name={m.username}
                    size="sm"
                    status="offline"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-medium text-zinc-400 truncate group-hover:text-zinc-200">
                        {m.username}
                      </span>
                      {isOwner && (
                        <span title="Dono da Comunidade" className="flex items-center">
                          <Crown className="w-3 h-3 text-amber-500/70 flex-shrink-0" />
                        </span>
                      )}
                      {!isOwner && m.is_admin && (
                        <span title="Administrador" className="flex items-center">
                          <Shield className="w-3 h-3 text-indigo-500/70 flex-shrink-0" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};
