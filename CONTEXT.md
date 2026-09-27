# Calamari Tracker

An Omarchy shell plugin that records your own working time in Calamari (the "Clockin" module) at the press of a button and reminds you of a forgotten clock-in or clock-out.

## Language

### Time tracking

**Shift**:
A continuous span between clocking in and clocking out, as Calamari stores it as a timesheet entry. May contain breaks.
_Avoid_: work in progress, session, entry

**Running shift**:
A shift that has been started in Calamari and not yet ended, no matter whether it was clocked in from the plugin, the web or the phone.
_Avoid_: WIP, running time

**Clock in / clock out** (on screen: „Einstempeln“ / „Ausstempeln“):
The start and the end of a shift respectively.
_Avoid_: start/stop

**Break** (on screen: „Pause beginnen“ / „Pause beenden“):
An interruption within a running shift that Calamari stores as a break (with a break type). It can only begin from a running shift and is not the end of day; the shift goes on during the break.
_Avoid_: gap between two shifts

**Project**:
The Calamari project a shift is assigned to. Web and phone set "Check-in"; the plugin sets the default project when clocking in.
_Avoid_: "Ohne Projekt" (that is Calamari's own name for the absence of a project)

**Default project**:
The project the plugin gives every clock-in of its own. Configurable, "Check-in" by default.

**End of day** (on screen: „Feierabend“):
The state after clocking out on a working day. From then on there are no more stamp reminders that day. Clocking in again stays possible.
_Avoid_: end of business, sign off

**Day-end close**:
Calamari itself ends every shift still open at 23:59 (a company rule). No shift therefore survives midnight. The entry of such a day has a wrong end time, which the user corrects in the web; the plugin reminds them of it the next morning. See [ADR 0002](docs/adr/0002-no-overnight-close.md).
_Avoid_: overnight close (the plugin stamps nothing here), midnight close

**Calamari**:
The single source of truth for the shift status. The plugin holds no status of its own that contradicts Calamari.

### Day planning

**Work schedule**:
The user's weekly schedule in Calamari. It fixes, for every weekday, whether it is a working day and when its core time falls. Can be overridden locally.

**Working day**:
A day that is a working day according to the work schedule.

**Core time** (on screen: „Kernzeiten“):
The window of a working day, according to the work schedule, in which a running shift is expected. A half public holiday shortens it.
_Avoid_: working hours, normal hours

**Day off** (on screen: „Heute frei“):
A working day on which no stamp reminders come: because of a public holiday, an absence (holiday, sickness) or because the user marked it off by hand.
_Avoid_: rest day, off-day

### Reminders

**Stamp reminder**:
A repeated notification during the core time of a working day on which nothing has been clocked in at all yet. It is dropped on a day off and after the end of day.

**Break reminder**:
A notification because a break is lasting longer than allowed.

**Soft hint**:
A one-off notification shortly after the end of core time (30 minutes after it by default) that a shift is still running.

**Final warning**:
The notification at the configurable time of day (19:00 by default), after which the auto-close follows if nothing responds.

**Auto-close**:
The automatic clocking out of a forgotten running shift at the moment of the close. Afterwards the user is asked to correct the end time in Calamari to the last activity.
_Avoid_: close the day, end-of-day close

**Last activity**:
The last moment at which the user was active at the machine before going idle or into suspend.

### Delivery

**Release**:
A state that is given a `vX.Y.Z` tag, a section in the changelog and a GitHub release, and is moved onto the delivery branch. Only then do users get it through `omarchy plugin update`.
_Avoid_: version (that is only the number), deploy

**Delivery branch** (`stable`):
The default branch on GitHub, the one installed plugins follow. It only moves at a release, by fast-forward to the tagged commit. Development happens on `main`. See [ADR 0004](docs/adr/0004-delivery-branch-stable.md).
_Avoid_: release branch, default branch (when `main` is meant)
