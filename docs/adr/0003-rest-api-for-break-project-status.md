# REST API with a company key for break, project and status, as a bridge until the MCP update

Since 2026-09-24 we have an API key for `https://<company>.calamari.io/api`. From now on the helper uses the REST API for three things the MCP server cannot do: real breaks (`break-start` and `break-stop`), the default project when clocking in (`clock-in` with `projectId`) and the shift status (`shift/status/get-current`, which also reports `BREAK`). Everything else stays with the MCP server and user OAuth (ADR 0001). In exchange we accept what ADR 0001 wanted to avoid: the key always applies to the whole company and can change every employee's times. Calamari cannot restrict it to one person, only to groups of endpoints. The alternative would have been to wait for the MCP update expected for October 2026 and to live with breaks as gaps and stampings "Ohne Projekt" until then.

## Consequences

- REST stays behind the commands of `bin/calamari`. The plugin does not know which route delivers an answer. If the MCP server learns breaks, project and status, only the helper switches back, and the key can go.
- The address of the REST API belongs to the company (`https://<company>.calamari.io/api`) and is the setting `apiUrl`, with no default. If it is missing, the REST commands answer with `API_URL_REQUIRED`.
- The key lives in the keyring (`bin/calamari api-key` reads it from stdin), never in `shell.json` or the settings. It only needs the groups Terminal, shift status and projects. The helper only stamps for your own email address.
- An "API Terminal" the user has access to must be set up in Clockin, otherwise stamping and breaks answer with `API_TERMINAL_NOT_AVAILABLE`.
- If REST fails, the plugin does not fall back to stamping over MCP without a project. It shows the error like any failed stamping.
- The REST stampings take a time of day. In phase 1 only clocking out from a break uses that (end of day instead of break, auto-close during a break): the shift ends at the start of the break. The remaining detours from ADR 0001 (start-time and end-time search, `day-end`, auto-close only "now") are not replaced until phase 2.
- The terminal endpoints take the time only as a local time without a time zone and without milliseconds (`2026-09-24T11:24:53`); with `Z` or an offset they answer "Incorrect value" (tried 2026-09-24).
- The key may also read `timesheetentries/v1/find`. `status` takes the start of the running shift and of its open break from there; the plugin uses no more of it in phase 1.
- The rate limit is 720 requests per hour and 2880 per day (as of 2026-09-24).
