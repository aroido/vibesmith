import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Activity, LibraryBig, Settings2, UserPlus, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { PageFrame } from '@/components/common';
import type {
  TeamEntity,
  TeamMember,
  TeamRole,
  TeamSettings,
  TeamSyncIntervalMinutes,
} from '../types';

const PANEL_CLASS = 'vs-frost-panel rounded-2xl p-4 md:p-6';

const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'team:validation.teamNameMin')
    .max(40, 'team:validation.teamNameMax'),
  description: z
    .string()
    .trim()
    .max(160, 'team:validation.teamDescriptionMax')
    .optional()
    .or(z.literal('')),
});

const inviteMemberSchema = z.object({
  email: z.string().trim().email('team:validation.inviteEmailInvalid'),
  role: z.enum(['owner', 'maintainer', 'member']),
});

const teamSettingsSchema = z.object({
  visibility: z.enum(['private', 'team', 'public']),
  defaultPermission: z.enum(['read', 'write']),
  autoSync: z.boolean(),
  syncIntervalMinutes: z
    .coerce
    .number()
    .int()
    .refine((value) => [5, 30, 60].includes(value), {
      message: 'team:validation.syncIntervalInvalid',
    }),
});

type CreateTeamFormValues = z.infer<typeof createTeamSchema>;
type InviteMemberFormValues = z.infer<typeof inviteMemberSchema>;
type TeamSettingsFormInput = z.input<typeof teamSettingsSchema>;
type TeamSettingsFormValues = z.output<typeof teamSettingsSchema>;

const INITIAL_TEAM: TeamEntity = {
  id: 'team_collaboration_hub',
  name: 'Sample Collaboration Team',
  description: 'Example workspace for shared skills, reviews, and release coordination.',
  createdAt: '2026-02-10T09:00:00Z',
  members: [
    {
      id: 'member_jordan',
      name: 'Jordan',
      email: 'jordan@example.com',
      role: 'owner',
      joinedAt: '2026-02-10T09:00:00Z',
    },
    {
      id: 'member_casey',
      name: 'Casey',
      email: 'casey@example.com',
      role: 'maintainer',
      joinedAt: '2026-02-11T08:30:00Z',
    },
  ],
  sharedSkills: [
    {
      id: 'skill_release_gate',
      name: 'release-gate-checker',
      category: 'DevOps',
      owner: 'Jordan',
      permission: 'write',
      updatedAt: '2026-02-22T06:10:00Z',
      downloads: 47,
    },
    {
      id: 'skill_spec_reviewer',
      name: 'spec-review-assistant',
      category: 'Productivity',
      owner: 'Casey',
      permission: 'read',
      updatedAt: '2026-02-21T03:00:00Z',
      downloads: 31,
    },
  ],
  activities: [
    {
      id: 'activity_01',
      actor: 'Jordan',
      action: 'updated',
      target: 'release-gate-checker',
      timestamp: '2026-02-22T06:10:00Z',
    },
    {
      id: 'activity_02',
      actor: 'Casey',
      action: 'invited',
      target: 'new maintainer',
      timestamp: '2026-02-21T14:45:00Z',
    },
  ],
  settings: {
    visibility: 'team',
    defaultPermission: 'read',
    autoSync: true,
    syncIntervalMinutes: 30,
  },
};

function toSettingsFormValues(settings: TeamSettings): TeamSettingsFormValues {
  return {
    visibility: settings.visibility,
    defaultPermission: settings.defaultPermission,
    autoSync: settings.autoSync,
    syncIntervalMinutes: settings.syncIntervalMinutes,
  };
}

function normalizeDisplayName(email: string): string {
  const head = email.split('@')[0] ?? email;
  return head
    .split(/[._-]+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatDate(value: string, language: string): string {
  try {
    return new Date(value).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function toSyncIntervalMinutes(value: number): TeamSyncIntervalMinutes {
  if (value === 5 || value === 30 || value === 60) {
    return value;
  }

  return 30;
}

export function TeamPage() {
  const { t, i18n } = useTranslation(['team', 'navigation', 'common']);

  const [teams, setTeams] = useState<TeamEntity[]>([INITIAL_TEAM]);
  const [activeTeamId, setActiveTeamId] = useState<string>(INITIAL_TEAM.id);
  const [message, setMessage] = useState<string | null>(null);

  const activeTeam = useMemo(
    () => teams.find((team) => team.id === activeTeamId) ?? null,
    [teams, activeTeamId]
  );

  const createTeamForm = useForm<CreateTeamFormValues>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const inviteMemberForm = useForm<InviteMemberFormValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      email: '',
      role: 'member',
    },
  });

  const teamSettingsForm = useForm<
    TeamSettingsFormInput,
    unknown,
    TeamSettingsFormValues
  >({
    resolver: zodResolver(teamSettingsSchema),
    defaultValues: toSettingsFormValues(INITIAL_TEAM.settings),
  });

  useEffect(() => {
    if (!activeTeam) return;
    teamSettingsForm.reset(toSettingsFormValues(activeTeam.settings));
  }, [activeTeam, teamSettingsForm]);

  const updateActiveTeam = (updater: (team: TeamEntity) => TeamEntity) => {
    setTeams((prev) =>
      prev.map((team) => (team.id === activeTeamId ? updater(team) : team))
    );
  };

  const onCreateTeam = createTeamForm.handleSubmit((values) => {
    const nextId = `team_${(teams.length + 1).toString(36)}`;
    const nextActivityId = `activity_${(teams.length + 1).toString(36)}`;
    const now = new Date().toISOString();

    const nextTeam: TeamEntity = {
      id: nextId,
      name: values.name.trim(),
      description: values.description?.trim() ?? '',
      createdAt: now,
      members: [],
      sharedSkills: [],
      activities: [
        {
          id: nextActivityId,
          actor: 'Current member',
          action: 'created',
          target: values.name.trim(),
          timestamp: now,
        },
      ],
      settings: {
        visibility: 'private',
        defaultPermission: 'read',
        autoSync: true,
        syncIntervalMinutes: 30,
      },
    };

    setTeams((prev) => [...prev, nextTeam]);
    setActiveTeamId(nextId);
    createTeamForm.reset();
    setMessage(t('team:messages.teamCreated', { name: nextTeam.name }));
  });

  const onInviteMember = inviteMemberForm.handleSubmit((values) => {
    if (!activeTeam) return;

    const now = new Date().toISOString();
    const email = values.email.trim().toLowerCase();
    const nextMemberId = `member_${(activeTeam.members.length + 1).toString(36)}`;
    const nextActivityId = `activity_${(activeTeam.activities.length + 1).toString(36)}`;

    const newMember: TeamMember = {
      id: nextMemberId,
      name: normalizeDisplayName(email),
      email,
      role: values.role as TeamRole,
      joinedAt: now,
    };

    updateActiveTeam((team) => ({
      ...team,
      members: [...team.members, newMember],
      activities: [
        {
          id: nextActivityId,
          actor: 'Current User',
          action: 'invited',
          target: email,
          timestamp: now,
        },
        ...team.activities,
      ],
    }));

    inviteMemberForm.reset({ email: '', role: values.role });
    setMessage(t('team:messages.memberInvited', { email }));
  });

  const onSaveSettings = teamSettingsForm.handleSubmit((values) => {
    if (!activeTeam) return;
    const parsedValues = teamSettingsSchema.parse(values);
    const nextActivityId = `activity_${(activeTeam.activities.length + 1).toString(36)}`;

    const settings: TeamSettings = {
      visibility: parsedValues.visibility,
      defaultPermission: parsedValues.defaultPermission,
      autoSync: parsedValues.autoSync,
      syncIntervalMinutes: toSyncIntervalMinutes(parsedValues.syncIntervalMinutes),
    };

    updateActiveTeam((team) => ({
      ...team,
      settings,
      activities: [
        {
          id: nextActivityId,
          actor: 'Current User',
          action: 'updated',
          target: 'team settings',
          timestamp: new Date().toISOString(),
        },
        ...team.activities,
      ],
    }));

    setMessage(t('team:messages.settingsSaved'));
  });

  return (
    <PageFrame
      activeNav="settings"
      title={t('navigation:secondary.team')}
      subtitle={t('team:subtitle')}
    >
      <div className="space-y-4">
        {message && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-theme bg-theme-elevated px-4 py-3 text-sm text-theme-primary"
          >
            {message}
          </div>
        )}

        <section className={PANEL_CLASS}>
          <label
            htmlFor="team-switcher"
            className="mb-2 block text-sm font-medium text-theme-secondary"
          >
            {t('team:labels.activeTeam')}
          </label>
          <select
            id="team-switcher"
            value={activeTeamId}
            onChange={(event) => {
              setActiveTeamId(event.target.value);
              setMessage(null);
            }}
            className="w-full rounded-lg input-theme md:max-w-md"
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:items-start">
          <div className="space-y-6 xl:col-span-5">
            <section className={PANEL_CLASS}>
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-theme-secondary" aria-hidden />
                <h2 className="text-lg font-semibold text-theme-primary">{t('team:sections.createTeam')}</h2>
              </div>

              <form
                className="space-y-4"
                noValidate
                onSubmit={(event) => {
                  void onCreateTeam(event);
                }}
              >
                <div>
                  <label htmlFor="team-name" className="mb-1 block text-sm font-medium text-theme-secondary">
                    {t('team:labels.teamName')}
                  </label>
                  <input
                    id="team-name"
                    type="text"
                    className="w-full rounded-lg input-theme"
                    placeholder={t('team:placeholders.teamName')}
                    {...createTeamForm.register('name')}
                  />
                  {createTeamForm.formState.errors.name && (
                    <p className="mt-1 text-sm text-theme-danger" role="alert">
                      {t(createTeamForm.formState.errors.name.message ?? '')}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="team-description"
                    className="mb-1 block text-sm font-medium text-theme-secondary"
                  >
                    {t('team:labels.teamDescription')}
                  </label>
                  <textarea
                    id="team-description"
                    rows={3}
                    className="w-full rounded-lg input-theme resize-y"
                    placeholder={t('team:placeholders.teamDescription')}
                    {...createTeamForm.register('description')}
                  />
                  {createTeamForm.formState.errors.description && (
                    <p className="mt-1 text-sm text-theme-danger" role="alert">
                      {t(createTeamForm.formState.errors.description.message ?? '')}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="rounded-lg px-4 py-2 btn-theme-primary-soft"
                >
                  {t('team:actions.createTeam')}
                </button>
              </form>
            </section>

            <section className={PANEL_CLASS}>
              <div className="mb-4 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-theme-secondary" aria-hidden />
                <h2 className="text-lg font-semibold text-theme-primary">{t('team:sections.inviteMember')}</h2>
              </div>

              {activeTeam ? (
                <form
                  className="space-y-4"
                  noValidate
                  onSubmit={(event) => {
                    void onInviteMember(event);
                  }}
                >
                  <p className="text-sm text-theme-secondary">
                    {t('team:labels.currentTeamPrefix')} <span className="font-semibold text-theme-primary">{activeTeam.name}</span>
                  </p>

                  <div>
                    <label htmlFor="invite-email" className="mb-1 block text-sm font-medium text-theme-secondary">
                      {t('team:labels.inviteEmail')}
                    </label>
                    <input
                      id="invite-email"
                      type="email"
                      className="w-full rounded-lg input-theme"
                      placeholder={t('team:placeholders.inviteEmail')}
                      {...inviteMemberForm.register('email')}
                    />
                    {inviteMemberForm.formState.errors.email && (
                      <p className="mt-1 text-sm text-theme-danger" role="alert">
                        {t(inviteMemberForm.formState.errors.email.message ?? '')}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="invite-role" className="mb-1 block text-sm font-medium text-theme-secondary">
                      {t('team:labels.inviteRole')}
                    </label>
                    <select
                      id="invite-role"
                      className="w-full rounded-lg input-theme"
                      {...inviteMemberForm.register('role')}
                    >
                      <option value="owner">{t('team:roles.owner')}</option>
                      <option value="maintainer">{t('team:roles.maintainer')}</option>
                      <option value="member">{t('team:roles.member')}</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="rounded-lg px-4 py-2 btn-theme-primary-soft"
                  >
                    {t('team:actions.inviteMember')}
                  </button>
                </form>
              ) : (
                <p className="text-sm text-theme-secondary">{t('team:empty.noActiveTeam')}</p>
              )}

              {activeTeam && (
                <div className="mt-5 space-y-2">
                  <h3 className="text-sm font-semibold text-theme-primary">{t('team:sections.memberList')}</h3>
                  {activeTeam.members.length === 0 ? (
                    <p className="text-sm text-theme-secondary">{t('team:empty.noMembers')}</p>
                  ) : (
                    <ul className="space-y-2" role="list" aria-label={t('team:sections.memberList')}>
                      {activeTeam.members.map((member) => (
                        <li
                          key={member.id}
                          className="rounded-xl border border-theme bg-theme-elevated px-3 py-2"
                        >
                          <p className="text-sm font-medium text-theme-primary">{member.name}</p>
                          <p className="text-xs text-theme-secondary">{member.email}</p>
                          <p className="mt-1 text-xs text-theme-secondary">
                            {t('team:labels.role')}: {t(`team:roles.${member.role}`)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            <section className={PANEL_CLASS}>
              <div className="mb-4 flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-theme-secondary" aria-hidden />
                <h2 className="text-lg font-semibold text-theme-primary">{t('team:sections.teamSettings')}</h2>
              </div>

              {activeTeam ? (
                <form
                  className="space-y-4"
                  noValidate
                  onSubmit={(event) => {
                    void onSaveSettings(event);
                  }}
                >
                  <div>
                    <label htmlFor="team-visibility" className="mb-1 block text-sm font-medium text-theme-secondary">
                      {t('team:labels.visibility')}
                    </label>
                    <select
                      id="team-visibility"
                      className="w-full rounded-lg input-theme"
                      {...teamSettingsForm.register('visibility')}
                    >
                      <option value="private">{t('team:visibility.private')}</option>
                      <option value="team">{t('team:visibility.team')}</option>
                      <option value="public">{t('team:visibility.public')}</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="team-default-permission" className="mb-1 block text-sm font-medium text-theme-secondary">
                      {t('team:labels.defaultPermission')}
                    </label>
                    <select
                      id="team-default-permission"
                      className="w-full rounded-lg input-theme"
                      {...teamSettingsForm.register('defaultPermission')}
                    >
                      <option value="read">{t('team:permissions.read')}</option>
                      <option value="write">{t('team:permissions.write')}</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="team-sync-interval" className="mb-1 block text-sm font-medium text-theme-secondary">
                      {t('team:labels.syncInterval')}
                    </label>
                    <select
                      id="team-sync-interval"
                      className="w-full rounded-lg input-theme"
                      {...teamSettingsForm.register('syncIntervalMinutes', {
                        valueAsNumber: true,
                      })}
                    >
                      <option value={5}>5 min</option>
                      <option value={30}>30 min</option>
                      <option value={60}>60 min</option>
                    </select>
                    {teamSettingsForm.formState.errors.syncIntervalMinutes && (
                      <p className="mt-1 text-sm text-theme-danger" role="alert">
                        {t(teamSettingsForm.formState.errors.syncIntervalMinutes.message ?? '')}
                      </p>
                    )}
                  </div>

                  <label className="inline-flex items-center gap-2 text-sm text-theme-secondary">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border border-theme"
                      {...teamSettingsForm.register('autoSync')}
                    />
                    {t('team:labels.autoSync')}
                  </label>

                  <button
                    type="submit"
                    className="rounded-lg px-4 py-2 btn-theme-primary-soft"
                  >
                    {t('team:actions.saveSettings')}
                  </button>
                </form>
              ) : (
                <p className="text-sm text-theme-secondary">{t('team:empty.noActiveTeam')}</p>
              )}
            </section>
          </div>

          <div className="space-y-6 xl:col-span-7">
            <section className={PANEL_CLASS}>
              <div className="mb-4 flex items-center gap-2">
                <LibraryBig className="h-4 w-4 text-theme-secondary" aria-hidden />
                <h2 className="text-lg font-semibold text-theme-primary">{t('team:sections.teamLibrary')}</h2>
              </div>

              {activeTeam && activeTeam.sharedSkills.length > 0 ? (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2" role="list" aria-label={t('team:sections.teamLibrary')}>
                  {activeTeam.sharedSkills.map((skill) => (
                    <li
                      key={skill.id}
                      className="rounded-xl border border-theme bg-theme-elevated px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-theme-primary">{skill.name}</p>
                          <p className="text-xs text-theme-secondary">{skill.category}</p>
                        </div>
                        <span className="rounded-full border border-theme px-2 py-1 text-xs text-theme-secondary">
                          {t(`team:permissions.${skill.permission}`)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-theme-secondary">
                        {t('team:labels.owner')}: {skill.owner}
                      </p>
                      <p className="text-xs text-theme-secondary">
                        {t('team:labels.downloads')}: {skill.downloads}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-theme-secondary">{t('team:empty.noSharedSkills')}</p>
              )}
            </section>

            <section className={PANEL_CLASS}>
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-theme-secondary" aria-hidden />
                <h2 className="text-lg font-semibold text-theme-primary">{t('team:sections.activityFeed')}</h2>
              </div>

              {activeTeam && activeTeam.activities.length > 0 ? (
                <ul className="space-y-3" role="list" aria-label={t('team:sections.activityFeed')}>
                  {activeTeam.activities.map((activity) => (
                    <li
                      key={activity.id}
                      className="rounded-xl border border-theme bg-theme-elevated px-3 py-3"
                    >
                      <p className="text-sm text-theme-primary">
                        <span className="font-semibold">{activity.actor}</span>{' '}
                        {t(`team:activityActions.${activity.action}`)}{' '}
                        <span className="font-medium">{activity.target}</span>
                      </p>
                      <p className="mt-1 text-xs text-theme-secondary">
                        {formatDate(activity.timestamp, i18n.language)}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-theme-secondary">{t('team:empty.noActivities')}</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
