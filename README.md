# Nearlo: a permission-request study instrument

A mobile web page that looks and behaves like the onboarding of a real app
("Nearlo, see what's happening around you"). It walks a participant through
today's app permission requests, fires the phone's real permission prompts,
shows a mock "near you" ad if location was allowed, then reveals what each
choice actually lets an app do and debriefs the participant.

It records **only** each yes/no decision, how long it took, and the answers
to three reflection questions. It never reads, displays, or stores location,
camera, microphone, or notification content.

Built for an AP Research study on the privacy paradox in high school
students: does stated privacy concern match what teens actually allow?

## What the participant sees

1. **Participant code.** The same self-made code used on the survey, so the
   two can be linked without names.
2. **App splash.** "Get started," continue as guest.
3. **Permission requests**, one at a time: location, notifications, camera,
   microphone (order and set are configurable). Each has an in-app screen
   first, like real apps, then the real browser prompt.
   - Condition **A** (plain): "Nearlo needs access to your location."
   - Condition **B** (reason): "Nearlo uses your location to show events and
     deals near you."
   - Assignment is random per session (or forced with `?c=A` / `?c=B`).
4. **Home screen.** A fake event feed. If location was allowed, the ad slot
   shows a "Sponsored · Near you" ad; otherwise a generic ad. If
   notifications were allowed, a mock alert appears at the top.
5. **Reveal.** Each permission, the choice made, and what an app with that
   permission could do. Then three short questions (did you know, how much
   did you think, what would you change).
6. **Debrief.** Nearlo is not real, nothing was collected, and how to remove
   the permissions from the browser.
7. **Result code.** A short string the participant copies into the survey
   or shows the researcher. JSON and CSV downloads are also offered.

## Running it

The page is static: no build, no server code, no dependencies.

- **On a phone (real prompts):** the page must be served over HTTPS.
  Easiest: push this folder to GitHub and turn on GitHub Pages
  (Settings → Pages → Deploy from branch → `main`, root). The URL becomes
  `https://<user>.github.io/<repo>/`. Put it in a QR code for the classroom.
- **Locally:** `python -m http.server 8000` in this folder, then open
  `http://localhost:8000`. `localhost` counts as secure, so real prompts work
  on the same computer. Other devices on the network reach it over plain
  HTTP, which browsers treat as insecure, so prompts fall back to simulated.
- **Demo without granting anything:** add `?sim=1` to the URL. Every prompt
  becomes a simulated OS-style dialog, styled for iOS or Android, and is
  marked `sim` in the data.

## Configuration

Everything lives in `config.js`: app name and tagline, which permissions and
in what order, condition assignment, whether "Not now" is offered, the
reflection questions, the debrief text, and where results go.

Results options, all optional:

- `formUrl` + `formField`: a Google Form with one short-answer question. The
  final screen shows a "Submit through the form" button with the code
  prefilled.
- `submitUrl`: any endpoint that accepts a JSON POST (a Google Apps Script
  web app works).
- Neither: participants copy the code into the survey by hand.

## The data

One result code per session, for example:

```
NRL1;id=milo27;c=B;p=ios-Safari;sec=1;L=G/real/prompt/4.2/3.1/-;N=U/sim/-/2.0/1.5/-;C=D/real/prompt/3.3/2.2/-;M=G/real/prompt/1.9/1.4/-;feed=14.0;ad=T;r_know=2;r_think=3;r_change=1,3;total=61.0;t=2026-09-26T15:12
```

Per permission: `result/mode/prior/seconds on in-app screen/seconds on prompt/detail`.

| Result | Meaning |
|---|---|
| G | allowed |
| D | denied at the prompt |
| M | closed the prompt without answering |
| P | tapped "Not now" on the in-app screen (never reached the prompt) |
| U | the browser cannot ask for this (for example notifications in Safari on iPhone unless installed to the home screen); a simulated dialog was used |
| X | no such device (no camera or microphone) |
| T | timed out |
| E | error |

`prior` is what the browser already remembered before asking. `prompt` means
a fresh decision. `granted` or `denied` means the browser did not ask again,
so that row should probably be excluded. `t` is the start time in UTC.

`decode.html` turns pasted codes into a table, a grant-rate summary by
condition, and a CSV. It runs entirely in the browser.

## Privacy and ethics notes

- Location: the success callback ignores the position object entirely.
  Coordinates are never read.
- Camera and microphone: the media stream is stopped the instant it is
  granted. No frame or sample is captured or shown.
- Notifications: permission is requested; no notification is ever sent.
- No names, no free-text fields, no screenshots. The participant code is
  self-generated.
- The reveal and debrief screens are part of the instrument. Their wording
  in `config.js` should match the approved consent and debrief documents.
- On an iPhone, Safari cannot ask for notification permission from a normal
  web page, so that step is simulated and marked as such. Location, camera,
  and microphone prompts are real on both iPhone and Android.
- Running the page twice in the same browser will not re-prompt for
  permissions already decided. The first screen warns when that is the case.
  Use a private tab or reset the site's permissions between participants on
  a shared device.

## Files

| File | Purpose |
|---|---|
| `index.html` | the participant flow (all screens) |
| `app.js` | flow logic, real and simulated prompts, result code |
| `styles.css` | phone-like styling, light and dark |
| `config.js` | everything you would want to change |
| `decode.html`, `decode.js` | researcher tool: codes → table and CSV |
