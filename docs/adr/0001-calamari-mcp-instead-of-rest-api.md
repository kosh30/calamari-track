# Calamari through the MCP server with user OAuth instead of through the REST API

The plugin talks exclusively to the official Calamari MCP server (`https://gateway.eu-west-1.calamari.io/mcp-server/mcp`). Logging in runs over OAuth (dynamic client registration, authorization code + PKCE, refresh token) with your own Microsoft SSO login. The documented REST API is ruled out: it needs a company-wide admin API key that can change every employee's times, and we do not have one. Unofficial web endpoints are out of the question, because they are unsupported and hard to automate with SSO.

## Consequences

The MCP server offers less than the REST API (as of 2026-09-22). Deliberate detours follow from that, which should not be "repaired" in the code:

- **The status is determined through `checkTimesheetOverlap`.** There is no "is a shift running?" tool. A running shift counts there up to "now", though, so "overlap with the last ~2 minutes" means a running shift. That is undocumented behaviour and can break without notice.
- **Breaks are clocking out and clocking in again.** There are no tools for breaks. Only the plugin itself knows that it is a break and not the end of the day.
- **The auto-close clocks out at the moment of the close.** `clockOut` takes no time of day. The user is told their last activity and corrects the end time in the web themselves.
- **Stampings by the plugin have no project.** `clockIn` takes no arguments, so no project either. In the timesheet they appear as "Ohne Projekt" (WITHOUT A PROJECT), while web and phone set the project "Check-in" (observed 2026-09-22). If company reports or rules require "Check-in", that is the biggest gap in the MCP route. It can only be changed in the web: according to Calamari's help you can switch the project in the time clock without stopping the clock. On the MCP side, `clockIn` would need a project parameter.
- `createTimesheetEntries` (entering times after the fact) was rejected as the main route. There would be no live status in Calamari during the day, stamping from phone or web would create duplicates, and entries could need a manager's approval.

As soon as the MCP server supplies status, breaks or time parameters, these detours should be replaced.

**Partly superseded by [ADR 0003](0003-rest-api-for-break-project-status.md):** breaks, project and status have run over the REST API with a company key since 2026-09-24.

The state of the tools as of 2026-09-22 sits in `docs/mcp-tools.json`: 17 tools, none of them knows breaks, `clockIn` and `clockOut` take no arguments, and no tool reads timesheet entries. Whether Calamari has changed something is shown by:

```
diff <(bin/calamari tools | python3 -m json.tool --sort-keys --no-ensure-ascii) docs/mcp-tools.json
```
