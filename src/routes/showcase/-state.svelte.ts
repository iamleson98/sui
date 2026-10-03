/**
 * Shared reactive state for the /showcase mission-control app.
 *
 * A single class instance exported at module scope — every view mutates and
 * reads the same $state fields, so a kanban move made from the board view
 * instantly updates the sidebar badge counts, the command palette results
 * and anywhere else the data is shown.
 *
 * (Module-scope state is only mutated from user events — never during SSR —
 * so cross-request leakage on the server is not a concern.)
 */
import {
        ISSUES,
        EVENTS,
        DEPLOYMENTS,
        type Issue,
        type IssueStatus,
        type CalEvent,
        type LabelKey,
        type Priority,
        type Deployment,
        type Range
} from './-data.svelte';

export type ViewKey = 'overview' | 'board' | 'deployments' | 'schedule' | 'settings';

export type IssueDraft = {
        title: string;
        description: string;
        priority: Priority;
        labels: LabelKey[];
        assignees: string[];
        points: number;
        notify: boolean;
        block: boolean;
};

class ShowcaseState {
        view = $state<ViewKey>('overview');
        commandOpen = $state(false);
        issueDialogOpen = $state(false);
        deployDialogOpen = $state(false);
        notificationsRead = $state(false);
        /** chart range on the overview (7d / 30d / 90d) */
        range = $state<Range>('30d');
        /** overview has fetched once — skip the skeleton on later visits */
        overviewLoaded = $state(false);

        issues = $state<Issue[]>([...ISSUES]);
        events = $state<CalEvent[]>([...EVENTS]);
        deployments = $state<Deployment[]>([...DEPLOYMENTS]);
        private nextIssue = 242;

        /* ------------------------------------------------------ deployments -- */

        addDeployment(d: Omit<Deployment, 'id'>) {
                const dep: Deployment = { ...d, id: `dpl_${Date.now().toString(16)}` };
                this.deployments = [dep, ...this.deployments];
                return dep;
        }

        patchDeployment(id: string, patch: Partial<Deployment>) {
                this.deployments = this.deployments.map((d) => (d.id === id ? { ...d, ...patch } : d));
        }

        /* ---------------------------------------------------------- issues -- */

        byStatus(status: IssueStatus): Issue[] {
                return this.issues.filter((i) => i.status === status);
        }

        openCount(): number {
                return this.issues.filter((i) => i.status !== 'done').length;
        }

        moveIssue(id: string, status: IssueStatus) {
                this.issues = this.issues.map((i) => (i.id === id ? { ...i, status } : i));
        }

        addIssue(draft: IssueDraft) {
                const issue: Issue = {
                        id: `NMB-${this.nextIssue++}`,
                        title: draft.title,
                        description: draft.description || 'No description yet — added from the quick-create dialog.',
                        status: 'backlog',
                        priority: draft.priority,
                        labels: draft.labels,
                        assignees: draft.assignees,
                        points: draft.points,
                        createdAgo: 'just now',
                        comments: 0,
                        checklistDone: 0,
                        checklistTotal: 0
                };
                this.issues = [issue, ...this.issues];
                return issue;
        }

        duplicateIssue(id: string) {
                const src = this.issues.find((i) => i.id === id);
                if (!src) return;
                const copy: Issue = {
                        ...src,
                        id: `NMB-${this.nextIssue++}`,
                        title: `${src.title} (copy)`,
                        status: 'backlog',
                        createdAgo: 'just now',
                        comments: 0
                };
                this.issues = [copy, ...this.issues];
                return copy;
        }

        removeIssue(id: string) {
                this.issues = this.issues.filter((i) => i.id !== id);
        }

        /* ---------------------------------------------------------- events -- */

        addEvent(evt: Omit<CalEvent, 'id'>) {
                const id = `evt_${Math.random().toString(36).slice(2, 8)}`;
                this.events = [...this.events, { ...evt, id }];
                return id;
        }

        removeEvent(id: string) {
                this.events = this.events.filter((e) => e.id !== id);
        }
}

export const showcase = new ShowcaseState();
